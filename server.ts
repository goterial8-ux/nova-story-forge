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
Treat the response as the exact body of a plain .txt file for the current script part.
Do not describe the file, do not provide a filename, do not wrap the answer in a code block, and do not write any explanation before or after the script text.
Do not fight the prompt with old formatting police rules. Paragraph length is a writing target, not a reason to explain or self-report.

Paragraph and part length reminder:
- each normal narrator paragraph should be 120-220 characters including spaces;
- 120-220 characters is usually about 22-40 English words;
- the best target is 26-34 words per paragraph, around 150-190 characters;
- if the target is a long full script around 120,000 total characters and the plan has nine parts, aim for about 13,000-14,500 characters per part including spaces;
- that usually means about 60-90 voiceover paragraphs per part;
- for a shorter 15-20 minute script, aim for about 5,000-7,000 characters per part;
- for a 20-30 minute script, aim for about 8,000-11,000 characters per part;
- for a 30+ minute script without a stricter total target, aim for about 12,000-15,000 characters per part;
- if the number of parts is not nine, scale the part length naturally so every part carries its share of the full target length.
- do not stop at 14-20 paragraphs for a long script; continue until the current part reaches its required length while preserving scene order and voiceover quality.

For every part:
- first identify the requested current part number and title from the prompt, then write only that part;
- if the prompt says Part One, write Part One only; if it says Part Five, write Part Five only;
- do not summarize previous parts and do not jump ahead to future parts;
- preserve the first-person competitor-style rhythm: fast, direct, visual, practical, and emotionally pressured;
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

Output only the plain .txt file body for this current part.
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

function clipPromptSection(value: string, maxChars: number): string {
  if (!value || value.length <= maxChars) {
    return value || "";
  }

  const headChars = Math.floor(maxChars * 0.68);
  const tailChars = Math.floor(maxChars * 0.24);
  return `${value.slice(0, headChars)}

[...SECTION COMPACTED...]

${value.slice(-tailChars)}`;
}

function extractPromptSection(
  prompt: string,
  startMarker: string,
  endMarkers: string[],
): string {
  const start = prompt.indexOf(startMarker);
  if (start < 0) return "";

  const end = endMarkers
    .map((marker) => prompt.indexOf(marker, start + startMarker.length))
    .filter((idx) => idx > start)
    .sort((a, b) => a - b)[0];

  return prompt.slice(start, end || prompt.length).trim();
}

function compactClaudePrompt(prompt: string): string {
  const maxChars = Number(process.env.ANTHROPIC_MAX_INPUT_CHARS || 24000);
  const safeMaxChars =
    Number.isFinite(maxChars) && maxChars >= 12000 ? maxChars : 24000;

  if (!prompt || prompt.length <= safeMaxChars) {
    return prompt;
  }

  const liteSections = [
    clipPromptSection(
      extractPromptSection(prompt, "### 1. LOCKED STORY CONTRACT", [
        "### 2. APPROVED STORY PLAN",
      ]),
      3200,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "### 2. APPROVED STORY PLAN", [
        "### 3. CURRENT PART TITLE & PURPOSE",
      ]),
      4200,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "### 3. CURRENT PART TITLE & PURPOSE", [
        "### 4. CURRENT PART SCENE CARDS ONLY",
      ]),
      4200,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "### 4. CURRENT PART SCENE CARDS ONLY", [
        "### 5. PREVIOUS APPROVED PARTS RECAP",
      ]),
      4300,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "### 5. PREVIOUS APPROVED PARTS RECAP", [
        "### 6. STYLE DNA",
      ]),
      1600,
    ),
    extractPromptSection(prompt, "### 6. STYLE DNA", [
      "### 7. SHAPED VOICE STYLE SAMPLE",
    ]),
    extractPromptSection(prompt, "### 7. SHAPED VOICE STYLE SAMPLE", [
      "### 8. MINIMAL HARD RULES",
    ]),
    extractPromptSection(prompt, "### 8. MINIMAL HARD RULES", [
      "=== CURRENT PART ANCHOR ===",
    ]),
    clipPromptSection(
      extractPromptSection(prompt, "=== CURRENT PART ANCHOR ===", [
        "=== FINAL RUNTIME WRITER CORE ===",
      ]),
      3600,
    ),
    extractPromptSection(prompt, "=== FINAL RUNTIME WRITER CORE ===", []),
  ].filter((section) => section.trim().length > 0);

  const structuredCompacted = liteSections.join(
    "\n\n[...LONG CONTEXT REMOVED TO STAY UNDER ANTHROPIC TPM LIMITS...]\n\n",
  );

  const compacted =
    structuredCompacted.length > 0 && structuredCompacted.length <= safeMaxChars
      ? structuredCompacted
      : `${prompt.slice(0, Math.floor(safeMaxChars * 0.36))}

[...SERVER-SIDE PROMPT COMPACTION: long reference/history sections were removed to stay under Anthropic TPM limits. Preserve current part, locked plan, scene cards, and runtime writer core...]

${prompt.slice(-Math.floor(safeMaxChars * 0.58))}`;

  console.warn(
    `[Anthropic] Prompt compacted from ${prompt.length} to ${compacted.length} characters.`,
  );
  return compacted;
}

async function generateClaudeContent(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required but missing.");
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
  const maxTokens = Number(process.env.ANTHROPIC_MAX_TOKENS || 5000);
  const finalPrompt = compactClaudePrompt(prompt);

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
      max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 5000,
      temperature: 0.7,
      messages: [{ role: "user", content: finalPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Anthropic Error] Direct API call failed with status ${response.status}:`, errText);
    const error: any = new Error(`Anthropic API call failed: ${errText}`);
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after");
    throw error;
  }

  const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
  if (data && data.content && data.content[0] && typeof data.content[0].text === "string") {
    console.log(`[Anthropic] Success with ${model}`);
    return data.content[0].text;
  }

  throw new Error("Invalid or empty response structure from Anthropic Claude API.");
}

function shouldFallbackFromClaudeToGemini(error: any): boolean {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    error?.status === 429 ||
    message.includes("rate_limit_error") ||
    message.includes("rate limit") ||
    message.includes("input tokens per minute") ||
    message.includes("output tokens per minute") ||
    message.includes("tokens per minute") ||
    message.includes("context_length_exceeded") ||
    message.includes("context length") ||
    message.includes("prompt is too long") ||
    message.includes("max_tokens") ||
    message.includes("token limit") ||
    message.includes("quota") ||
    message.includes("overloaded_error") ||
    message.includes("overloaded")
  );
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
      try {
        textOutput = await generateClaudeContent(runtimePrompt);
      } catch (anthropicError: any) {
        if (!shouldFallbackFromClaudeToGemini(anthropicError)) {
          throw anthropicError;
        }

        console.warn(
          "[Anthropic] Claude hit a token/rate/context limit. Falling back to Gemini 3.1 Pro Preview with Thinking HIGH for Script Writer.",
          anthropicError?.message || anthropicError,
        );
        textOutput = await generateContent(runtimePrompt, false, "script_writer");
      }
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
    const isRateLimit =
      error?.status === 429 ||
      String(errMsg).includes("rate_limit_error") ||
      String(errMsg).toLowerCase().includes("rate limit") ||
      String(errMsg).includes("input tokens per minute");

    return res.status(isRateLimit ? 429 : 500).json({
      success: false,
      error: isRateLimit ? `429 RATE_LIMIT: ${errMsg}` : errMsg,
      retryAfter: error?.retryAfter || null,
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
