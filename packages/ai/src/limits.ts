export interface WordLimitOption {
  value: number | null;
  label: string;
}

export const WORD_LIMIT_OPTIONS: WordLimitOption[] = [
  { value: 60, label: "Brief (60 words)" },
  { value: 150, label: "Short (150 words)" },
  { value: 300, label: "Medium (300 words)" },
  { value: 600, label: "Detailed (600 words)" },
  { value: null, label: "No limit" },
];

export const DEFAULT_WORD_LIMIT = 300;
export const HARD_WORD_CAP = 1500;

export function wordLimitToMaxTokens(wordLimit: number): number {
  return Math.ceil(wordLimit * 2);
}
