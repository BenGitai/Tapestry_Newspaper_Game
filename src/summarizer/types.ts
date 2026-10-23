import type { Angle } from '../data/schemas.ts';
import type { Tier } from '../sim/types.ts';

/** Model output shape (design spec 7.2). */
export interface ArticleText {
  headline: string;
  deck: string;
  body: string;
  /** Indexes into the story's facts list. */
  facts_used: number[];
}

export interface ArticleRequest {
  storyId: string;
  /** null = wire copy, no reporter. */
  journalistId: string | null;
  angle: Angle;
  tier: Tier;
}

export type ArticleOrigin = 'cache' | 'generated' | 'template';

export interface Article extends ArticleText {
  origin: ArticleOrigin;
}
