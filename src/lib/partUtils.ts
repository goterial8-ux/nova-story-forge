export type PartHeading = {
  number: number;
  title: string;
  index: number;
};

const PART_WORDS: Record<string, number> = {
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
  ii: 2,
  iii: 3,
  iv: 4,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
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

const SECTION_PREFIX_PATTERN = [
  "одиннадцать",
  "двенадцать",
  "тринадцать",
  "четырнадцать",
  "пятнадцать",
  "шестнадцать",
  "семнадцать",
  "восемнадцать",
  "девятнадцать",
  "двадцать",
  "четыре",
  "восемь",
  "девять",
  "десять",
  "один",
  "два",
  "три",
  "пять",
  "шесть",
  "семь",
  "\\d+",
].join("|");

function parsePartToken(token: string): number {
  const normalized = token.trim().toLowerCase();
  return PART_WORDS[normalized] || parseInt(normalized, 10) || 0;
}

function normalizePartTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

function isSuspiciousPartTitle(title: string): boolean {
  return /sci-fi|facility|dungeon|test vocabulary|approved plan|discard|rebuild|forbidden|hard drift|do not|must not|current part|scene cards|script writer|paragraph|repair/i.test(
    title,
  );
}

/**
 * Extract only real story part headings.
 *
 * Supported examples:
 * - PART ONE — ОХОТНИК И ЖИВАЯ ПЕЩЕРА
 * - Четыре. PART ONE — ОХОТНИК И ЖИВАЯ ПЕЩЕРА
 * - 4. Part 1: Introduction
 * - Часть 1 — ОХОТНИК И ЖИВАЯ ПЕЩЕРА
 *
 * Intentionally ignored:
 * - If the part introduces...
 * - Part Function:
 * - Scene Card 1.1:
 * - current part scene cards
 */
export function extractPartHeadings(text: string): PartHeading[] {
  if (!text) return [];

  const optionalSectionPrefix = String.raw`(?:(?:${SECTION_PREFIX_PATTERN})\.\s*)?`;
  const headingRegex = new RegExp(
    String.raw`(?:^|\n)(\s*${optionalSectionPrefix}(?:#{1,6}\s*)?(?:PART|Part|part|ЧАСТЬ|Часть|часть)\s+(${PART_TOKEN_PATTERN})\s*(?:[—–-]|:|\.)\s*([^\n]+))`,
    "gi",
  );

  const headings: PartHeading[] = [];
  const seenNumbers = new Set<number>();
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(text)) !== null) {
    const lineOffset = match[0].startsWith("\n") ? 1 : 0;
    const index = match.index + lineOffset;
    const number = parsePartToken(match[2]);
    const title = normalizePartTitle(match[3]);

    if (!number || !title || isSuspiciousPartTitle(title)) continue;
    if (seenNumbers.has(number)) continue;

    seenNumbers.add(number);
    headings.push({ number, title, index });
  }

  return headings.sort((a, b) => a.number - b.number);
}

export function extractPartSlice(text: string, partNumber: number): string {
  if (!text || !partNumber) return "";

  const headings = extractPartHeadings(text);
  const currentIndex = headings.findIndex((h) => h.number === partNumber);
  if (currentIndex < 0) return "";

  const start = headings[currentIndex].index;
  const next = headings
    .slice(currentIndex + 1)
    .find((h) => h.number !== partNumber);

  return text.slice(start, next ? next.index : text.length).trim();
}

export function clipForWriter(text: string, maxChars: number): string {
  const clean = (text || "").trim();
  if (!clean) return "";
  if (clean.length <= maxChars) return clean;

  return `${clean.slice(0, maxChars).trim()}

[TRUNCATED: only current part context kept]`;
}

export function summarizeApprovedPartForContinuity(part: {
  partNumber: number;
  partTitle: string;
  draftText?: string;
}): string {
  const paragraphs = (part.draftText || "")
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const firstParagraph = paragraphs[0] || "";
  const lastParagraph = paragraphs[paragraphs.length - 1] || "";

  return [
    `- Part ${part.partNumber}: "${part.partTitle}"`,
    "  Status: approved.",
    `  Opening state: ${firstParagraph.slice(0, 220)}`,
    `  Last state: ${lastParagraph.slice(0, 420)}`,
  ].join("\n");
}
