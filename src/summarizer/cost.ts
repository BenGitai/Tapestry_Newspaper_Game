// Token estimates and dollar costs for the summarizer. Pure.
import { TIERS } from '../sim/balance.ts';
import type { Tier } from '../sim/types.ts';
import { CHARS_PER_TOKEN, FALLBACK_PRICE, MODEL_PRICES, type ModelPrice } from './config.ts';
import type { Prompt } from './prompt.ts';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export function priceFor(model: string): { price: ModelPrice; known: boolean } {
  const price = MODEL_PRICES[model];
  return { price: price ?? FALLBACK_PRICE, known: price !== undefined };
}

/** Dollars for one call (the rate card depends on the prompt length). */
export function callCost(model: string, u: Usage): number {
  const { price } = priceFor(model);
  const long = u.inputTokens > price.longPromptTokens;
  const inRate = long ? price.longInputPerM : price.inputPerM;
  const outRate = long ? price.longOutputPerM : price.outputPerM;
  return (u.inputTokens * inRate + u.outputTokens * outRate) / 1e6;
}

export const sumUsage = (list: Usage[]): Usage => ({
  inputTokens: list.reduce((a, u) => a + u.inputTokens, 0),
  outputTokens: list.reduce((a, u) => a + u.outputTokens, 0),
});

/** Estimated input tokens for a prompt (a dry run has no tokenizer or API). */
export function estimateInputTokens(p: Prompt): number {
  return Math.ceil((p.system.length + p.user.length) / CHARS_PER_TOKEN);
}

/**
 * Estimated output tokens: body words plus headline, deck and the JSON wrapper.
 * About 1.4 tokens per word, plus ~35 for keys, headline and facts_used.
 */
export function estimateOutputTokens(tier: Tier): number {
  const extra = tier === 'lead' ? 60 : tier === 'secondary' ? 45 : 35;
  return Math.ceil(TIERS[tier].words * 1.4 + extra);
}

export interface Extrapolation {
  storiesPerDay: number;
  days: number;
  calls: number;
  cost: number;
}

/**
 * What it would cost to write articles for a live game: every story a day gets
 * `variantsPerStory` articles (e.g. three angles at one length), each costing the
 * average call of this run.
 */
export function extrapolate(avgCallCost: number, storiesPerDay = 200, days = 30, variantsPerStory = 1): Extrapolation {
  const calls = storiesPerDay * days * variantsPerStory;
  return { storiesPerDay, days, calls, cost: calls * avgCallCost };
}
