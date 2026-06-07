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

let latestSceneCardsText = "";

const SCRIPT_WRITER_RUNTIME_CORE = `
=== FINAL RUNTIME WRITER CORE ===
This is the last and strongest instruction for Script Writer.

Write the current part as an English manga/manhwa recap script.
Use the approved Story Plan and Current Part Plan as the only source of truth.
Scene Cards are disabled. Do not ask for Scene Cards. Do not mention Scene Cards.
Treat the response as the exact body of a plain .txt file for the current script part.
Do not describe the file, do not provide a filename, do not wrap the answer in a code block, and do not write any explanation before or after the script text.

Paragraph and part length reminder:
- every normal narrator paragraph should target 120-220 characters including spaces;
- 120-220 characters is usually about 22-40 English words;
- the best target is 26-34 words per paragraph, around 150-190 characters.

Hard length lock:
- for a nine-part script targeting 120,000-130,000 total characters, each part should be 12,500-14,500 characters including spaces;
- absolute maximum per part: 15,000 characters including spaces;
- never exceed 15,000 characters for one part;
- when the current part reaches about 14,000 characters, finish the active beat and stop;
- do not continue beyond the current part plan;
- do not expand previous recap into new narration;
- do not become decorative or literary just to increase length;
- do not stop too early, but never exceed the hard maximum for the current part.

Recap style:
- action must be followed by reaction;
- write in simple voiceover prose;
- use first person for the protagonist's direct experience;
- use third person only when outside visibility is needed;
- do not write like a report, science explainer, or literary monologue;
- every major planned beat must show a visible problem, practical action, concrete result, reaction, and new pressure.

For every part:
- identify the requested current part number and title from the prompt, then write only that part;
- follow the Current Part Plan in order;
- build a private name ledger from the story contract and current part plan, then use exact spellings only;
- never rename characters, places, organizations, tools, foods, debts, guilds, or antagonists mid-script;
- preserve the first-person manga/manhwa recap rhythm: direct, visual, practical, and emotionally pressured;
- make each beat visual: problem, detail noticed, action, consequence, reaction, payoff, new pressure;
- make allies useful and enemies reactive, not stupid;
- include micro-turns: cost, failed attempt, doubt, enemy adaptation, resource loss, public reaction, or a new problem;
- end with a payoff or a forward hook.

Before writing, silently check:
1. current part plan only;
2. exact name ledger from the story contract and current plan;
3. previous continuity summary;
4. voice anchor and last previous line if provided;
5. plan beat anchors if provided;
6. paragraph rhythm;
7. hard length maximum;
8. manga/manhwa recap voice.

Forbidden output:
- no analysis, checklist, QA report, markdown table, bullet list, scene labels, or debug notes;
- no academic/clinical/technical report tone;
- no generic "little did I know" or empty destiny prose;
- no copying reference plots, names, scenes, powers, or twists;
- no Cyrillic words, mixed Cyrillic/Latin words, broken foreign words, or accidental untranslated words inside English script paragraphs;
- no broken placeholder residue such as Main, Show, ONE, STYLE, Card, Face, Hook, or Exit used incorrectly.

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
      "Local pass. Only Story Plan is the blocking quality gate for the plan-only Script Writer workflow.",
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

const PART_NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  один: 1,
  два: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  первая: 1,
  вторая: 2,
  третья: 3,
  четвертая: 4,
  четвёртая: 4,
  пятая: 5,
  шестая: 6,
  седьмая: 7,
  восьмая: 8,
  девятая: 9,
  десятая: 10,
};

const PART_TOKEN_PATTERN = [
  "three",
  "seven",
  "eight",
  "four",
  "five",
  "nine",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "one",
  "two",
  "six",
  "ten",
  "viii",
  "vii",
  "iii",
  "iv",
  "vi",
  "ix",
  "ii",
  "i",
  "v",
  "x",
  "один",
  "два",
  "три",
  "четыре",
  "пять",
  "шесть",
  "семь",
  "восемь",
  "девять",
  "десять",
  "первая",
  "вторая",
  "третья",
  "четвертая",
  "четвёртая",
  "пятая",
  "шестая",
  "седьмая",
  "восьмая",
  "девятая",
  "десятая",
  "\\d+",
].join("|");

function parsePartNumberToken(token: string): number {
  const normalized = token.trim().toLowerCase();
  return PART_NUMBER_WORDS[normalized] || parseInt(normalized, 10) || 0;
}

function detectCurrentPartNumber(prompt: string): number {
  const directPatterns = [
    /Begin drafting the text for Part\s+(\d+)/i,
    /Write the full voiceover draft for Part\s+(\d+)/i,
    /Current Part Number:\s*(\d+)/i,
    /Part\s+(\d+)\s*:/i,
  ];

  for (const pattern of directPatterns) {
    const match = prompt.match(pattern);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (parsed > 0) return parsed;
    }
  }

  const wordMatch = prompt.match(
    new RegExp(`Begin drafting the text for Part\\s+(${PART_TOKEN_PATTERN})`, "i"),
  );
  if (wordMatch) {
    return parsePartNumberToken(wordMatch[1]);
  }

  return 0;
}

function extractPartSectionByNumber(text: string, partNumber: number): string {
  if (!text || !partNumber) return "";

  const headingRegex = new RegExp(
    `(?:^|\\n)([ \\t]*(?:(?:${PART_TOKEN_PATTERN})\\.\\s*)?(?:part|часть)\\s+(${PART_TOKEN_PATTERN})\\b[^\\n]*)`,
    "gi",
  );
  const headings: Array<{ index: number; number: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(text)) !== null) {
    const number = parsePartNumberToken(match[2]);
    if (!number) continue;

    const lineOffset = match[0].startsWith("\n") ? 1 : 0;
    headings.push({ index: match.index + lineOffset, number });
  }

  const currentIndex = headings.findIndex((h) => h.number === partNumber);
  if (currentIndex < 0) return "";

  const start = headings[currentIndex].index;
  const next = headings
    .slice(currentIndex + 1)
    .find((h) => h.number !== partNumber);
  return text.slice(start, next ? next.index : text.length).trim();
}

function isWeakCurrentSceneCardsSection(section: string): boolean {
  const lower = section.toLowerCase();
  return (
    section.trim().length < 220 ||
    lower.includes("scenes for part") ||
    lower.includes("scenes for ") ||
    lower.includes("no scene cards specified")
  );
}

function replacePromptSection(
  prompt: string,
  startMarker: string,
  endMarkers: string[],
  replacement: string,
): string {
  const current = extractPromptSection(prompt, startMarker, endMarkers);
  if (!current) return prompt;
  return prompt.replace(current, replacement.trim());
}

function hydrateCurrentPartContext(prompt: string): string {
  const partNumber = detectCurrentPartNumber(prompt);
  if (!partNumber) {
    return prompt;
  }

  if (
    prompt.includes("Current Part Plan Slice:") ||
    prompt.includes("### 2. CURRENT PART PLAN SLICE ONLY")
  ) {
    // Already hydrated by the frontend or a newer PromptBuilder.
  } else {
    const storyPlan = extractPromptSection(prompt, "### 2. APPROVED STORY PLAN", [
      "### 3. CURRENT PART TITLE & PURPOSE",
    ]);
    const partPlan = extractPartSectionByNumber(storyPlan, partNumber);
    if (partPlan) {
      console.warn(`[Server Prompt Hydration] Injected current Part ${partNumber} plan slice before Claude compaction.`);
      prompt = prompt.replace(
        "### 4. CURRENT PART SCENE CARDS ONLY",
        `Current Part Plan Slice:\n${clipPromptSection(partPlan, 5200)}\n\n### 4. CURRENT PART SCENE CARDS ONLY`,
      );
    }
  }

  const currentSceneCardsSection = extractPromptSection(prompt, "### 4. CURRENT PART SCENE CARDS ONLY", [
    "### 5. PREVIOUS APPROVED PARTS RECAP",
  ]);
  const hasWeakSceneCards = currentSceneCardsSection && isWeakCurrentSceneCardsSection(currentSceneCardsSection);

  if (hasWeakSceneCards && latestSceneCardsText) {
    const extractedSceneCards = extractPartSectionByNumber(
      latestSceneCardsText,
      partNumber,
    );

    if (extractedSceneCards) {
      console.warn(`[Server Prompt Hydration] Replaced weak Part ${partNumber} scene-card placeholder with cached Stage Four scene cards.`);
      prompt = replacePromptSection(
        prompt,
        "### 4. CURRENT PART SCENE CARDS ONLY",
        ["### 5. PREVIOUS APPROVED PARTS RECAP"],
        `### 4. CURRENT PART SCENE CARDS ONLY\n${clipPromptSection(extractedSceneCards, 7000)}`,
      );
    }
  }

  return prompt;
}

