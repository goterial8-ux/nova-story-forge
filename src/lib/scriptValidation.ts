import { SupervisorReport, SupervisorStatus } from "../types";

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
export const SCRIPT_PARAGRAPH_HARD_MAX = 235;

export const FORBIDDEN_DRIFT_TERMS = [
  "facility",
  "facilities",
  "proctor",
  "proctors",
  "toxic trench",
  "plasma battery",
  "plasma batteries",
  "exoskeleton",
  "exoskeletons",
  "trench crawler",
  "trench crawlers",
  "ocular implant",
  "ocular implants",
  "laser",
  "lasers",
  "military armory",
  "military armories",
  "sci-fi test",
  "sci-fi tests",
];

export const FORBIDDEN_TECHNICAL_TERMS = [
  "structural weak point",
  "structural weak points",
  "thermal signature",
  "thermal signatures",
  "conductive",
  "pressure system",
  "pressure systems",
  "optimized",
  "resource loop",
  "resource loops",
  "tactical analysis",
  "calculated trajectory",
  "calculated trajectories",
  "energy source",
  "energy sources",
  "mechanism efficiency",
  "biological sample",
  "biological samples",
  "test subject",
  "test subjects",
];

const RESIDUE_PATTERNS: Array<[RegExp, string]> = [
  [
    /\[(?:generating part|generation|draft continues|unfinished|todo|placeholder|debug)\]/i,
    "generation marker",
  ],
  [
    /\b(?:generating part|writing part|continue from|draft continues|unfinished|placeholder|debug)\b/i,
    "generation residue",
  ],
  [
    /\b(?:stage output|scene card|linter report|qa notes|prompt notes|output start|output end)\b/i,
    "technical residue",
  ],
  [/^\s*(?:#{1,6}\s+|={3,}|-{3,}|\*{3,})/i, "heading or decorative separator"],
  [
    /^\s*(?:stage|scene|part)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b\s*[:.-]/i,
    "stage/scene/part label",
  ],
  [
    /^\s*(?:current stage|status|what i checked|problems found|what i fixed|next action)\s*:/i,
    "operator report residue",
  ],
];

const AVATAR_PATTERN =
  /^\s*(?:\[(?:AVATAR|COMMENTARY|HOST|NARRATOR)\]|(?:AVATAR|COMMENTARY|HOST)\s*:)/i;
const CYRILLIC_PATTERN = /[\u0400-\u04FF]/;
const FIRST_PERSON_PATTERN =
  /\b(?:I|me|my|mine|myself|we|us|our|ours|ourselves)\b/i;
const DIGIT_PATTERN = /\d/;
const ROBOTIC_OPENING_PATTERN =
  /^(?:then i|after that|next,?\s+i|i started to|i began to|i decided to|i realized|i knew|i saw|i looked)\b/i;

const AUTHORIAL_CLICHE_PATTERNS: Array<[RegExp, string]> = [
  [/\blittle did (?:i|we|he|she|they) know\b/i, "little did they know"],
  [/\beverything changed forever\b/i, "everything changed forever"],
  [
    /\bwhat happened next (?:would|could) change\b/i,
    "what happened next would change",
  ],
  [/\bwith a heavy heart\b/i, "with a heavy heart"],
  [/\ba shiver (?:ran|went) down\b/i, "shiver ran down"],
  [
    /\ba wave of (?:fear|relief|dread|panic|satisfaction|horror)\b/i,
    "wave of named emotion",
  ],
  [/\bevery fiber of my being\b/i, "every fiber of my being"],
  [/\bthere was no turning back\b/i, "there was no turning back"],
  [/\bin that moment,?\s+i (?:knew|realized)\b/i, "in that moment I knew"],
  [/\bi couldn't help but\b/i, "I couldn't help but"],
];

function splitParagraphs(text: string): string[] {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
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
        /^\s*(?:stage|scene|part)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b\s*[:.-]\s+\S/i.test(
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

function excerpt(text: string): string {
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function isAvatarParagraph(paragraph: string): boolean {
  return AVATAR_PATTERN.test(paragraph);
}

function normalizeForDuplicate(paragraph: string): string {
  return paragraph
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findResidue(paragraph: string): string | null {
  for (const [pattern, label] of RESIDUE_PATTERNS) {
    if (pattern.test(paragraph)) return label;
  }
  return null;
}

function findAuthorialCliche(paragraph: string): string | null {
  for (const [pattern, label] of AUTHORIAL_CLICHE_PATTERNS) {
    if (pattern.test(paragraph)) return label;
  }
  return null;
}

function addIssue(
  issues: ScriptValidationIssue[],
  issue: ScriptValidationIssue,
) {
  issues.push(issue);
}

export function validateScriptText(
  text: string,
  scope: ScriptValidationScope,
  isClaudeLite: boolean = false,
): ScriptValidationResult {
  const paragraphs = splitParagraphs(text);
  const issues: ScriptValidationIssue[] = [];
  const duplicateMap = new Map<string, number>();
  let avatarCount = 0;
  let normalParagraphCount = 0;
  let firstPersonParagraphCount = 0;
  let roboticOpeningCount = 0;
  const flatOpeningMap = new Map<string, number>();
  let hasGenerationResidue = false;
  let hasDuplicateBlocks = false;

  if (!text || !text.trim()) {
    addIssue(issues, {
      severity: "fail",
      code: "empty_script",
      message: "Script text is empty.",
    });
  } else {
    // Check for hard story drift
    const textLower = text.toLowerCase();
    const matchedTerms = FORBIDDEN_DRIFT_TERMS.filter((term) => {
      const regex = new RegExp(`\\b${term}\\b`, "i");
      return regex.test(textLower);
    });

    if (matchedTerms.length > 0) {
      addIssue(issues, {
        severity: "fail",
        code: "hard_story_drift",
        message: `HARD STORY DRIFT UNACCEPTABLE: Contains off-premise/sci-fi terms: ${matchedTerms.join(", ")}. This part must be completely rebuilt from the plans instead of repaired.`,
      });
    }
  }

  paragraphs.forEach((paragraph, index) => {
    const paragraphNumber = index + 1;
    const residue = findResidue(paragraph);
    const isAvatar = isAvatarParagraph(paragraph);

    if (isAvatar) avatarCount += 1;

    if (residue) {
      hasGenerationResidue = true;
      const isDraftLabelResidue =
        scope === "script_part" &&
        isClaudeLite &&
        (residue === "heading or decorative separator" ||
          residue === "stage/scene/part label");
      addIssue(issues, {
        severity: isDraftLabelResidue ? "warn" : "fail",
        code: "technical_residue",
        message: `Paragraph ${paragraphNumber} contains ${residue}.`,
        paragraphIndex: paragraphNumber,
        excerpt: excerpt(paragraph),
      });
    }

    if (CYRILLIC_PATTERN.test(paragraph)) {
      addIssue(issues, {
        severity: scope === "clean_export" ? "fail" : "warn",
        code: "cyrillic_text",
        message: `Paragraph ${paragraphNumber} contains Cyrillic text inside an English script stage.`,
        paragraphIndex: paragraphNumber,
        excerpt: excerpt(paragraph),
      });
    }

    if (DIGIT_PATTERN.test(paragraph) && !isAvatar) {
      addIssue(issues, {
        severity: "warn",
        code: "digit_in_voiceover",
        message: `Paragraph ${paragraphNumber} contains digits; clean voiceover should spell numbers as words.`,
        paragraphIndex: paragraphNumber,
        excerpt: excerpt(paragraph),
      });
    }

    if (!isAvatar) {
      normalParagraphCount += 1;

      if (FIRST_PERSON_PATTERN.test(paragraph)) {
        firstPersonParagraphCount += 1;
      }

      const authorialCliche = findAuthorialCliche(paragraph);
      if (authorialCliche) {
        addIssue(issues, {
          severity: "fail",
          code: "generic_ai_cliche",
          message: `Paragraph ${paragraphNumber} contains generic AI/cliche phrasing: ${authorialCliche}.`,
          paragraphIndex: paragraphNumber,
          excerpt: excerpt(paragraph),
        });
      }

      const paragraphLower = paragraph.toLowerCase();
      const matchedTechTerms = FORBIDDEN_TECHNICAL_TERMS.filter((term) => {
        const regex = new RegExp(`\\b${term}\\b`, "i");
        return regex.test(paragraphLower);
      });
      if (matchedTechTerms.length > 0) {
        addIssue(issues, {
          severity: isClaudeLite && matchedTechTerms.length < 2 ? "warn" : "fail",
          code: "scientific_technical_tone",
          message: `Paragraph ${paragraphNumber} contains unapproved scientific/technical terms: ${matchedTechTerms.join(", ")}. It sounds like a lab or system report. Replace with concrete physical actions or natural survival language.`,
          paragraphIndex: paragraphNumber,
          excerpt: excerpt(paragraph),
        });
      }

      if (ROBOTIC_OPENING_PATTERN.test(paragraph)) {
        roboticOpeningCount += 1;
        const flatOpening = paragraph
          .split(/\s+/)
          .slice(0, 2)
          .join(" ")
          .toLowerCase()
          .replace(/[^\p{L}\s']/gu, "");
        if (flatOpening) {
          flatOpeningMap.set(
            flatOpening,
            (flatOpeningMap.get(flatOpening) || 0) + 1,
          );
        }
      }

      const length = paragraph.length;
      if (length < SCRIPT_PARAGRAPH_MIN || length > SCRIPT_PARAGRAPH_MAX) {
        const isDraftLengthWarning = scope === "script_part" && isClaudeLite;
        if (length < SCRIPT_PARAGRAPH_HARD_MIN) {
          addIssue(issues, {
            severity: isDraftLengthWarning ? "warn" : "fail",
            code: isDraftLengthWarning
              ? "paragraph_length_draft_warning"
              : "paragraph_too_short_hard",
            message: isDraftLengthWarning
              ? `Paragraph ${paragraphNumber} is ${length} characters. Draft paragraph length is handled in Clean Export / Final Polish.`
              : `Paragraph ${paragraphNumber} is ${length} characters (below hard minimum of ${SCRIPT_PARAGRAPH_HARD_MIN}).`,
            paragraphIndex: paragraphNumber,
            length,
            excerpt: excerpt(paragraph),
          });
        } else if (length > SCRIPT_PARAGRAPH_HARD_MAX) {
          addIssue(issues, {
            severity: isDraftLengthWarning ? "warn" : "fail",
            code: isDraftLengthWarning
              ? "paragraph_length_draft_warning"
              : "paragraph_too_long_hard",
            message: isDraftLengthWarning
              ? `Paragraph ${paragraphNumber} is ${length} characters. Draft paragraph length is handled in Clean Export / Final Polish.`
              : `Paragraph ${paragraphNumber} is ${length} characters (above hard maximum of ${SCRIPT_PARAGRAPH_HARD_MAX}).`,
            paragraphIndex: paragraphNumber,
            length,
            excerpt: excerpt(paragraph),
          });
        } else {
          addIssue(issues, {
            severity: "warn",
            code: "paragraph_length_soft",
            message: `Paragraph ${paragraphNumber} length ${length} slightly outside target 120-220 characters.`,
            paragraphIndex: paragraphNumber,
            length,
            excerpt: excerpt(paragraph),
          });
        }
      }

      const duplicateKey = normalizeForDuplicate(paragraph);
      if (duplicateKey.length >= 60) {
        const previousParagraph = duplicateMap.get(duplicateKey);
        if (previousParagraph) {
          hasDuplicateBlocks = true;
          addIssue(issues, {
            severity: "fail",
            code: "duplicate_paragraph",
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

  if (roboticOpeningCount >= 4 && normalParagraphCount > 0) {
    addIssue(issues, {
      severity: "fail",
      code: "robotic_sequence_rhythm",
      message: `${roboticOpeningCount} normal paragraphs start with flat sequence/reporting transitions. Script needs an Author Voice Pass.`,
    });
  }

  const repeatedFlatOpening = [...flatOpeningMap.entries()].find(
    ([, count]) => count >= 3,
  );
  if (repeatedFlatOpening) {
    addIssue(issues, {
      severity: "fail",
      code: "repetitive_flat_openings",
      message: `Flat paragraph opening "${repeatedFlatOpening[0]}" repeats ${repeatedFlatOpening[1]} times. Vary the authorial rhythm and scene entry points.`,
    });
  }

  if (normalParagraphCount > 0) {
    const coverage = firstPersonParagraphCount / normalParagraphCount;
    if (firstPersonParagraphCount === 0) {
      addIssue(issues, {
        severity: "fail",
        code: "missing_first_person_voice",
        message:
          "No normal paragraph uses first-person voice. Script must read like a living first-person recap.",
      });
    } else if (coverage < 0.25) {
      addIssue(issues, {
        severity: "fail",
        code: "mostly_third_person_voice",
        message: `Only ${Math.round(coverage * 100)}% of normal paragraphs contain first-person voice markers; narration reads mostly third-person.`,
      });
    } else if (coverage < 0.35) {
      addIssue(issues, {
        severity: "warn",
        code: "weak_first_person_voice",
        message: `Only ${Math.round(coverage * 100)}% of normal paragraphs contain first-person voice markers.`,
      });
    }
  }

  if (
    scope === "clean_export" &&
    paragraphs.some((paragraph) =>
      /^#{1,6}\s+|^Part\s+\d+\s*:/i.test(paragraph),
    )
  ) {
    addIssue(issues, {
      severity: "fail",
      code: "export_headings",
      message:
        "Clean export contains headings or part labels. Final voiceover export must be clean narration.",
    });
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

function worstStatus(
  left: SupervisorStatus,
  right: SupervisorStatus,
): SupervisorStatus {
  const rank: Record<SupervisorStatus, number> = {
    ok: 0,
    needs_small_repair: 1,
    needs_serious_repair: 2,
    do_not_continue: 3,
  };
  return rank[right] > rank[left] ? right : left;
}

export function mergeSupervisorReportWithValidation(
  report: SupervisorReport,
  validation: ScriptValidationResult,
  isClaudeLite?: boolean,
): SupervisorReport {
  if (validation.ok && validation.warnings.length === 0) return report;

  const hardBlockerCodes = isClaudeLite
    ? [
        "empty_script",
        "missing_first_person_voice",
        "mostly_third_person_voice",
        "hard_story_drift",
        "duplicate_paragraph",
        "technical_residue",
        "scientific_technical_tone",
      ]
    : [
        "paragraph_too_short_hard",
        "paragraph_too_long_hard",
        "missing_first_person_voice",
        "mostly_third_person_voice",
        "duplicate_paragraph",
        "generic_ai_cliche",
        "robotic_sequence_rhythm",
        "repetitive_flat_openings",
        "hard_story_drift",
        "scientific_technical_tone",
      ];

  const effectiveFailures = validation.failures.filter((issue) =>
    hardBlockerCodes.includes(issue.code),
  );
  const effectiveWarnings = [
    ...validation.warnings,
    ...validation.failures.filter((issue) => !hardBlockerCodes.includes(issue.code)),
  ];

  // Group and deduplicate paragraph issues to prevent multi-line repetition
  const otherProblems: string[] = [];
  let shortHardCount = 0;
  let longHardCount = 0;

  effectiveFailures.forEach((issue) => {
    if (issue.code === "paragraph_too_short_hard") {
      shortHardCount++;
    } else if (issue.code === "paragraph_too_long_hard") {
      longHardCount++;
    } else {
      otherProblems.push(`[${issue.code}] ${issue.message}`);
    }
  });

  const validationProblems = [...otherProblems];
  if (shortHardCount > 0 || longHardCount > 0) {
    validationProblems.push(
      `[paragraph_length_blocker] Paragraph length issue: ${shortHardCount} paragraphs are too short (<100 chars)${longHardCount > 0 ? `, ${longHardCount} paragraphs are too long (>235 chars)` : ""}. Fix to 120-220 range.`,
    );
  }

  const warnProblems = effectiveWarnings.filter(
    (w) =>
      w.code === "paragraph_length_soft" ||
      w.code === "paragraph_length_draft_warning" ||
      w.code === "paragraph_too_long_hard" ||
      w.code === "paragraph_length_blocker"
  );
  if (warnProblems.length > 0) {
    validationProblems.push(
      isClaudeLite
        ? `[paragraph_length_draft_warning] ${warnProblems.length} draft paragraphs are outside the final 120-220 target. Do not block Script Writer; normalize in Clean Export / Final Polish.`
        : `[paragraph_length_soft] Paragraph length warning: ${warnProblems.length} paragraphs are slightly outside the target range. Clean them up with compact trimming.`,
    );
  }

  const validationFixes: string[] = [];
  if (shortHardCount > 0 || longHardCount > 0) {
    validationFixes.push(
      "Fix paragraph lengths to strictly 120-220 characters without changing events.",
    );
  }

  effectiveFailures.forEach((issue) => {
    if (
      issue.code === "paragraph_too_short_hard" ||
      issue.code === "paragraph_too_long_hard"
    )
      return;
    if (
      issue.code === "missing_first_person_voice" ||
      issue.code === "mostly_third_person_voice"
    ) {
      validationFixes.push(
        "Rewrite narration into first-person manhwa recap voice without changing events.",
      );
    } else if (
      issue.code === "technical_residue" ||
      issue.code === "export_headings"
    ) {
      validationFixes.push(
        "Remove technical labels, headings, debug notes, and export residue.",
      );
    } else if (issue.code === "duplicate_paragraph") {
      validationFixes.push(
        "Remove duplicate paragraphs and keep only the stronger version.",
      );
    } else if (issue.code === "generic_ai_cliche") {
      validationFixes.push(
        "Replace generic AI/cliche phrasing with concrete physical action, tactical observation, or a specific first-person decision.",
      );
    } else if (
      issue.code === "robotic_sequence_rhythm" ||
      issue.code === "repetitive_flat_openings"
    ) {
      validationFixes.push(
        "Run an Author Voice Pass: vary paragraph openings, remove flat sequence transitions, and make each beat enter through pressure, action, calculation, or consequence.",
      );
    } else if (issue.code === "hard_story_drift") {
      validationFixes.push(
        "STRICT CORRECTIVE ACTION: Discard off-premise terminology and completely rebuild this part according to the locked approved story contract, approved story plan, and current part scene cards.",
      );
    } else if (issue.code === "scientific_technical_tone") {
      validationFixes.push(
        "WRITER VOICE LOCK VIOLATION: Replace all scientific/technical words (thermal, weaknesses, optimized, patterns, etc.) with simple, direct visual survival language (split rocks, warm shimmer, tied rope, dripping water).",
      );
    } else {
      validationFixes.push(issue.message);
    }
  });

  if (warnProblems.length > 0 && !isClaudeLite) {
    validationFixes.push(
      "Apply compact trimming to paragraphs slightly over target length.",
    );
  } else if (warnProblems.length > 0 && isClaudeLite) {
    validationFixes.push(
      "Do not repair Script Writer draft for paragraph length alone; normalize paragraph lengths in Clean Export / Final Polish.",
    );
  }

  // Generate unique fixes
  const uniqueFixes = Array.from(new Set(validationFixes));

  const localStatus: SupervisorStatus = effectiveFailures.length > 0
    ? "needs_serious_repair"
    : "ok";

  const hasLocalHardBlockers = effectiveFailures.length > 0;

  const aiProblems = report.problems || [];
  const aiFixes = report.requiredFixes || [];

  const aiHasOtherProblemsThanLength = aiProblems.some((p: string) => {
    const pl = p.toLowerCase();
    if (
      pl.includes("paragraph") &&
      (pl.includes("length") ||
        pl.includes("character") ||
        pl.includes("trim") ||
        pl.includes("long") ||
        pl.includes("short"))
    ) {
      if (
        pl.includes("235") ||
        pl.includes("too long") ||
        pl.includes("too short") ||
        pl.includes("blocker") ||
        pl.includes("hard")
      ) {
        return true;
      }
      return false;
    }
    return true;
  });

  const aiHasOtherFixesThanLength = aiFixes.some((f: string) => {
    const fl = f.toLowerCase();
    if (
      fl.includes("paragraph") &&
      (fl.includes("length") ||
        fl.includes("character") ||
        fl.includes("trim") ||
        fl.includes("long") ||
        fl.includes("short"))
    ) {
      if (
        fl.includes("235") ||
        fl.includes("too long") ||
        fl.includes("too short") ||
        fl.includes("blocker") ||
        fl.includes("hard")
      ) {
        return true;
      }
      return false;
    }
    return true;
  });

  const hasHardBlockers =
    hasLocalHardBlockers ||
    (!isClaudeLite && (aiHasOtherProblemsThanLength || aiHasOtherFixesThanLength));

  const finalStatus = hasHardBlockers
    ? worstStatus(report.status || "ok", localStatus)
    : "ok";
  const finalCanContinue = hasHardBlockers
    ? localStatus === "ok" && report.canContinue
    : true;

  return {
    ...report,
    status: finalStatus,
    problems: Array.from(
      new Set([...(report.problems || []), ...validationProblems]),
    ),
    requiredFixes: Array.from(
      new Set([...(report.requiredFixes || []), ...uniqueFixes]),
    ),
    recommendation:
      finalStatus !== "ok"
        ? "Deterministic script validation failed. Repair the listed formatting/style issues before approval."
        : report.recommendation,
    canContinue: finalCanContinue,
  };
}

export function validationIssueSummary(
  validation: ScriptValidationResult,
  maxItems = 4,
): string {
  if (validation.ok) return "Local validation passed.";
  return validation.failures
    .slice(0, maxItems)
    .map((issue) => issue.message)
    .join("\n");
}

export function detectHardDrift(
  localScriptVal: ScriptValidationResult,
  aiReport: SupervisorReport | null,
): boolean {
  const localHasDrift = localScriptVal.failures.some(
    (f) => f.code === "hard_story_drift",
  );
  if (localHasDrift) return true;

  if (!aiReport) return false;

  const reportString = JSON.stringify(aiReport).toLowerCase();

  const driftKeywords = [
    "genre drift",
    "setting drift",
    "wrong premise",
    "wrong world",
    "sci-fi",
    "facility",
    "toxic trench",
    "proctors",
    "proctor",
    "plasma battery",
    "plasma batteries",
    "exoskeleton",
    "exoskeletons",
    "dungeon/facility",
    "dungeon/facility survival",
    "hard_story_drift",
  ];

  return driftKeywords.some((kw) => reportString.includes(kw));
}
