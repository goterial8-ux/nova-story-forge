export interface BuiltInReferenceFile {
  label: string;
  url: string;
}

export const BUILT_IN_REFERENCE_FILES: BuiltInReferenceFile[] = [
  { label: 'Strategy Reference 1', url: '/reference-scripts/strategy-1.txt' },
  { label: 'Strategy Reference 2', url: '/reference-scripts/strategy-2.txt' },
  { label: 'Strategy Reference 3', url: '/reference-scripts/strategy-3.txt' },
  { label: 'Strategy Reference 4', url: '/reference-scripts/strategy-4.txt' },
  { label: 'Strategy Reference 5', url: '/reference-scripts/strategy-5.txt' },
  { label: 'Strategy Reference 6 (Short Fragment)', url: '/reference-scripts/strategy-6.txt' },
];

const MAX_REFERENCE_CHARS = 6_000;

function cleanReferenceText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function takeSlice(text: string, start: number, length: number): string {
  const safeStart = Math.max(0, Math.min(start, text.length));
  return text.slice(safeStart, safeStart + length).trim();
}

function sampleReferenceText(text: string): string {
  const cleaned = cleanReferenceText(text);
  if (cleaned.length <= MAX_REFERENCE_CHARS) return cleaned;

  const segmentLength = Math.floor(MAX_REFERENCE_CHARS / 3);
  const middleStart = Math.floor(cleaned.length / 2) - Math.floor(segmentLength / 2);
  const endStart = cleaned.length - segmentLength;

  return [
    '[BEGINNING SAMPLE]',
    takeSlice(cleaned, 0, segmentLength),
    '[MIDDLE SAMPLE]',
    takeSlice(cleaned, middleStart, segmentLength),
    '[ENDING SAMPLE]',
    takeSlice(cleaned, endStart, segmentLength),
  ].join('\n\n');
}

export async function loadBuiltInReferencePack(): Promise<string> {
  const blocks = await Promise.all(
    BUILT_IN_REFERENCE_FILES.map(async (file) => {
      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error(`Failed to load ${file.label}: ${response.status}`);
      }

      const text = await response.text();
      const sampled = sampleReferenceText(text);
      return [
        `================ ${file.label} ================`,
        `Source asset: ${file.url}`,
        'Usage: style, pacing, narration rhythm, action explanation, progression cadence only. Do not copy plot, names, scenes, or mechanics.',
        sampled,
      ].join('\n\n');
    })
  );

  return [
    'BUILT-IN COMPETITOR STYLE REFERENCES',
    'These are sampled excerpts from the six strategy scripts provided by the user.',
    'Use them only for abstract style DNA: sentence rhythm, first-person narration energy, progression cadence, explanation style, pressure/payoff structure.',
    'Never copy plots, character names, exact situations, titles, powers, worlds, or unique twists.',
    ...blocks,
  ].join('\n\n');
}
