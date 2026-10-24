// The pre-generated article cache (data/generated/summaries.cache.json).
// Key: story id + journalist id + angle + length tier (spec 7.4). A missing
// journalist, or a reporter without their own entry, uses the neutral desk voice.
import { z } from 'zod';
import { ANGLES, type Angle } from '../data/schemas.ts';
import type { Tier } from '../sim/types.ts';
import { DESK_VOICE_ID } from './config.ts';
import type { ArticleRequest, ArticleText } from './types.ts';

export function cacheKey(storyId: string, journalistId: string | null, angle: Angle, tier: Tier): string {
  return [storyId, journalistId ?? DESK_VOICE_ID, angle, tier].join('|');
}

export function requestKey(req: ArticleRequest): string {
  return cacheKey(req.storyId, req.journalistId, req.angle, req.tier);
}

export const cacheEntrySchema = z.object({
  headline: z.string(),
  deck: z.string(),
  body: z.string(),
  facts_used: z.array(z.number().int()),
  /** Model that wrote it, and what the call cost in tokens. */
  model: z.string(),
  input_tokens: z.number().int(),
  output_tokens: z.number().int(),
});
export type CacheEntry = z.infer<typeof cacheEntrySchema>;

export const cacheFileSchema = z.object({
  version: z.literal(1),
  /** ISO time of the last script run that changed the file; null while it is empty. */
  generated_at: z.string().nullable(),
  entries: z.record(z.string(), cacheEntrySchema),
});
export type CacheFile = z.infer<typeof cacheFileSchema>;

export const emptyCache = (): CacheFile => ({ version: 1, generated_at: null, entries: {} });

export function parseCache(raw: unknown): CacheFile {
  return cacheFileSchema.parse(raw);
}

export function entryToText(e: CacheEntry): ArticleText {
  return { headline: e.headline, deck: e.deck, body: e.body, facts_used: e.facts_used };
}

/** Angles in a cache key are validated when loading so a typo fails loudly. */
export function validateCacheKeys(cache: CacheFile): void {
  for (const key of Object.keys(cache.entries)) {
    const [, , angle, tier] = key.split('|');
    if (!ANGLES.includes(angle as Angle) || !['lead', 'secondary', 'brief'].includes(tier ?? '')) throw new Error(`Bad summaries cache key: ${key}`);
  }
}
