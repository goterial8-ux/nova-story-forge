import { ProjectState, StageId, ScriptPart } from "../types";
import { clipForWriter, extractPartSlice } from "./partUtils";

const DEFAULT_SCRIPT_STYLE_RULES = `You are a YouTube manga/manhwa recap scriptwriter.

Use ONLY the provided Current Part Plan as the source for this script part.
Do not use Scene Cards. Do not ask for Scene Cards. Do not mention Scene Cards in the output.

When I ask you to write Part 1, Part 2, and so on, write the full script for that exact part using the matching part plan.

Do not create a new structure.
Do not rewrite the plan.
Do not compress the part into a short summary.
Do not explain what you are doing.
Output only the finished script text.

Script format:
- Script language: English.
- Main voice: first person from the main character when the scene follows his direct experience, actions, thoughts, fear, decisions, or observations.
- Third person is allowed when showing other characters, enemy reactions, crowd reactions, family reactions, political consequences, large events, or things happening outside the main character's direct view.
- Style: YouTube manga/manhwa recap voiceover.
- The script must sound dramatic, visual, clear, emotional, and easy to hear in a video.

Length:
- One command = one complete part.
- Normal part length: 12,000-15,000 characters including spaces, unless I give another range.
- Do not finish too early.
- If you only mention each planned event once, that is not enough.
- Each important planned event must be expanded through action, reaction, consequence, pressure, and payoff.

Style:
- Write simply, clearly, dramatically, and visually.
- Do not write a dry summary.
- Do not write like a report.
- Do not write like analysis.
- Do not write decorative novel prose that describes things only for beauty.
- Do not remove dramatic atmosphere when it increases hunger, danger, fear, family pressure, memory, humiliation, survival tension, or the cost of a decision.
- Rhythm: pressure -> action -> reaction -> result -> new pressure.

Paragraphs:
- Each normal paragraph should be comfortable for voiceover.
- Target paragraph length: 120-220 characters including spaces.
- One paragraph usually contains 2-4 short sentences.
- Do not write giant paragraphs.
- Do not put every short sentence on a new line.
- One paragraph = one visual beat.

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

export function buildPartPrompt(partNumber: number, state: ProjectState): string {
  const part = state.scriptParts.find((p) => p.partNumber === partNumber);
  const partTitle = part?.partTitle || `Part ${partNumber}`;
  const currentPartPlan = partPlanFor(partNumber, part, state);
  const manualStyleRules = String((part as any)?.manualStyleRules || "").trim();
  const manualExtraInstruction = String((part as any)?.manualExtraInstruction || "").trim();
  const manualTargetChars = String((part as any)?.manualTargetChars || "12,000-15,000 characters including spaces").trim();
  const previousContext = previousWrittenPartsContext(partNumber, state);

  return `You are a YouTube manga/manhwa recap scriptwriter.

Write only the selected script part.

Part:
Part ${partNumber} — ${partTitle}

Target length:
${manualTargetChars}

=== CURRENT PART PLAN ===
${currentPartPlan}

=== PREVIOUS WRITTEN PARTS CONTEXT ===
${previousContext}

Use previous parts only as continuity memory. Do not rewrite them in the answer.

=== STYLE RULES ===
${manualStyleRules || DEFAULT_SCRIPT_STYLE_RULES}

=== EXTRA INSTRUCTION ===
${manualExtraInstruction || "No extra instruction."}

Command:
Write the full Part ${partNumber}.
Use ONLY Current Part Plan as the foundation.
Do not use Scene Cards.
Do not mention Scene Cards.
Follow the style rules and target length.
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

STYLE RULES:
${DEFAULT_SCRIPT_STYLE_RULES}

Output only the finished clean English script text.`;
}
