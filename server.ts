import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(express.json({ limit: "10mb" }));

// Initialize GoogleGenAI client for Vertex AI on the server-side, using Cloud Run ADC
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION || "global";

let ai: GoogleGenAI | null = null;
try {
  if (!project) {
    throw new Error("GOOGLE_CLOUD_PROJECT is required for Vertex AI.");
  }
  ai = new GoogleGenAI({
    vertexai: true,
    project: project,
    location: location,
  });
} catch (e: any) {
  console.error("Failed to initialize GoogleGenAI client:", e.message || e);
}

// Robust custom parser for the Supervisor Report format
interface SupervisorReport {
  status: 'ok' | 'needs_small_repair' | 'needs_serious_repair' | 'do_not_continue';
  whatIsGood: string;
  problems: string[];
  requiredFixes: string[];
  recommendation: string;
  canContinue: boolean;
}

function parseSupervisorReport(text: string): SupervisorReport {
  console.log("[Vertex AI] Parsing supervisor response...");

  // Try parsing directly as JSON
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.status) {
        return {
          status: parsed.status,
          whatIsGood: parsed.whatIsGood || "Good progress.",
          problems: Array.isArray(parsed.problems) ? parsed.problems : [parsed.problems].filter(Boolean),
          requiredFixes: Array.isArray(parsed.requiredFixes) ? parsed.requiredFixes : [parsed.requiredFixes].filter(Boolean),
          recommendation: parsed.recommendation || "Safe to proceed.",
          canContinue: parsed.canContinue === undefined ? true : !!parsed.canContinue
        };
      }
    }
  } catch (e) {
    console.error("[Vertex AI] JSON.parse failed, fallback to regular expression parser");
  }

  // Fallback regular expression and line-by-line parsing
  const statusMatch = text.match(/status:\s*([^\n\r]+)/i);
  const whatIsGoodMatch = text.match(/whatIsGood:\s*([^\n\r]+)/i);
  const recommendationMatch = text.match(/recommendation:\s*([^\n\r]+)/i);
  const canContinueMatch = text.match(/canContinue:\s*(true|false)/i);

  const problems: string[] = [];
  const requiredFixes: string[] = [];

  const lines = text.split('\n');
  let currentSection = '';
  for (const line of lines) {
    if (/problems:/i.test(line)) {
      currentSection = 'problems';
      continue;
    } else if (/requiredFixes:/i.test(line)) {
      currentSection = 'fixes';
      continue;
    } else if (/status:|whatIsGood:|recommendation:|canContinue:/i.test(line)) {
      currentSection = '';
    }

    if (currentSection === 'problems' && (line.trim().startsWith('*') || line.trim().startsWith('-'))) {
      problems.push(line.replace(/^[\s*-]+/, '').trim());
    } else if (currentSection === 'fixes' && (line.trim().startsWith('*') || line.trim().startsWith('-'))) {
      requiredFixes.push(line.replace(/^[\s*-]+/, '').trim());
    }
  }

  let status: any = statusMatch ? statusMatch[1].trim().toLowerCase() : 'ok';
  if (!['ok', 'needs_small_repair', 'needs_serious_repair', 'do_not_continue'].includes(status)) {
    status = 'needs_small_repair';
  }

  return {
    status: status,
    whatIsGood: whatIsGoodMatch ? whatIsGoodMatch[1].trim() : "Follows general format.",
    problems: problems.length > 0 ? problems : ["Minor alignment issues detected."],
    requiredFixes: requiredFixes.length > 0 ? requiredFixes : ["Enhance emotional subtext."],
    recommendation: recommendationMatch ? recommendationMatch[1].trim() : "Fix pacing and emotion before proceeding.",
    canContinue: canContinueMatch ? canContinueMatch[1].trim().toLowerCase() === 'true' : false
  };
}

const AI_SUPERVISED_STAGES = new Set(["story_plan", "scene_cards"]);

