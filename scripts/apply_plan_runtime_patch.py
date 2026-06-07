from pathlib import Path
import re

root = Path.cwd()
server_path = root / "server.ts"
prompt_builder_src = Path(__file__).resolve().parents[1] / "src" / "lib" / "PromptBuilder.ts"
prompt_builder_dst = root / "src" / "lib" / "PromptBuilder.ts"

if not server_path.exists():
    raise SystemExit("server.ts not found. Run this script from the repository root.")
if not prompt_builder_dst.exists():
    raise SystemExit("src/lib/PromptBuilder.ts not found. Run this script from the repository root.")

prompt_builder_dst.write_text(prompt_builder_src.read_text(encoding="utf-8"), encoding="utf-8")

server = server_path.read_text(encoding="utf-8")

new_runtime_core = r'''const SCRIPT_WRITER_RUNTIME_CORE = `
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
`;'''

server = re.sub(
    r"const SCRIPT_WRITER_RUNTIME_CORE = `.*?`;",
    new_runtime_core,
    server,
    count=1,
    flags=re.S,
)

new_compact = r'''function compactClaudePrompt(prompt: string): string {
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
  const structuredCompacted = selectedSections.join(
    "\n\n[...LONG CONTEXT REMOVED TO STAY UNDER PROVIDER INPUT LIMITS...]\n\n",
  );

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
}'''

server = re.sub(
    r"function compactClaudePrompt\(prompt: string\): string \{.*?\n\}",
    new_compact,
    server,
    count=1,
    flags=re.S,
)

server = server.replace(
    "Only Story Plan and Scene Cards are blocking quality gates.",
    "Only Story Plan is the blocking quality gate for the plan-only Script Writer workflow.",
)

server_path.write_text(server, encoding="utf-8")

print("Patched src/lib/PromptBuilder.ts and server.ts successfully.")