function compactClaudePrompt(prompt: string): string {
  prompt = hydrateCurrentPartContext(prompt);
  const maxChars = Number(process.env.ANTHROPIC_MAX_INPUT_CHARS || 24000);
  const safeMaxChars =
    Number.isFinite(maxChars) && maxChars >= 12000 ? maxChars : 24000;

  if (!prompt || prompt.length <= safeMaxChars) {
    return prompt;
  }

  const modernSections = [
    clipPromptSection(
      extractPromptSection(prompt, "Part:", ["Target length:"]),
      700,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "Target length:", ["=== CURRENT PART PLAN ==="]),
      300,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "=== CURRENT PART PLAN ===", [
        "=== PREVIOUS WRITTEN PARTS CONTEXT ===",
      ]),
      6200,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "=== PREVIOUS WRITTEN PARTS CONTEXT ===", [
        "VOICE ANCHOR",
        "=== PLAN BEAT ANCHORS ===",
        "=== STYLE RULES ===",
      ]),
      1700,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "VOICE ANCHOR", [
        "=== PLAN BEAT ANCHORS ===",
        "=== STYLE RULES ===",
      ]),
      1100,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "=== PLAN BEAT ANCHORS ===", [
        "=== STYLE RULES ===",
      ]),
      2400,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "=== STYLE RULES ===", [
        "=== EXTRA INSTRUCTION ===",
      ]),
      5200,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "=== EXTRA INSTRUCTION ===", [
        "Command:",
      ]),
      1200,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "Command:", [
        "=== FINAL RUNTIME WRITER CORE ===",
      ]),
      900,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "=== FINAL RUNTIME WRITER CORE ===", []),
      4200,
    ),
  ].filter((section) => section.trim().length > 0);

  const legacySections = [
    clipPromptSection(
      extractPromptSection(prompt, "### 2. CURRENT PART PLAN SLICE ONLY", [
        "### 3. CURRENT PART TITLE & PURPOSE",
      ]),
      4500,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "### 5. PREVIOUS APPROVED PARTS RECAP", [
        "### 6. STYLE DNA",
      ]),
      1000,
    ),
    clipPromptSection(
      extractPromptSection(prompt, "=== FINAL RUNTIME WRITER CORE ===", []),
      4200,
    ),
  ].filter((section) => section.trim().length > 0);

  const selectedSections = modernSections.length >= 3 ? modernSections : legacySections;
  const structuredCompacted = selectedSections.join("\n\n[...LONG CONTEXT REMOVED TO STAY UNDER PROVIDER INPUT LIMITS...]\n\n");