const SCRIPT_WRITER_RUNTIME_CORE = `
=== FINAL RUNTIME WRITER CORE ===
This is the last and strongest instruction for Script Writer.

Write the current part as an English first-person manga/manhwa recap script.
Use the approved Story Plan and current Scene Cards as the source of truth.
Do not fight the prompt with old formatting police rules. Draft paragraphs may be natural voiceover frames; exact paragraph length is not a blocking goal during Script Writer.

For every part:
- open with pressure already moving;
- follow the current part scene cards in order;
- write from inside the protagonist's head using I / my / we naturally;
- use competitor references only for rhythm and delivery, never for plot;
- make each beat visual: problem, detail noticed, action, consequence, reaction, payoff, new pressure;
- keep practical survival/progression logic clear without sounding like a science lesson;
- make allies useful and enemies reactive, not stupid;
- include micro-turns: cost, failed attempt, doubt, enemy adaptation, resource loss, public reaction, or a new problem;
- end with a payoff or a forward hook.

Forbidden output:
- no analysis, checklist, QA report, markdown table, bullet list, scene labels, or debug notes;
- no academic/clinical/technical report tone;
- no generic "little did I know" or empty destiny prose;
- no copying reference plots, names, scenes, powers, or twists.

Output only the script text for this part.
`;

function localSupervisorPassReport(stageId: string): SupervisorReport {
  return {
    status: "ok",
    whatIsGood:
      `${stageId} does not use a blocking AI Supervisor in the simplified workflow.`,
    problems: [],
    requiredFixes: [],
    recommendation:
      "Local pass. Only Story Plan and Scene Cards are blocking quality gates.",
    canContinue: true,
  };
}

// Model generation function with automated fallback based on stage requirements
interface ModelAttempt {
  model: string;
  config?: {
    thinkingConfig?: {
      thinkingLevel: "HIGH" | "LOW" | "MINIMAL";
    };
  };
}

async function generateContent(prompt: string, expectJson: boolean = false, stageId?: string) {
  if (!ai) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_LOCATION for Vertex AI.");
  }

  // Define model and config based on user's specific stage requirements
  let modelName = "gemini-2.5-flash"; // Default
  let thinkingLevel: "HIGH" | "LOW" | "MINIMAL" | undefined = undefined;

  if (stageId === "raw_idea" || stageId === "story_dna") {
    modelName = "gemini-2.5-flash";
  } else if (stageId === "story_plan") {
    modelName = "gemini-2.5-pro";
  } else if (stageId === "scene_cards") {
    modelName = "gemini-2.5-pro";
  } else if (stageId === "script_writer") {
    modelName = "gemini-3.1-pro-preview";
    thinkingLevel = "HIGH";
  } else if (stageId === "supervisor") {
    modelName = "gemini-2.5-flash";
  }

  let finalPrompt = prompt;
  if (modelName === "gemini-2.5-flash") {
    thinkingLevel = "HIGH";
    // Inject mental instructions to emulate physical reasoning, strictness, and logical depth of Gemini 3.1 Pro
    const brainDirective = `\n\n[EMULATION DIRECTIVE: Think, reason, and perform deep step-by-step analytical considerations before answering, mimicking the high-quality intellectual and logical depth of Gemini 3.1 Pro. Process all instructions rigorously. If JSON/schema formatting is required, think internally first but ensure the output is strictly valid conforming JSON.]\n`;
    finalPrompt = brainDirective + prompt;
  }

  const config: any = {};
  if (expectJson) {
    config.responseMimeType = "application/json";
  }
  if (thinkingLevel) {
    config.thinkingConfig = { thinkingLevel };
  }

  try {
    const modeDesc = thinkingLevel ? ` (Thinking: ${thinkingLevel})` : "";
    console.log(`[Vertex AI] Requesting ${modelName}${modeDesc} for stage: ${stageId || "default"}`);

    let response;
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: finalPrompt,
        config: config
      });
    } catch (innerErr: any) {
      const errStr = String(innerErr.message || innerErr);
      if (thinkingLevel && (errStr.includes("thinkingConfig") || errStr.includes("thinking_config") || errStr.includes("not supported") || errStr.includes("INVALID_ARGUMENT") || errStr.includes("Unsupported"))) {
        console.warn(`[Vertex AI Warning] ${modelName} with thinkingLevel ${thinkingLevel} is not supported or failed. Retrying without thinkingConfig...`);
        const retryConfig = { ...config };
        delete retryConfig.thinkingConfig;

        response = await ai.models.generateContent({
          model: modelName,
          contents: finalPrompt,
          config: retryConfig
        });
      } else {
        throw innerErr;
      }
    }

    console.log(`[Vertex AI] Success with ${modelName} for ${stageId || "default"}`);
    return response.text || "";
  } catch (err: any) {
    console.error(`[Vertex AI Error] ${modelName} failed:`, err.message || err);
    throw err;
  }
}

