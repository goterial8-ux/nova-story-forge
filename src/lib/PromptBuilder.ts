import { ProjectState, StageId, ScriptPart } from "../types";
import { clipForWriter, extractPartSlice } from "./partUtils";

const DEFAULT_SCRIPT_STYLE_RULES = `You are a YouTube manga/manhwa recap scriptwriter.

HARD STYLE CONSTRAINTS — apply these before writing anything else:
- Every sentence: maximum 10 words. No exceptions. If a sentence runs longer, split it into two.
- Every paragraph: 120-220 characters including spaces.
- One paragraph = one visual beat = 2-4 short sentences.
- Never write a sentence longer than 10 words.

Rhythm (follow this order inside every paragraph):
1. Situation — one short sentence.
2. Action or threat — one short sentence.
3. Reaction — one short sentence.
4. Result or new pressure — one short sentence.

Voice:
- First person when the scene follows the main character directly.
- Third person when showing enemy reactions, crowd, politics, or events outside the main character.

Language: English. Script language is English only.

Length:
- One command = one complete part.
- Normal part length: 12,000-15,000 characters including spaces, unless another range is given.
- Do not finish early.
- Each important planned event must be expanded through action, reaction, consequence, pressure, and payoff.
- Mentioning an event once is not enough. Show it fully.

What to write:
- Dramatic, visual, clear, emotional.
- Show hunger, danger, fear, humiliation, survival tension through action, not description.
- Use father, mother, family, poverty, debt, old wounds from the plan through action and situation.

What NOT to write:
- No sentence over 10 words.
- No literary prose for beauty only.
- No dry summaries or reports.
- No giant paragraphs.
- No broken placeholder words.

SENTENCE LENGTH EXAMPLES:

Wrong (too long):
"The collectors took our barley before the pot even cooled and left us one cracked bowl."
"Mio poured water over the last grain anyway and made the soup thin enough to reflect the roof beams."

Correct (10 words or fewer per sentence):
"The collectors came at dawn. They took the barley. They left one cracked bowl."
"Mio poured water over the last grain. The soup was thin. She set it between us anyway."

Wrong (too long):
"I did not go to the normal hunting woods because every hunter had stripped them clean over two bad seasons."

Correct:
"I did not go to the normal hunting woods. Every hunter had stripped them clean. Two bad seasons had done that."

Paragraph rhythm example (correct):
"The door opened. Three soldiers stepped in. I did not move. My hands stayed flat on the table."

Plan expansion:
- Do not turn the plan into a checklist.
- Each important planned event should become a sequence of beats.
- Show the situation, threat, what the character notices, what the character does, what changes, who reacts, what result appears, and what new pressure begins.
- Do not remove important background from the plan.
- If the plan mentions childhood, father, mother, family, poverty, debt, humiliation, training, fear, old wounds, personal failure, or past lessons, use it through action and situation.

Clean output rule:
- Do not output broken placeholder words or prompt residue.
- These words are allowed only when they naturally belong to the sentence: main, show, one, style, card, face, hook, exit.
- Never use them as broken placeholders, character-name replacements, uppercase residue, or random standalone fragments.

Bad examples:
Main turned around.
Show looked at me.
ONE string.
STYLE breathing too fast.
Card, clean water.
Leave. Now. Face.
Hook the deer shifted routes.
Exit spirits.

Good examples:
Mio turned around.
She looked at me.
One string hung loose from the bow.
I was breathing too fast.
The water was clean.
I had to leave now.
The deer shifted routes before a storm.
The old path led toward the exit.

Before sending the final script, silently scan the whole output.
If Main appears as a character name, replace it with the correct locked name.
If Show appears instead of she/her, rewrite the sentence.
If ONE, STYLE, Card, Face, Hook, or Exit appears as residue, rewrite that sentence naturally.

Do not output system messages.
Do not output provider error messages.
Do not output Chinese termination messages.
Do not change character names.
Output only clean script text.`;

