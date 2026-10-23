// Core game types. Plain data only, so state can be saved as JSON.
import type { Angle, Attributes, Category, OriginId } from '../data/schemas.ts';

export type { Angle, Attributes, Category, OriginId };

export type PageId = 'front' | 'a2' | 'a3';
export type Tier = 'lead' | 'secondary' | 'brief';
export type Frequency = 'daily' | 'weekly' | 'monthly';
export type Stance = 'left' | 'center_left' | 'neutral' | 'center_right' | 'right';
/** What kind of paper you run. Shapes reader expectations and ad rates (simulation, milestone 4). */
export type PaperStyle = 'record' | 'neighborhood' | 'tabloid';
/** Every category gets a coverage slider. */
export type CoverageCategory = Category;

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

export interface IssueDraft {
  pages: Record<PageId, Block[]>;
  /** Extra pages switched on for this issue (each costs print money). */
  extraPages: PageId[];
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/** How a reporter writes by default. Sets the angle, length and pace of what they file. */
export type WritingStyle = 'news' | 'feature' | 'investigative';
/** How hard you push a reporter. More copy, more mistakes, lower morale. */
export type Workload = 'light' | 'normal' | 'crunch';
/** 'citywide' or a district id. */
export type Patch = string;

export interface StaffAssignment {
  beat: Category;
  patch: Patch;
  style: WritingStyle;
  workload: Workload;
  /** Attribute this reporter is working on; improves slowly each issue. */
  training: keyof Attributes | 'none';
}

export interface StaffMember {
  reporterId: string;
  hiredIssue: number;
  /** 0-100. */
  morale: number;
  assignment: StaffAssignment;
  /** Attribute growth from training, added to the base attributes (fractional). */
  growth: Partial<Record<keyof Attributes, number>>;
  /** Assignment changes queue here and take effect at the start of the next issue. */
  pendingAssignment?: StaffAssignment;
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export type ArticleStatus = 'backlog' | 'published' | 'spiked';

export interface Article {
  id: string;
  storyId: string;
  /** null = wire copy, no reporter. */
  reporterId: string | null;
  angle: Angle;
  style: WritingStyle;
  /** Natural length in column inches. */
  inches: number;
  issueFiled: number;
  /** True if the editor asked for it (rather than the reporter's beat). */
  commissioned: boolean;
  /** Filed by a reporter working their own patch (local knowledge). */
  onPatch: boolean;
  favorite: boolean;
  /** Picked for the next issue. Only selected articles show up on the layout tab. */
  selected: boolean;
  status: ArticleStatus;
  issuePublished?: number;
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export interface PaperSetup {
  paperName: string;
  cityId: string;
  origin: OriginId;
  frequency: Frequency;
  style: PaperStyle;
  /** Slider weights, 0-10 each. Shown as percentages. */
  coverage: Record<CoverageCategory, number>;
  stance: Stance;
}

export interface PrintedIssue {
  issueNumber: number;
  dateLabel: string;
  draft: IssueDraft;
  /** Article ids that ran, keyed by story id, so the printed page keeps its bylines. */
  articles: Record<string, Article>;
}

export interface GameState {
  setup: PaperSetup;
  /** 1-based issue number. */
  issueNumber: number;
  cash: number;
  debt: number;
  staff: StaffMember[];
  articles: Article[];
  /** Candidates whose references you've checked: their attributes show exactly. */
  scouted: string[];
  draft: IssueDraft;
  archive: PrintedIssue[];
  /** True once the last issue of the demo has been printed. */
  finished: boolean;
}
