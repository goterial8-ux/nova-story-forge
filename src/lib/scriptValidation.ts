import { SupervisorReport } from "../types";

export type ScriptValidationScope = "script_part" | "clean_export";
export type ScriptValidationSeverity = "fail" | "warn";

export interface ScriptValidationIssue {
  severity: ScriptValidationSeverity;
  code: string;
  message: string;
  paragraphIndex?: number;
  length?: number;
  excerpt?: string;
}

export interface ScriptValidationResult {
  ok: boolean;
  issues: ScriptValidationIssue[];
  failures: ScriptValidationIssue[];
  warnings: ScriptValidationIssue[];
  characterCount: number;
  normalParagraphCount: number;
  avatarCount: number;
  hasGenerationResidue: boolean;
  hasDuplicateBlocks: boolean;
  firstPersonCoverage: number;
}

export const SCRIPT_PARAGRAPH_MIN = 120;
export const SCRIPT_PARAGRAPH_MAX = 220;
export const SCRIPT_PARAGRAPH_HARD_MIN = 100;
export const SCRIPT_PARAGRAPH_HARD_MAX = 260;

const AVATAR_PATTERN =
  /^\s*(?:\[(?:AVATAR|COMMENTARY|HOST|NARRATOR)\]|(?:AVATAR|COMMENTARY|HOST)\s*:)/i;
const FIRST_PERSON_PATTERN =
  /\b(?:I|me|my|mine|myself|we|us|our|ours|ourselves)\b/i;
const RESIDUE_PATTERN =
  /\b(?:generating part|writing part|draft continues|unfinished|placeholder|debug|linter report|qa notes|prompt notes|output start|output end)\b/i;

function splitParagraphs(text: string): string[] {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function excerpt(text: string): string {
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function normalizeForDuplicate(paragraph: string): string {
  return paragraph
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAvatarParagraph(paragraph: string): boolean {
  return AVATAR_PATTERN.test(paragraph);
}

export function normalizeScriptDraft(text: string): string {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^\s*#{1,6}\s+/.test(line)) return false;
      if (/^\s*(?:={3,}|-{3,}|\*{3,})\s*$/.test(line)) return false;
      if (
        /^\s*(?:stage|scene|part)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b\s*[:.-]?\s*$/i.test(
          line,
        )
      ) {
        return false;
      }
      if (
        /^\s*\[(?:script|draft|output|begin|end|scene|part|stage|prompt|notes?|debug)[^\]]*\]\s*$/i.test(
          line,
        )
      ) {
        return false;
      }
      return true;
    })
    .join("\n\n")
    .trim();
}