function safe(value: unknown, fallback = "None"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function fillTemplate(template: string, state: ProjectState): string {
  return template
    .replaceAll("{{PROJECT_TITLE}}", safe(state.projectTitle))
    .replaceAll("{{IDEA_MODE}}", safe(state.ideaMode, "develop_raw_idea"))
    .replaceAll("{{RAW_IDEA}}", safe(state.rawIdea))
    .replaceAll("{{GENRE}}", safe(state.genre))
    .replaceAll("{{OUTPUT_LANGUAGE}}", "Russian")
    .replaceAll("{{TARGET_LENGTH}}", safe(state.targetLength))
    .replaceAll("{{STYLE_NOTES}}", safe(state.styleNotes))
    .replaceAll("{{FORBIDDEN_ELEMENTS}}", safe(state.forbiddenElements))
    .replaceAll("{{COMPETITOR_STYLE_NOTES}}", safe(state.competitors))
    .replaceAll("{{COMPETITOR_REFERENCE_EXAMPLES}}", clipForWriter(state.competitors || "None", 18000))
    .replaceAll("{{COMPETITOR_STYLE_BLUEPRINT}}", safe(state.styleDna))
    .replaceAll("{{GLOBAL_RULES}}", safe(state.promptRegistry?.globalRulesPrompt))
    .replaceAll("{{DEVELOPED_IDEA}}", safe(state.developedIdea))
    .replaceAll("{{STORY_CONTRACT}}", safe(state.storyContract))
    .replaceAll("{{CHARACTER_BIBLE}}", safe(state.characterBible))
    .replaceAll("{{STORY_PLAN}}", safe(state.storyPlan))
    .replaceAll("{{SCENE_CARDS}}", "Scene Cards are disabled for Script Writer. Use Story Plan only.")
    .replaceAll("{{CURRENT_PART_NUMBER}}", "None")
    .replaceAll("{{CURRENT_PART_PLAN}}", "None")
    .replaceAll("{{CURRENT_PART_TITLE}}", "None")
    .replaceAll("{{CURRENT_PART_SCENE_CARDS}}", "Scene Cards disabled.")
    .replaceAll("{{PREVIOUS_APPROVED_SCRIPT_PARTS_SUMMARY}}", "None")
    .replaceAll("{{REMAINING_PARTS_SUMMARY}}", "None")
    .replaceAll("{{AVATAR_COMMENTARY_SETTING}}", state.useAvatars ? "Enabled" : "Disabled")
    .replaceAll("{{AVATAR_COMMENTARY_MAP}}", state.useAvatars ? "Enabled" : "Disabled")
    .replaceAll("{{AVATAR_SLOT_FOR_CURRENT_PART}}", "None")
    .replaceAll("{{SCRIPT_FORMATTING_CONTRACT}}", "Use clean English voiceover text only.")
    .replaceAll("{{SUPERVISOR_NOTES}}", "None")
    .replaceAll("{{STAGE_ONE_HANDOFF}}", "Refer to the developed idea above.");
}

export function buildPrompt(stageId: StageId, state: ProjectState): string {
  switch (stageId) {
    case "idea_market":
      return fillTemplate(state.promptRegistry.stageZeroIdeaMarketPrompt || "", state) +
        "\n\n" + (state.promptRegistry.stageZeroIdeaMarketExampleResponse || "");

    case "raw_idea":
      return fillTemplate(state.promptRegistry.stageOneRawIdeaPrompt || "", state) +
        "\n\n" + (state.promptRegistry.stageOneExampleResponse || "");

    case "style_analyzer":
      return fillTemplate((state.promptRegistry as any).stageStyleAnalyzerPrompt || "", state) +
        "\n\n" + ((state.promptRegistry as any).stageStyleAnalyzerExampleResponse || "") +
        "\n\nIMPORTANT: Output the extracted Style DNA and analysis in Russian language.";

    case "story_dna":
      return fillTemplate(state.promptRegistry.stageTwoStoryDNAPrompt || "", state) +
        "\n\n" + (state.promptRegistry.stageTwoExampleResponse || "");

    case "story_plan":
      return fillTemplate(state.promptRegistry.stageThreeStoryPlanPrompt || "", state) +
        "\n\n" + (state.promptRegistry.stageThreeExampleResponse || "");

    case "scene_cards":
      return `Scene Cards stage is disabled for the simplified workflow.

Use the approved Story Plan directly for Script Writer.

If you need to continue, go to Script Writer and generate parts from the plan only.`;

    case "script_writer":
      return `Script Writer uses per-part generation only.

Click Sync Parts, select a part, confirm Current Part Plan, and press Generate Full Part.

Scene Cards are disabled for Script Writer.`;

    case "clean_export":
      return `You are the final clean export editor.

Do not rewrite the story.
Only assemble and lightly clean the approved script parts.
Remove technical residue, duplicate headings, debug text, placeholder words, and unfinished markers.
Output only the final clean English script.

FINAL SCRIPT:
${state.fullScript || "None"}

EXPORT SETTINGS:
${JSON.stringify(state.cleanExportSettings || {}, null, 2)}`;

    default:
      return "";
  }
}

function partPlanFor(partNumber: number, part?: ScriptPart, state?: ProjectState): string {
  const manual = String((part as any)?.manualPartPlan || "").trim();
  if (manual) return manual;

  const source = String((part as any)?.sourcePartPlan || "").trim();
  if (source) return source;

  const extracted = state ? extractPartSlice(state.storyPlan || "", partNumber).trim() : "";
  if (extracted) return extracted;

  return "[CURRENT PART PLAN IS EMPTY]";
}

function previousWrittenPartsContext(partNumber: number, state: ProjectState): string {
  const previousParts = state.scriptParts
    .filter((p) => p.partNumber < partNumber && p.draftText && p.draftText.trim().length > 0)
    .sort((a, b) => a.partNumber - b.partNumber);

  if (previousParts.length === 0) {
    return "None. This is the first written part.";
  }

  return previousParts
    .map((p) => {
      const paragraphs = p.draftText
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const opening = paragraphs.slice(0, 2).join(" ");
      const ending = paragraphs.slice(-3).join(" ");

      return [
        `Part ${p.partNumber}: ${p.partTitle}`,
        `Status: ${p.status}`,
        `Opening context: ${clipForWriter(opening, 450) || "Not available."}`,
        `Latest ending / continuity state: ${clipForWriter(ending, 900) || "Not available."}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function getLastApprovedPartVoiceAnchor(state: ProjectState, partNumber: number): string {
  // Use any written part — prefer approved, fall back to latest generated
  const previousParts = state.scriptParts
    .filter(
      (p) =>
        p.partNumber < partNumber &&
        p.draftText &&
        p.draftText.trim().length > 0,
    )
    .sort((a, b) => a.partNumber - b.partNumber);

  if (previousParts.length === 0) return "";

  const approvedParts = previousParts.filter((p) => p.status === "approved");
  const lastApproved = approvedParts.length > 0
    ? approvedParts[approvedParts.length - 1]
    : previousParts[previousParts.length - 1];

  const paragraphs = lastApproved.draftText
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const lastContent = paragraphs.slice(-5).join(" ").slice(-500);
  const lastSentence = paragraphs[paragraphs.length - 1]?.slice(-150) || "";

  return [
    `VOICE ANCHOR — match sentence rhythm and length from Part ${lastApproved.partNumber} "${lastApproved.partTitle}":`,
    `"${lastContent}"`,
    "",
    `LAST SENTENCE OF PREVIOUS PART: "${lastSentence}"`,
    "",
    "IMPORTANT: Every sentence must be 10 words or fewer. Match paragraph rhythm exactly. This is your writing standard.",
  ].join("\n");
}

function buildSceneAnchorsFromPlan(currentPartPlan: string): string {
  if (!currentPartPlan || !currentPartPlan.trim()) return "";

  const sceneBlocks = currentPartPlan.split(/(?=^(?:Scene|SCENE|Scene |SCENE )?\d)/m);
  const anchors: string[] = [];

  for (let i = 0; i < sceneBlocks.length; i++) {
    const block = sceneBlocks[i].trim();
    if (!block || block.length < 30) continue;

    const firstLine = block.split("\n")[0].trim();
    const bodyLines = block.split("\n").slice(1).join("\n").trim();
    if (!bodyLines || bodyLines.length < 20) continue;

    const lastSentence = bodyLines.match(/[^.!?]*[.!?]\s*$/)?.[0] || bodyLines.slice(-120).trim();
    const sceneNumber = i + 1;

    anchors.push(
      `SCENE ${sceneNumber} ANCHOR — Goal: ${firstLine.slice(0, 120)} | Last sentence from previous scene: "${lastSentence.slice(0, 120)}"`,
    );
  }

  if (anchors.length === 0) return "";

  return [
    "",
    "=== SCENE ANCHORS (apply to each scene in order) ===",
    anchors.join("\n"),
    "Apply each anchor before writing its scene. Match the voice anchor above. Keep first-person, short sentences, 120-220 char paragraphs.",
  ].join("\n");
}

export function buildPartPrompt(partNumber: number, state: ProjectState): string {
  const part = state.scriptParts.find((p) => p.partNumber === partNumber);
  const partTitle = part?.partTitle || `Part ${partNumber}`;
  const currentPartPlan = partPlanFor(partNumber, part, state);
  const manualStyleRules = String((part as any)?.manualStyleRules || "").trim();
  const manualExtraInstruction = String((part as any)?.manualExtraInstruction || "").trim();
  const manualTargetChars = String((part as any)?.manualTargetChars || "12,000-15,000 characters including spaces").trim();
  const previousContext = previousWrittenPartsContext(partNumber, state);
  const voiceAnchor = getLastApprovedPartVoiceAnchor(state, partNumber);
  const sceneAnchors = buildSceneAnchorsFromPlan(currentPartPlan);
  const characterNames = String(state.characterNames || state.lockedCharacterNames || "").trim();

  return `${characterNames ? `=== LOCKED CHARACTER NAMES — MEMORIZE BEFORE WRITING ===\n${characterNames}\nNever substitute character names with Main, Show, Hook, Card, Style, Face, Exit, or any prompt word.\nBefore outputting: scan for these words and replace with correct names.\n\n` : ""}=== STYLE RULES — READ BEFORE WRITING ANYTHING ===
${manualStyleRules || DEFAULT_SCRIPT_STYLE_RULES}

=== PART TO WRITE ===
Part ${partNumber} — ${partTitle}

Target length: ${manualTargetChars}

${voiceAnchor ? `=== VOICE ANCHOR ===\n${voiceAnchor}\n` : ""}
=== CURRENT PART PLAN ===
${currentPartPlan}

${sceneAnchors ? `${sceneAnchors}\n` : ""}
=== PREVIOUS WRITTEN PARTS CONTEXT ===
${previousContext}

Use previous parts only as continuity memory. Do not rewrite them in the answer.

=== EXTRA INSTRUCTION ===
${manualExtraInstruction || "No extra instruction."}

=== COMMAND ===
Write the full Part ${partNumber}.
Use ONLY Current Part Plan as the foundation.
Do not use Scene Cards. Do not mention Scene Cards.
Follow the style rules and target length.

FINAL CHECK before outputting:
- Scan your first 10 sentences. Does any sentence exceed 10 words? Split it.
- Scan your paragraphs. Is any paragraph over 220 characters? Break it.
- Fix any placeholder residue (Main, Show, ONE, STYLE, Card, Face, Hook, Exit).

Output only the finished clean script text in English.`;
}

export function buildSupervisorPrompt(
  stageId: StageId,
  output: string,
  state: ProjectState,
): string {
  return `=== AI SUPERVISOR ===
Analyze the output for the current stage.

For Script Writer, judge only the actual script text. Scene Cards are disabled; do not require them.
For Script Writer, check:
- follows the current part plan;
- complete part, not a short summary;
- clean English manga/manhwa recap voiceover;
- no broken placeholder residue such as Main/Show/ONE/STYLE/Card/Face/Hook/Exit used incorrectly;
- no provider/system messages;
- no unfinished ending.

Return exactly this format in Russian:
status: (ok | needs_small_repair | needs_serious_repair | do_not_continue)
whatIsGood: ...
problems: ...
requiredFixes: ...
recommendation: ...
canContinue: (true | false)

STAGE: ${stageId}

LOCKED STORY PLAN:
${clipForWriter(state.storyPlan || "None", 12000)}

OUTPUT TO CHECK:
${output}`;
}

export function buildRepairPrompt(
  stageId: StageId,
  brokenOutput: string,
  report: any,
  state: ProjectState,
  partNumber?: number,
): string {
  const currentPartPlan = partNumber ? partPlanFor(partNumber, state.scriptParts.find((p) => p.partNumber === partNumber), state) : "None";
  const lang = stageId === "script_writer" || stageId === "clean_export" ? "English" : "Russian";

  return `=== TARGETED REPAIR ===
Repair the output without changing the approved story facts.

For Script Writer repairs:
- Use ONLY the Current Part Plan.
- Do not use Scene Cards.
- Preserve plot, names, part order, and continuity.
- Remove broken placeholder residue.
- If Main is used as a character name, replace it with the correct locked character name.
- If Show is used instead of she/her, rewrite the sentence.
- If ONE, STYLE, Card, Face, Hook, or Exit appears as residue, rewrite that sentence naturally.
- Output only clean script text.

CURRENT PART PLAN:
${currentPartPlan}

BROKEN OUTPUT:
${brokenOutput}

SUPERVISOR REPORT:
${JSON.stringify(report || {}, null, 2)}

Output the repaired version in ${lang}.`;
}

export function buildSoftCleanupPrompt(
  brokenOutput: string,
  report: any,
): string {
  return `=== SOFT CLEANUP ===
Clean the script text only. Do not change the plot.

Remove broken placeholder residue, debug text, provider messages, duplicated fragments, and awkward paragraph breaks.
Do not use Scene Cards.
Output only clean English script text.

SUPERVISOR REPORT:
${JSON.stringify(report || {}, null, 2)}

BROKEN OUTPUT:
${brokenOutput}`;
}

export function buildRebuildPrompt(
  partNumber: number,
  state: ProjectState,
  report: any,
): string {
  const part = state.scriptParts.find((p) => p.partNumber === partNumber);
  const partTitle = part?.partTitle || `Part ${partNumber}`;
  const currentPartPlan = partPlanFor(partNumber, part, state);
  const voiceAnchor = getLastApprovedPartVoiceAnchor(state, partNumber);
  const sceneAnchors = buildSceneAnchorsFromPlan(currentPartPlan);

  return `=== FULL PART REBUILD ===
The previous attempt failed. Discard that failed version.

Write a new clean version from scratch using ONLY the Current Part Plan.
Do not use Scene Cards.
Do not mention Scene Cards.
Do not import future events.
Do not change character names.
Remove any broken placeholder residue before final output.

Part:
Part ${partNumber} — ${partTitle}

CURRENT PART PLAN:
${currentPartPlan}

REJECTION REPORT:
${JSON.stringify(report || {}, null, 2)}

${voiceAnchor}

${sceneAnchors}

STYLE RULES:
${DEFAULT_SCRIPT_STYLE_RULES}

Output only the finished clean English script text.`;
}

export function isOutputTruncated(text: string): boolean {
  if (!text || text.length < 200) return false;
  const lastChars = text.slice(-50).trim();
  if (!lastChars) return false;
  const sentenceEnders = /[.!?…—–:;"'»»"]/;
  const lastSentenceComplete = sentenceEnders.test(lastChars);
  const isBrokenWord = /[a-zA-Z]{2,}$/.test(lastChars) && lastChars.split(/\s+/).length <= 2;
  return !lastSentenceComplete || isBrokenWord;
}

function extractLastCompleteParagraph(text: string): string {
  if (!text) return "";
  const paragraphs = text.split(/\n{2,}/);
  if (paragraphs.length < 2) return text;
  return paragraphs[paragraphs.length - 1].trim();
}

function findLastSentence(text: string): string {
  if (!text) return "";
  const allSentences = text.match(/[^.!?]*[.!?]+/g);
  if (!allSentences || allSentences.length === 0) return text.slice(-150);
  return (allSentences[allSentences.length - 1] || "").trim();
}

export function buildContinuationPrompt(
  brokenText: string,
  partNumber: number,
  state: ProjectState,
): string {
  const part = state.scriptParts.find((p) => p.partNumber === partNumber);
  const partTitle = part?.partTitle || `Part ${partNumber}`;
  const currentPartPlan = partPlanFor(partNumber, part, state);
  const previousContext = previousWrittenPartsContext(partNumber, state);
  const voiceAnchor = getLastApprovedPartVoiceAnchor(state, partNumber);
  const sceneAnchors = buildSceneAnchorsFromPlan(currentPartPlan);
  const lastParagraph = extractLastCompleteParagraph(brokenText);
  const lastSentence = findLastSentence(brokenText);

  return `You are a YouTube manga/manhwa recap scriptwriter.

CONTINUE WRITING THE CURRENT PART.
The previous generation was interrupted. Continue from where it stopped.

Part:
Part ${partNumber} — ${partTitle}

=== LAST COMPLETE PARAGRAPH (do not rewrite, continue from here) ===
${lastParagraph}

=== LAST SENTENCE BEFORE INTERRUPTION ===
"${lastSentence}"

=== CURRENT PART PLAN ===
${currentPartPlan}

=== PREVIOUS WRITTEN PARTS CONTEXT ===
${previousContext}

${voiceAnchor}

${sceneAnchors}

=== STYLE RULES (hard standard — follow exactly) ===
- First person when following the main character
- Paragraphs: 120-220 characters
- Sentences: max 12 words
- No literary monologue, no report tone, no dry summary
- Rhythm: pressure -> action -> reaction -> result -> new pressure
- Output only English script text

Command:
Continue writing Part ${partNumber} from the last complete paragraph shown above.
Do not repeat or rephrase the last paragraph.
Start with what logically follows the last sentence.
Match the voice anchor and style rules exactly.
Output only the continuation in English.`;
}