async function generateClaudeContent(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required but missing.");
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

  console.log(`[Anthropic] Requesting messages with model ${model}...`);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 12000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Anthropic Error] Direct API call failed with status ${response.status}:`, errText);
    throw new Error(`Anthropic API call failed: ${errText}`);
  }

  const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
  if (data && data.content && data.content[0] && typeof data.content[0].text === "string") {
    console.log(`[Anthropic] Success with ${model}`);
    return data.content[0].text;
  }

  throw new Error("Invalid or empty response structure from Anthropic Claude API.");
}

// Unified generate/RPC route
async function handleGenerate(req: express.Request, res: express.Response) {
  console.log("POST /api/generate called");
  const { prompt, type, stageId } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: "Prompt is required." });
  }

  try {
    const isSupervisor = type === "supervisor";

    if (isSupervisor && !AI_SUPERVISED_STAGES.has(stageId)) {
      console.log(`[Local Supervisor] Bypassing AI Supervisor for ${stageId}.`);
      const localReport = localSupervisorPassReport(stageId || "unknown_stage");
      return res.json({
        success: true,
        text: JSON.stringify(localReport, null, 2),
        parsed: localReport,
      });
    }

    let textOutput: string;
    const shouldUseAnthropicScriptWriter =
      !isSupervisor &&
      stageId === "script_writer" &&
      process.env.SCRIPT_WRITER_PROVIDER === "anthropic";

    const runtimePrompt =
      !isSupervisor && stageId === "script_writer"
        ? `${prompt}\n\n${SCRIPT_WRITER_RUNTIME_CORE}`
        : prompt;

    if (shouldUseAnthropicScriptWriter) {
      textOutput = await generateClaudeContent(runtimePrompt);
    } else {
      textOutput = await generateContent(runtimePrompt, isSupervisor, isSupervisor ? "supervisor" : stageId);
    }

    let parsedResult = null;
    if (isSupervisor) {
      parsedResult = parseSupervisorReport(textOutput);
    }

    return res.json({
      success: true,
      text: textOutput,
      parsed: parsedResult,
    });
  } catch (error: any) {
    let errMsg = "Generation failed";
    if (error) {
      if (typeof error.message === 'string') {
        errMsg = error.message;
      } else if (typeof error === 'object') {
        try {
          errMsg = JSON.stringify(error);
        } catch {
          errMsg = String(error);
        }
      } else {
        errMsg = String(error);
      }
    }
    return res.status(500).json({
      success: false,
      error: errMsg
    });
  }
}

// Endpoint declarations
app.post("/api/generate", handleGenerate);

// Support both /api/generate and /rpc for absolute safety
app.post("/rpc", (req, res) => {
  console.log("POST /rpc called as bridge redirect");
  handleGenerate(req, res);
});

// Vite middleware development / production asset server setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Server] Mounted Vite middleware (development mode)");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("[Server] Serving static assets (production mode)");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
