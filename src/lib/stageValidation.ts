export type StageValidationScope =
  | "idea_market"
  | "raw_idea"
  | "style_analyzer"
  | "story_dna"
  | "story_plan"
  | "scene_cards"
  | "script_writer"
  | "clean_export";

export interface StageValidationResult {
  ok: boolean;
  stageId: string;
  problems: string[];
  requiredFixes: string[];
  blockingProblems: string[];
  warnings: string[];
  metrics: any;
  canContinue: boolean;
}

function checkTerms(
  content: string,
  terms: Array<string | string[]>,
  result: StageValidationResult,
  stageName: string,
) {
  const c = content.toLowerCase();
  for (const term of terms) {
    const aliases = Array.isArray(term) ? term : [term];
    if (!aliases.some((alias) => c.includes(alias.toLowerCase()))) {
      const label = aliases[0];
      result.blockingProblems.push(
        `Missing required element in ${stageName}: '${label}'`,
      );
      result.requiredFixes.push(`Add or clearly define: '${label}'`);
    }
  }
}

export function validateStageContent(
  content: string,
  stageId: StageValidationScope,
  projectState: any,
): StageValidationResult {
  const result: StageValidationResult = {
    ok: true,
    stageId,
    problems: [],
    requiredFixes: [],
    blockingProblems: [],
    warnings: [],
    metrics: {},
    canContinue: true,
  };

  if (!content || !content.trim()) {
    result.blockingProblems.push("Stage content is completely empty.");
    return finalizeResult(result);
  }

  const c_lower = content.toLowerCase();

  switch (stageId) {
    case "idea_market":
      if (projectState.ideaMode === "develop_raw_idea") {
        if (!c_lower.includes("pasteable raw idea for stage one")) {
          result.blockingProblems.push(
            "Missing required section: 'Pasteable Raw Idea For Stage One'.",
          );
          result.requiredFixes.push(
            "Ensure the output includes 'Pasteable Raw Idea For Stage One' with the fortified idea.",
          );
        }
      } else {
        if (!c_lower.includes("pasteable raw idea for stage one")) {
          result.blockingProblems.push(
            "Missing required section: 'Pasteable Raw Idea For Stage One'.",
          );
          result.requiredFixes.push(
            "Include a recommended 'Pasteable Raw Idea For Stage One'.",
          );
        }
      }
      break;

    case "raw_idea":
      checkTerms(
        content,
        [
          ["Protagonist", "Main Character", "Hero"],
          ["start", "opening", "beginning"],
          ["power source", "advantage", "mechanic"],
          "conflict",
          ["Antagonist", "Enemy", "Villain"],
          ["Emotional engine", "humiliation", "motivation"],
          ["Payoff promise", "final payoff", "payoff"],
          ["Forbidden changes", "forbidden", "rules"],
          ["Handoff Summary for Stage Two", "handoff"],
        ],
        result,
        "Raw Idea",
      );
      break;

    case "style_analyzer":
      checkTerms(
        content,
        [
          ["sentence rhythm", "rhythm"],
          ["paragraph rhythm", "paragraph"],
          ["narrator voice", "voice"],
          ["action explanation", "action"],
          ["transition pattern", "transition"],
          ["payoff pattern", "payoff"],
          ["comedy pattern", "comedy"],
          ["face-slap pattern", "face-slap"],
          ["forbidden generic wording", "forbidden"],
        ],
        result,
        "Style Analyzer",
      );
      break;

    case "story_dna":
      checkTerms(
        content,
        [
          ["Locked Story Contract", "Story Contract", "Story DNA"],
          ["Protagonist", "Main Character", "Hero"],
          ["Antagonist", "Enemy", "Villain"],
          [
            "Character function matrix",
            "Character functions",
            "Important side characters",
            "Side characters",
            "Allies",
          ],
          ["Emotional engine lock", "Emotional engine", "humiliation"],
          ["Power source lock", "Power source", "advantage", "mechanic"],
          ["Hidden cards", "Hidden card", "setup/payoff"],
          ["Forbidden changes", "forbidden", "rules"],
          ["Continuity handoff for Stage Three", "Continuity handoff", "handoff"],
        ],
        result,
        "Story DNA",
      );
      break;

    case "story_plan":
      checkTerms(
        content,
        [
          ["part function", "function"],
          ["beginning pressure", "pressure"],
          ["main events", "events"],
          ["central conflict", "conflict"],
          ["resource/progress movement", "resource", "progress"],
          ["protagonist movement", "protagonist", "hero"],
          ["antagonist pressure", "antagonist", "enemy"],
          ["emotional engine movement", "emotional engine"],
          ["hidden card movement", "hidden card"],
          ["hidden card timing map", "timing map"],
          ["resource/progress ladder", "progress ladder", "resource ladder"],
          ["script formatting contract", "formatting contract"],
        ],
        result,
        "Story Plan",
      );
      const partRegex = /Part\s+[A-Za-z0-9]+/gi;
      const partsFound = (content.match(partRegex) || []).length;
      result.metrics.partsDetected = partsFound;
      if (partsFound < 1) {
        result.blockingProblems.push(
          "Could not detect clear part structure ('Part X' format).",
        );
        result.requiredFixes.push(
          "Structure the plan with explicit 'Part X' headings.",
        );
      }
      break;

    case "scene_cards":
      checkTerms(
        content,
        [
          "location",
          ["main action", "action"],
          ["emotion", "mood"],
          ["visual focus", "visual"],
          "scale",
          ["what must be shown", "must be shown"],
          ["what must not be shown", "must not be shown"],
          ["continuity details", "continuity"],
        ],
        result,
        "Scene Cards",
      );
      const sceneCardRegex = /Scene Card/gi;
      const sceneCardsFound = (content.match(sceneCardRegex) || []).length;
      result.metrics.sceneCardsDetected = sceneCardsFound;

      const claimedCardsMatch = content.match(
        /(?:outputting|generating|creating|generated)\s+(\d+)\s+scene cards/i,
      );

      if (sceneCardsFound < 1) {
        result.blockingProblems.push(
          "Could not detect any explicit 'Scene Card'.",
        );
        result.requiredFixes.push(
          "Format scene cards clearly with 'Scene Card' labels.",
        );
      } else if (claimedCardsMatch) {
        const claimedCount = parseInt(claimedCardsMatch[1], 10);
        // Often the number is claimed but output truncated, or they don't match.
        // Allow a small margin of error (e.g., +/- 1) due to intro/outro, but fail if completely wrong.
        if (sceneCardsFound < claimedCount - 1) {
          result.blockingProblems.push(
            `Output claimed to generate ${claimedCount} scene cards, but only ${sceneCardsFound} were detected.`,
          );
          result.requiredFixes.push(
            `Ensure exactly ${claimedCount} actual scene cards are generated, do not truncate the response.`,
          );
        }
      } else if (sceneCardsFound < 10) {
        result.warnings.push(
          "Detected fewer than 10 scene cards. Ensure this isn't a partial generation if a full plan was expected.",
        );
      }
      break;

    case "clean_export":
      // Basic fallback since clean_export also goes through validateScriptText
      if (
        !projectState?.exportSettings?.keepPartHeadings &&
        /^#|^Part\s+\d/im.test(content)
      ) {
        result.blockingProblems.push(
          "Found headings/part labels when export settings dictate they should be removed.",
        );
        result.requiredFixes.push("Remove all headers like 'Part 1'.");
      }
      if (/[\[\(\{]note:/i.test(content) || /\[debug\]/i.test(content)) {
        result.blockingProblems.push("Found debug or note labels.");
        result.requiredFixes.push("Remove any [note:] or [debug] blocks.");
      }
      break;
  }

  return finalizeResult(result);
}

function finalizeResult(result: StageValidationResult): StageValidationResult {
  if (result.blockingProblems.length > 0) {
    result.ok = false;
    result.canContinue = false;
  }
  return result;
}

export function mergeWithStageValidation(
  aiReport: any,
  localVal: StageValidationResult,
): any {
  if (localVal.ok) return aiReport;

  const mergedStatus = "needs_serious_repair";
  return {
    ...aiReport,
    status: mergedStatus,
    problems: [...(aiReport.problems || []), ...localVal.blockingProblems],
    requiredFixes: [
      ...(aiReport.requiredFixes || []),
      ...localVal.requiredFixes,
    ],
    recommendation:
      "Deterministic validation failed. Repair the listed structural/content issues before approval.",
    canContinue: false,
  };
}
