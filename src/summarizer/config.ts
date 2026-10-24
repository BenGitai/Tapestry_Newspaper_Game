// The one place the summarizer's model, prices and limits are set.
// Pure data: the Anthropic SDK is only used from scripts/ and server/.
import type { Tier } from '../sim/types.ts';

/** Default model for pre-generation and the tech demo's live mode. */
export const DEFAULT_SUMMARIZER_MODEL = 'claude-haiku-5-5';

/** SUMMARIZER_MODEL in the environment overrides the default. Callers pass `process.env`. */
export function summarizerModel(env: Record<string, string | undefined> = {}): string {
  const fromEnv = env['SUMMARIZER_MODEL']?.trim();
  return fromEnv ? fromEnv : DEFAULT_SUMMARIZER_MODEL;
}

export interface ModelPrice {
  /** Dollars per million tokens, for prompts up to `longPromptTokens`. */
  inputPerM: number;
  outputPerM: number;
  /** Longer prompts bill at these rates instead (Haiku 5.5 has a second rate card). */
  longPromptTokens: number;
  longInputPerM: number;
  longOutputPerM: number;
}

/** Published prices, checked 2026-10-24. Recheck before relying on them. */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-haiku-5-5': { inputPerM: 0.1, outputPerM: 0.5, longPromptTokens: 100_000, longInputPerM: 0.5, longOutputPerM: 2.5 },
  'claude-sonnet-5-5': { inputPerM: 2, outputPerM: 10, longPromptTokens: Infinity, longInputPerM: 2, longOutputPerM: 10 },
  'claude-opus-5-5': { inputPerM: 4, outputPerM: 20, longPromptTokens: Infinity, longInputPerM: 4, longOutputPerM: 20 },
};

/** Used for a model that is not in the table, so the report still prints (and says so). */
export const FALLBACK_PRICE: ModelPrice = MODEL_PRICES['claude-haiku-5-5']!;

/** Maximum headline length in words, by tier. The prompt asks for it and the check enforces it. */
export const HEADLINE_MAX_WORDS: Record<Tier, number> = { lead: 12, secondary: 9, brief: 7 };

/** Body length accepted by the check, as a share of the tier's word target. */
export const BODY_LENGTH_RANGE = { min: 0.4, max: 1.5 } as const;

/** Output cap. Short rewrites; a lead is ~120 words, so this leaves plenty of room. */
export const MAX_OUTPUT_TOKENS = 1024;

/** Thinking stays off and effort low: these are short rewrites of given facts. */
export const SUMMARIZER_EFFORT = 'low' as const;

/** The voice used when there is no reporter (wire copy) or no cached article for the reporter. */
export const DESK_VOICE_ID = 'desk';
export const DESK_VOICE = 'Neutral newsroom desk voice: plain, even, professional. No personal quirks.';

/** Rough tokens per character for English prose, used by dry runs (no API call). */
export const CHARS_PER_TOKEN = 3.6;