export function validateScriptText(
  text: string,
  _scope: ScriptValidationScope,
  _isClaudeLite: boolean = false,
): ScriptValidationResult {
  const paragraphs = splitParagraphs(text);
  const issues: ScriptValidationIssue[] = [];
  const duplicateMap = new Map<string, number>();
  let avatarCount = 0;
  let normalParagraphCount = 0;
  let firstPersonParagraphCount = 0;
  let hasGenerationResidue = false;
  let hasDuplicateBlocks = false;
  let tooShortCount = 0;
  let tooLongCount = 0;
  let seriousLongCount = 0;

  if (!text || !text.trim()) {
    issues.push({
      severity: "fail",
      code: "empty_script",
      message: "Script text is empty.",
    });
  }

  paragraphs.forEach((paragraph, index) => {
    const paragraphNumber = index + 1;
    const isAvatar = isAvatarParagraph(paragraph);

    if (isAvatar) {
      avatarCount += 1;
    } else {
      normalParagraphCount += 1;
      if (FIRST_PERSON_PATTERN.test(paragraph)) {
        firstPersonParagraphCount += 1;
      }
    }

    if (RESIDUE_PATTERN.test(paragraph)) {
      hasGenerationResidue = true;
      issues.push({
        severity: "warn",
        code: "technical_residue_warning",
        message: `Paragraph ${paragraphNumber} may contain generation residue.`,
        paragraphIndex: paragraphNumber,
        excerpt: excerpt(paragraph),
      });
    }

    if (!isAvatar) {
      const length = paragraph.length;
      if (length < SCRIPT_PARAGRAPH_MIN) {
        tooShortCount += 1;
      }
      if (length > SCRIPT_PARAGRAPH_MAX) {
        tooLongCount += 1;
      }
      if (length > SCRIPT_PARAGRAPH_HARD_MAX) {
        seriousLongCount += 1;
      }
      if (length < SCRIPT_PARAGRAPH_MIN || length > SCRIPT_PARAGRAPH_MAX) {
        issues.push({
          severity: "warn",
          code: "paragraph_length_warning",
          message: `Paragraph ${paragraphNumber} is ${length} characters. Draft length is no longer a blocking rule.`,
          paragraphIndex: paragraphNumber,
          length,
          excerpt: excerpt(paragraph),
        });
      }

      const duplicateKey = normalizeForDuplicate(paragraph);
      if (duplicateKey.length >= 80) {
        const previousParagraph = duplicateMap.get(duplicateKey);
        if (previousParagraph) {
          hasDuplicateBlocks = true;
          issues.push({
            severity: "warn",
            code: "duplicate_paragraph_warning",
            message: `Paragraph ${paragraphNumber} duplicates paragraph ${previousParagraph}.`,
            paragraphIndex: paragraphNumber,
            excerpt: excerpt(paragraph),
          });
        } else {
          duplicateMap.set(duplicateKey, paragraphNumber);
        }
      }
    }
  });

  if (normalParagraphCount > 0) {
    if (tooShortCount > normalParagraphCount * 0.35) {
      issues.push({
        severity: "warn",
        code: "many_short_paragraphs_warning",
        message: `${tooShortCount} of ${normalParagraphCount} narrator paragraphs are shorter than ${SCRIPT_PARAGRAPH_MIN} characters. This is a style warning, not an approval blocker.`,
      });
    }

    if (tooLongCount > normalParagraphCount * 0.25) {
      issues.push({
        severity: "warn",
        code: "many_long_paragraphs_warning",
        message: `${tooLongCount} of ${normalParagraphCount} narrator paragraphs exceed ${SCRIPT_PARAGRAPH_MAX} characters. Clean Export can tighten this later.`,
      });
    }

    if (
      seriousLongCount >= 3 ||
      seriousLongCount > normalParagraphCount * 0.1
    ) {
      issues.push({
        severity: "warn",
        code: "serious_long_paragraphs_warning",
        message: `${seriousLongCount} narrator paragraphs exceed ${SCRIPT_PARAGRAPH_HARD_MAX} characters. Consider a polish pass after script generation.`,
      });
    }
  }

  const failures = issues.filter((issue) => issue.severity === "fail");
  const warnings = issues.filter((issue) => issue.severity === "warn");

  return {
    ok: failures.length === 0,
    issues,
    failures,
    warnings,
    characterCount: text.length,
    normalParagraphCount,
    avatarCount,
    hasGenerationResidue,
    hasDuplicateBlocks,
    firstPersonCoverage:
      normalParagraphCount > 0
        ? firstPersonParagraphCount / normalParagraphCount
        : 0,
  };
}

export function mergeSupervisorReportWithValidation(
  report: SupervisorReport,
  validation: ScriptValidationResult,
  _isClaudeLite?: boolean,
): SupervisorReport {
  if (validation.characterCount === 0) {
    return {
      ...report,
      status: "needs_serious_repair",
      problems: [...(report.problems || []), "Script text is empty."],
      requiredFixes: [
        ...(report.requiredFixes || []),
        "Generate script text before approving this part.",
      ],
      recommendation: "Generate text first.",
      canContinue: false,
    };
  }

  return {
    ...report,
    status: "ok",
    problems: report.problems || [],
    requiredFixes: report.requiredFixes || [],
    recommendation:
      report.recommendation ||
      "Script draft accepted. Story quality is controlled by Story Plan and Scene Cards.",
    canContinue: true,
  };
}

export function validationIssueSummary(
  validation: ScriptValidationResult,
  maxItems = 4,
): string {
  if (validation.issues.length === 0) return "Local validation passed.";
  return validation.issues
    .slice(0, maxItems)
    .map((issue) => issue.message)
    .join("\n");
}

export function detectHardDrift(
  _localScriptVal: ScriptValidationResult,
  aiReport: SupervisorReport | null,
): boolean {
  if (!aiReport) return false;
  const reportString = JSON.stringify(aiReport).toLowerCase();
  return [
    "genre drift",
    "setting drift",
    "wrong premise",
    "wrong world",
    "hard_story_drift",
  ].some((kw) => reportString.includes(kw));
}
