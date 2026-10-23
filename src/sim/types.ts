// Core game types. Plain data only, so state can be saved as JSON.
import type { Angle, Category, OriginId } from '../data/schemas.ts';

export type { Angle, Category, OriginId };

export type PageId = 'front' | 'a2' | 'a3';
export type Tier = 'lead' | 'secondary' | 'brief';
export type Frequency = 'daily' | 'weekly' | 'monthly';
export type Stance = 'left' | 'center_left' | 'neutral' | 'center_right' | 'right';
/** Categories on the coverage split sliders (world has no desk). */
export type CoverageCategory = Exclude<Category, 'world'>;

export interface Rect {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface StoryBlock extends Rect {
  kind: 'story';
  id: string;
  storyId: string;
  tier: Tier;
  photo: boolean;
}

export interface AdBlock extends Rect {
  kind: 'ad';
  id: string;
  adId: string;
}

export type Block = StoryBlock | AdBlock;

export interface Assignment {
  /** null = run as wire copy (no reporter, Straight angle, wire credit). */
  reporterId: string | null;
  angle: Angle;
}

export interface IssueDraft {
  pages: Record<PageId, Block[]>;
  /** Extra pages switched on for this issue (each costs print money). */
  extraPages: PageId[];
  assignments: Record<string, Assignment>;
}

export interface PaperSetup {
  paperName: string;
  cityId: string;
  origin: OriginId;
  frequency: Frequency;
  /** Slider weights, 0-10 each. Shown as percentages. */
  coverage: Record<CoverageCategory, number>;
  stance: Stance;
}

export interface PrintedIssue {
  issueNumber: number;
  dateLabel: string;
  draft: IssueDraft;
}

export interface GameState {
  setup: PaperSetup;
  /** 1-based issue number. */
  issueNumber: number;
  cash: number;
  debt: number;
  /** Hired reporter ids. */
  staff: string[];
  draft: IssueDraft;
  archive: PrintedIssue[];
  /** True once the last issue of the demo has been printed. */
  finished: boolean;
}
