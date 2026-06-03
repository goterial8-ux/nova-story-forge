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

const SUPERVISED_STAGES: StageValidationScope[] = [
  "story_plan",
  "scene_cards",
];

function createResult(stageId: StageValidationScope): StageValidationResult {
  return {
    ok: true,
    stageId,
    problems: [],
    requiredFixes: [],
    blockingProblems: [],
    warnings: [],
    metrics: {},
    canContinue: true,
  };
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
  _projectState: any,
): StageValidationResult {
  const result = createResult(stageId);

  if (!SUPERVISED_STAGES.includes(stageId)) {
    result.warnings.push(
      "Local deterministic gate skipped. Only Story Plan and Scene Cards are blocking quality gates.",
    );
    return result;
  }

  if (!content || !content.trim()) {
    result.blockingProblems.push("Stage content is completely empty.");
    return finalizeResult(result);
  }

  switch (stageId) {
    case "story_plan": {
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
          ["resource/progress ladder", "progress ladder", "resource ladder"],
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
    }

    case "scene_cards": {
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

      const sceneCardsFound = (content.match(/Scene Card/gi) || []).length;
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
          "Detected fewer than 10 scene cards. Ensure this is not a partial generation if a full plan was expected.",
        );
      }
      break;
    }
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

  return {
    ...aiReport,
    status: "needs_serious_repair",
    problems: [...(aiReport.problems || []), ...localVal.blockingProblems],
    requiredFixes: [
      ...(aiReport.requiredFixes || []),
      ...localVal.requiredFixes,
    ],
    recommendation:
      "Deterministic validation failed on the active quality gate. Repair the listed story-structure issues before approval.",
    canContinue: false,
  };
}