const compacted =
    structuredCompacted.length > 0 && structuredCompacted.length <= safeMaxChars
      ? structuredCompacted
      : `${prompt.slice(0, Math.floor(safeMaxChars * 0.42))}

[...SERVER-SIDE PROMPT COMPACTION: long context was removed. Preserve Current Part Plan, Style Rules, Plan Beat Anchors, Voice Anchor, and Runtime Writer Core...]

${prompt.slice(-Math.floor(safeMaxChars * 0.54))}`;

  console.warn(
    `[Anthropic] Prompt compacted from ${prompt.length} to ${compacted.length} characters.`,
  );
  return compacted;
}

type ScriptWriterProvider =
  | "gemini"
  | "claude_compatible"
  | "aiprimetech"
  | "tkbk"
  | "anthropic"
  | "claude";

function normalizeWriterProvider(value: unknown): ScriptWriterProvider {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "gemini") return "gemini";
  if (
    normalized === "claude_compatible" ||
    normalized === "claude-compatible" ||
    normalized === "compatible"
  ) {
    return "claude_compatible";
  }
  if (normalized === "aiprimetech" || normalized === "ai_prime" || normalized === "ai-prime") {
    return "aiprimetech";
  }
  if (normalized === "tkbk") return "tkbk";
  if (normalized === "anthropic") return "anthropic";
  if (normalized === "claude") return "claude";

  return "gemini";
}

function extractClaudeText(data: any): string {
  const text = Array.isArray(data?.content)
    ? data.content
        .map((item: any) => (typeof item?.text === "string" ? item.text : ""))
        .join("")
        .trim()
    : "";

  if (!text) {
    throw new Error("Claude-compatible API returned empty text.");
  }

  return text;
}

function getClaudeCompatibleApiKey(): string {
  return (
    process.env.CLAUDE_COMPAT_API_KEY ||
    process.env.TKBK_API_KEY ||
    ""
  ).trim();
}

function getClaudeCompatibleBaseUrl(): string {
  return (
    process.env.CLAUDE_COMPAT_BASE_URL ||
    process.env.TKBK_BASE_URL ||
    "https://api.tkbk.io"
  ).replace(/\/$/, "");
}

