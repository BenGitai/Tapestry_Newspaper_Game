// Every tunable number in the game lives here. All values are first-pass
// placeholders (design spec section 6). Change numbers here, not in logic files.
//
// Units: the page is a grid of columns x rows. One row is one inch, so a block
// that is 2 columns wide and 5 rows tall holds 10 column inches.

import type { Tier } from './types.ts';

// ---------------------------------------------------------------------------
// Page grid
// ---------------------------------------------------------------------------

export const PAGE = {
  /** Columns across every page. */
  cols: 6,
  /** Rows (inches) top to bottom, including the masthead / page header. */
  rows: 20,
  /** Front page: rows taken by the masthead. Nothing can be placed there. */
  frontMastheadRows: 3,
  /** Inside pages: rows taken by the page header strip. */
  insideHeaderRows: 1,
  /** Front page: first row below the fold. A block whose top row is above this counts as above the fold. */
  foldRow: 11,
} as const;

/** Pages that ship with every issue, in order. */
export const BASE_PAGES = ['front', 'a2'] as const;
/** Optional extra pages. Each one adds print cost per copy. */
export const EXTRA_PAGES = ['a3'] as const;
/** Added to the print cost of every copy for each extra page run. */
export const EXTRA_PAGE_COST_PER_COPY = 0.06;

// ---------------------------------------------------------------------------
// Story blocks
// ---------------------------------------------------------------------------

export interface TierSpec {
  minCols: number;
  maxCols: number;
  minRows: number;
  maxRows: number;
  /** Rows of headline + deck. Headline area = cols x headlineRows. */
  headlineRows: number;
  /** Target word count sent to the summarizer for this tier (spec 6.1). */
  words: number;
}

export const TIERS: Record<Tier, TierSpec> = {
  lead: { minCols: 3, maxCols: 6, minRows: 6, maxRows: 12, headlineRows: 3, words: 120 },
  secondary: { minCols: 2, maxCols: 4, minRows: 3, maxRows: 9, headlineRows: 1.5, words: 60 },
  brief: { minCols: 1, maxCols: 2, minRows: 2, maxRows: 4, headlineRows: 1, words: 25 },
};

/** Optional photo on a lead story: takes this many rows, and half the block's columns (rounded up). */
export const LEAD_PHOTO_ROWS = 3;

/**
 * Fit = text inches available in the block / the story's base_column_inches.
 * Below `trimmed` the story is cut; below `cutHard` it loses most of its facts.
 * Above `padded` it reads like filler. Briefs are short by design and never get these labels.
 */
export const FIT = {
  cutHard: 0.6,
  trimmed: 0.9,
  padded: 1.6,
} as const;

/** Effect multipliers for fit (used by the simulation in milestone 4). */
export const FIT_EFFECT = {
  cutHard: 0.6,
  trimmed: 0.85,
  fits: 1.0,
  padded: 0.9,
  brief: 1.0,
} as const;

/** Prominence multiplies a story's effect (spec 6.1). */
export const PROMINENCE = {
  frontAboveFold: 1.0,
  frontBelowFold: 0.6,
  inside: 0.3,
  brief: 0.15,
  unplaced: 0,
} as const;

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------

/** Size of each advertiser's ad. Pay comes from ad_revenue_per_issue in the data file. */
export const AD_SIZES: Record<string, { cols: number; rows: number }> = {
  city_hall: { cols: 2, rows: 4 },
  transit_authority: { cols: 2, rows: 3 },
  penn_treaty_dev: { cols: 3, rows: 4 },
  helix_forge: { cols: 2, rows: 4 },
  schuylkill_savings: { cols: 3, rows: 3 },
  passyunk_eats: { cols: 2, rows: 3 },
  mariners_hardware: { cols: 2, rows: 4 },
};
export const DEFAULT_AD_SIZE = { cols: 2, rows: 3 };

/** Ads on the front page pay this much more. */
export const FRONT_PAGE_AD_MULTIPLIER = 1.25;

// ---------------------------------------------------------------------------
// Reporters
// ---------------------------------------------------------------------------

/** Column inches a reporter can file per issue = base + speed x perSpeed (speed is 1-20). */
export const FILING_CAPACITY = { base: 4, perSpeed: 0.8 } as const;

/** Number of reporters you start with (spec 6.8), chosen from starting candidates by coverage split. */
export const STARTING_STAFF = 3;

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** Day 1 of the demo. The wire text says day 1 is a Wednesday. */
export const DEMO_START_DATE = '2026-10-21';
