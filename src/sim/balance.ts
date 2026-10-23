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

/** Column inches a reporter can file per issue = (base + speed x perSpeed) x workload x style pace. Speed is 1-20. */
export const FILING_CAPACITY = { base: 4, perSpeed: 0.8 } as const;

export const WORKLOAD = {
  light: { capacity: 0.8, moralePerIssue: 3, correctionRisk: 0.8 },
  normal: { capacity: 1.0, moralePerIssue: 0, correctionRisk: 1.0 },
  crunch: { capacity: 1.3, moralePerIssue: -6, correctionRisk: 1.5 },
} as const;

/** Writing style: default angle, how long the pieces run and how fast they get written. */
export const STYLE = {
  news: { angle: 'straight', length: 1.0, pace: 1.0 },
  feature: { angle: 'puff', length: 0.9, pace: 1.0 },
  investigative: { angle: 'hard', length: 1.3, pace: 0.8 },
} as const;

/** Starting staff: how many you may hire at the start, and the payroll you can afford per issue. */
export const STARTING_STAFF = { min: 2, max: 4 } as const;
export const STARTING_PAYROLL_CAP: Record<'founded' | 'inherited' | 'bought', number> = {
  founded: 360,
  inherited: 440,
  bought: 400,
};
/** Most reporters you can employ at once in the demo. */
export const MAX_STAFF = 6;

/** Hiring mid-game costs a signing fee; releasing someone costs severance. Both are multiples of salary per issue. */
export const SIGNING_FEE_MULTIPLIER = 2;
export const SEVERANCE_MULTIPLIER = 2;
/** Cost of checking a candidate's references (reveals their exact attributes). */
export const REFERENCE_CHECK_COST = 50;
/** Unscouted candidates show each attribute as a range this many points either side. */
export const SCOUT_RANGE = 3;

/** Training adds this much to the chosen attribute per issue (displayed rounded down; max 20). */
export const TRAINING_PER_ISSUE = 0.35;

/** Morale gained per article of theirs that runs, and its limits. */
export const MORALE = { perPublished: 2, min: 0, max: 100 } as const;

// ---------------------------------------------------------------------------
// Newsroom: filing and the backlog
// ---------------------------------------------------------------------------

/** Unpublished articles lose this much value per issue they sit in the backlog. */
export const STALENESS_PER_ISSUE = 0.25;
/** Value never drops below this. */
export const STALENESS_FLOOR = 0.2;
/** An article whose storyline has moved on (a newer step is on the wire) keeps this share of its value. */
export const SUPERSEDED_VALUE = 0.3;

// ---------------------------------------------------------------------------
// Article scorecard (half shown, half hidden; values are 0..1)
// ---------------------------------------------------------------------------

export const SCORECARD = {
  /** Readership appeal weights. */
  readership: { importance: 0.5, flair: 0.25, onPatch: 0.1, styleMatch: 0.1, offBeat: -0.1 },
  /** Political heat: |story lean| x angle factor x (base + charge / 20). */
  heatAngle: { puff: 0.5, straight: 0, hard: 1 },
  heatChargeBase: 0.5,
  /** Extra heat per targeted institution on a Hard-hitting piece. */
  heatPerTarget: 0.15,
  /** Correction risk = (20 - accuracy) / 20 x this x workload risk. */
  correctionBase: 0.35,
  /** Award chance = impact/20 x importance/5 x this x style bonus. */
  awardBase: 0.2,
  awardInvestigative: 1.6,
  /** A piece is sensational when it runs Hard-hitting by a reporter with charge >= this, or tact <= that. */
  sensationalCharge: 14,
  sensationalTact: 6,
  /** Sensational pieces swing harder both ways (awards and lost readers). */
  sensationalSwing: 1.5,
} as const;

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** Day 1 of the demo. The wire text says day 1 is a Wednesday. */
export const DEMO_START_DATE = '2026-10-21';