function getClaudeCompatibleEndpoint(): string {
  const explicitEndpoint =
    process.env.CLAUDE_COMPAT_MESSAGES_ENDPOINT ||
    process.env.TKBK_CLAUDE_ENDPOINT;

  if (explicitEndpoint) {
    return explicitEndpoint;
  }

  const baseUrl = getClaudeCompatibleBaseUrl();

  if (baseUrl.includes("api.tkbk.io")) {
    return `${baseUrl}/claude/v1/messages`;
  }

  return `${baseUrl}/messages`;
}

function getClaudeWriterModel(modelOverride?: string): string {
  return (
    modelOverride ||
    process.env.CLAUDE_COMPAT_MODEL ||
    process.env.CLAUDE_WRITER_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    "claude-sonnet-4-6"
  );
}

function getClaudeWriterMaxTokens(defaultValue = 8000): number {
  const configured = Number(
    process.env.CLAUDE_COMPAT_MAX_TOKENS ||
      process.env.CLAUDE_WRITER_MAX_TOKENS ||
      process.env.ANTHROPIC_MAX_TOKENS ||
      defaultValue,
  );

  return Number.isFinite(configured) && configured > 0
    ? configured
    : defaultValue;
}

async function generateClaudeCompatibleContent(
  prompt: string,
  modelOverride?: string,
): Promise<string> {
  const apiKey = getClaudeCompatibleApiKey();
  if (!apiKey) {
    throw new Error("CLAUDE_COMPAT_API_KEY or TKBK_API_KEY environment variable is required but missing.");
  }

  const model = getClaudeWriterModel(modelOverride);
  const maxTokens = getClaudeWriterMaxTokens(8000);
  const endpoint = getClaudeCompatibleEndpoint();
  const finalPrompt = compactClaudePrompt(prompt);

  console.log(`[Claude Compatible] Requesting ${endpoint} with model ${model}...`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      system:
        "You are Nova, a strict first-person manga/manhwa recap script writer. Follow the user prompt exactly and output only usable script text.",
      messages: [{ role: "user", content: finalPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Claude Compatible Error] API call failed with status ${response.status}:`, errText);
    const error: any = new Error(`Claude-compatible API call failed: ${errText}`);
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after");
    throw error;
  }

  const data = await response.json();
  const text = extractClaudeText(data);
  console.log(`[Claude Compatible] Success with ${model}`);
  return text;
}

async function generateClaudeContent(prompt: string, modelOverride?: string): Promise<string> {
  if (getClaudeCompatibleApiKey()) {
    return generateClaudeCompatibleContent(prompt, modelOverride);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY, CLAUDE_COMPAT_API_KEY, or TKBK_API_KEY environment variable is required but missing.");
  }

  const model = modelOverride || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
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
  const text = extractClaudeText(data);
  console.log(`[Anthropic] Success with ${model}`);
  return text;
}

async function generateTkbkClaudeContent(
  prompt: string,
  modelOverride?: string,
): Promise<string> {
  return generateClaudeCompatibleContent(prompt, modelOverride);
}

function isScriptHeading(block: string): boolean {
  return /^\s*(?:part|chapter)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(block);
}

function mergeShortScriptParagraphs(text: string): string {
  const minChars = 115;
  const maxMergedChars = 235;
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  const merged: string[] = [];

  for (const block of blocks) {
    if (isScriptHeading(block)) {
      merged.push(block);
      continue;
    }

    const previous = merged[merged.length - 1];
    const canMergeWithPrevious =
      previous &&
      !isScriptHeading(previous) &&
      (previous.length < minChars || block.length < minChars) &&
      `${previous} ${block}`.length <= maxMergedChars;

    if (canMergeWithPrevious) {
      merged[merged.length - 1] = `${previous} ${block}`;
    } else {
      merged.push(block);
    }
  }

  return merged.join("\n\n");
}

function fixKnownMixedAlphabetArtifacts(text: string): string {
  return text
    .replace(/\bt\u0435\u043b\u0435\u0436\u043a\u0430\b/gi, "cart")
    .replace(/\b\u0442\u0435\u043b\u0435\u0436\u043a\u0430\b/gi, "cart");
}

const NAME_STOPWORDS = new Set([
  "Main", "Show", "Ready", "Hook", "PART", "WRITER", "STYLE", "Card", "Face", "Exit",
  "Action", "After", "Again", "All", "And", "Anchor", "Approved", "Before",
  "Cards", "Character", "Characters", "Chapter", "Claude", "Clean", "Contract",
  "Current", "English", "Every", "Final", "Forbidden", "From", "Generate",
  "Genre", "Hard", "High", "Into", "Locked", "Manga", "Manhwa", "Minimal",
  "Only", "Output", "Paragraph", "Part", "Plan", "Previous", "Prompt", "Recap",
  "Rules", "Runtime", "Scene", "Scenes", "Script", "Section", "Source", "Stage",
  "Story", "Style", "The", "This", "Title", "Use", "Voice", "Writer", "Write",
  "Writing", "You", "Your",
]);

function extractNameLedger(prompt: string): string[] {
  const counts = new Map<string, number>();
  const matches = prompt.match(/\b[A-Z][a-zA-Z]{2,15}\b/g) || [];

  for (const token of matches) {
    if (NAME_STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([token]) => token);
}

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

function normalizeNameVariants(text: string, prompt: string): string {
  const ledger = extractNameLedger(prompt);
  if (ledger.length === 0) return text;

  const ledgerSet = new Set(ledger);
  return text.replace(/\b[A-Z][a-zA-Z]{2,15}\b/g, (token) => {
    if (ledgerSet.has(token) || NAME_STOPWORDS.has(token)) return token;

    let bestMatch = "";
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const name of ledger) {
      if (name[0] !== token[0]) continue;
      if (Math.abs(name.length - token.length) > 2) continue;
      const distance = editDistance(token.toLowerCase(), name.toLowerCase());
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = name;
      }
    }

    return bestMatch && bestDistance <= 2 ? bestMatch : token;
  });
}

function normalizeScriptWriterOutput(text: string, prompt: string): string {
  const normalized = mergeShortScriptParagraphs(
    normalizeNameVariants(fixKnownMixedAlphabetArtifacts(text), prompt),
  );

  if (normalized !== text) {
    console.log(
      `[Script Writer Postprocess] Normalized output from ${text.length} to ${normalized.length} chars.`,
    );
  }

  return normalized;
}

// Unified generate/RPC route
async function handleGenerate(req: express.Request, res: express.Response) {
  console.log("POST /api/generate called");
  const { prompt, type, stageId, writerProvider, writerModel } = req.body;

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
    const configuredWriterProvider =
      writerProvider ||
      process.env.CLAUDE_WRITER_PROVIDER ||
      process.env.SCRIPT_WRITER_PROVIDER ||
      (process.env.CLAUDE_COMPAT_API_KEY || process.env.TKBK_API_KEY
        ? "claude_compatible"
        : process.env.ANTHROPIC_API_KEY
          ? "anthropic"
          : "claude_compatible");
    const selectedWriterProvider = normalizeWriterProvider(
      configuredWriterProvider,
    );
    const isScriptWriterStage =
      !isSupervisor && stageId === "script_writer";

    if (isScriptWriterStage && selectedWriterProvider === "gemini") {
      const configError: any = new Error(
        "Script Writer is locked to a Claude-compatible provider. Set CLAUDE_WRITER_PROVIDER=claude_compatible and CLAUDE_COMPAT_API_KEY, or use TKBK_API_KEY / ANTHROPIC_API_KEY. Gemini fallback is disabled for script writing.",
      );
      configError.status = 400;
      throw configError;
    }

    const shouldUseClaudeScriptWriter =
      isScriptWriterStage && selectedWriterProvider !== "gemini";
    const shouldUseClaudeCompatible =
      shouldUseClaudeScriptWriter &&
      (selectedWriterProvider === "claude_compatible" ||
        selectedWriterProvider === "aiprimetech" ||
        selectedWriterProvider === "tkbk" ||
        ((selectedWriterProvider === "claude" ||
          selectedWriterProvider === "anthropic") &&
          !!getClaudeCompatibleApiKey()));

    const runtimePrompt =
      !isSupervisor && stageId === "script_writer"
        ? `${prompt}\n\n${SCRIPT_WRITER_RUNTIME_CORE}`
        : prompt;

    if (shouldUseClaudeScriptWriter) {
      try {
        textOutput = shouldUseClaudeCompatible
          ? await generateClaudeCompatibleContent(runtimePrompt, writerModel)
          : await generateClaudeContent(runtimePrompt, writerModel);
      } catch (claudeError: any) {
        console.warn(
          "[Claude Writer] Claude-compatible API failed. Gemini fallback is disabled for Script Writer; stopping generation.",
          claudeError?.message || claudeError,
        );
        throw claudeError;
      }
    } else {
      textOutput = await generateContent(runtimePrompt, isSupervisor, isSupervisor ? "supervisor" : stageId);
    }

    if (!isSupervisor && stageId === "script_writer") {
      textOutput = normalizeScriptWriterOutput(textOutput, runtimePrompt);
    }

    if (!isSupervisor && stageId === "scene_cards" && textOutput.trim().length > 0) {
      latestSceneCardsText = textOutput;
      console.log(`[Server Context Cache] Cached Stage Four scene cards (${latestSceneCardsText.length} chars) for Script Writer hydration.`);
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
