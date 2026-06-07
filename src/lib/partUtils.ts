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
  "\u043e\u0434\u0438\u043d": 1,
  "\u0434\u0432\u0430": 2,
  "\u0442\u0440\u0438": 3,
  "\u0447\u0435\u0442\u044b\u0440\u0435": 4,
  "\u043f\u044f\u0442\u044c": 5,
  "\u0448\u0435\u0441\u0442\u044c": 6,
  "\u0441\u0435\u043c\u044c": 7,
  "\u0432\u043e\u0441\u0435\u043c\u044c": 8,
  "\u0434\u0435\u0432\u044f\u0442\u044c": 9,
  "\u0434\u0435\u0441\u044f\u0442\u044c": 10,
  "\u043f\u0435\u0440\u0432\u0430\u044f": 1,
  "\u0432\u0442\u043e\u0440\u0430\u044f": 2,
  "\u0442\u0440\u0435\u0442\u044c\u044f": 3,
  "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0430\u044f": 4,
  "\u0447\u0435\u0442\u0432\u0451\u0440\u0442\u0430\u044f": 4,
  "\u043f\u044f\u0442\u0430\u044f": 5,
  "\u0448\u0435\u0441\u0442\u0430\u044f": 6,
  "\u0441\u0435\u0434\u044c\u043c\u0430\u044f": 7,
  "\u0432\u043e\u0441\u044c\u043c\u0430\u044f": 8,
  "\u0434\u0435\u0432\u044f\u0442\u0430\u044f": 9,
  "\u0434\u0435\u0441\u044f\u0442\u0430\u044f": 10,
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
  "\u043e\u0434\u0438\u043d",
  "\u0434\u0432\u0430",
  "\u0442\u0440\u0438",
  "\u0447\u0435\u0442\u044b\u0440\u0435",
  "\u043f\u044f\u0442\u044c",
  "\u0448\u0435\u0441\u0442\u044c",
  "\u0441\u0435\u043c\u044c",
  "\u0432\u043e\u0441\u0435\u043c\u044c",
  "\u0434\u0435\u0432\u044f\u0442\u044c",
  "\u0434\u0435\u0441\u044f\u0442\u044c",
  "\u043f\u0435\u0440\u0432\u0430\u044f",
  "\u0432\u0442\u043e\u0440\u0430\u044f",
  "\u0442\u0440\u0435\u0442\u044c\u044f",
  "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0430\u044f",
  "\u0447\u0435\u0442\u0432\u0451\u0440\u0442\u0430\u044f",
  "\u043f\u044f\u0442\u0430\u044f",
  "\u0448\u0435\u0441\u0442\u0430\u044f",
  "\u0441\u0435\u0434\u044c\u043c\u0430\u044f",
  "\u0432\u043e\u0441\u044c\u043c\u0430\u044f",
  "\u0434\u0435\u0432\u044f\u0442\u0430\u044f",
  "\u0434\u0435\u0441\u044f\u0442\u0430\u044f",
  "\\d+",
].join("|");

function parsePartToken(token: string): number {
  const normalized = token.trim().toLowerCase();
  return PART_WORDS[normalized] || parseInt(normalized, 10) || 0;
}

export function extractPartSlice(text: string, partNumber: number): string {
  if (!text || !partNumber) return "";

  const headingRegex = new RegExp(
    `(?:^|\\n)([ \\t]*(?:#{1,6}\\s*)?(?:(?:${PART_TOKEN_PATTERN})\\.\\s*)?(?:part|\\u0447\\u0430\\u0441\\u0442\\u044c)\\s+(${PART_TOKEN_PATTERN})\\b[^\\n]*)`,
    "gi",
  );

  const headings: Array<{ index: number; number: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(text)) !== null) {
    const number = parsePartToken(match[2]);
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
