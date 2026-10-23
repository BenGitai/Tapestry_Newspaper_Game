// Core game types. Plain data only, so state can be saved as JSON.
import type { Angle, Attributes, Category, OriginId } from '../data/schemas.ts';

export type { Angle, Attributes, Category, OriginId };

export type PageId = 'front' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6';
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
  /** Sub-focus within the beat (a subtopic id), or 'none'. */
  focus: string;
  patch: Patch;
  style: WritingStyle;
  workload: Workload;
  /** Attribute this reporter is working on; improves slowly each issue. */
  training: keyof Attributes | 'none';
}

/** What a desk head does for you. Each duty can be delegated or kept. */
export interface DeskDuties {
  filter: boolean;
  fix: boolean;
  upgrade: boolean;
  runDesk: boolean;
}

export interface StaffMember {
  reporterId: string;
  /** Reporters write; desk heads run a desk (and write a little). */
  role?: 'reporter' | 'head';
  headOf?: import('../data/schemas.ts').Desk;
  duties?: DeskDuties;
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
  /** The story is on the reporter's assigned focus. */
  onFocus: boolean;
  /** The story is on the reporter's personal interest. */
  onInterest: boolean;
  favorite: boolean;
  /** Picked for the next issue. Only selected articles show up on the layout tab. */
  selected: boolean;
  status: ArticleStatus;
  issuePublished?: number;
  /** Picked for print by the desk head (Filter duty). */
  deskPick?: boolean;
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

// ---------------------------------------------------------------------------
// Simulation state
// ---------------------------------------------------------------------------

export interface DistrictState {
  readers: number;
  /** 0-100 */
  trust: number;
  newsstands: number;
  bureau: boolean;
  /** Share of the district's print readers who take the rival paper (0..1). */
  rivalShare: number;
}

export interface AdvertiserState {
  /** 0-100 */
  relationship: number;
  /** Ads are pulled through this issue number (0 = running). */
  pulledThrough: number;
}

export interface Letter {
  name: string;
  place: string;
  text: string;
  tone: 'praise' | 'complaint';
}

export interface RevealedOutcome {
  articleId: string;
  storyId: string;
  reporterId: string | null;
  correction: boolean;
  award: boolean;
  sensationalSwing?: 'up' | 'down';
}

export interface DistrictResult {
  readers: number;
  readersChange: number;
  trust: number;
  trustChange: number;
  satisfaction: number;
}

export interface IssueResult {
  issueNumber: number;
  dateLabel: string;
  copies: number;
  copiesChange: number;
  districts: Record<string, DistrictResult>;
  revenue: { sales: number; ads: number; prizes: number };
  costs: { printing: number; distribution: number; payroll: number; overhead: number; wire: number; debt: number };
  profit: number;
  cashAfter: number;
  leanBefore: number;
  leanAfter: number;
  trustBefore: number;
  trustAfter: number;
  revealed: RevealedOutcome[];
  /** Consequences, in plain language. */
  events: string[];
  letters: Letter[];
  /** The rival's front page: story ids, lead first. */
  rivalFront: string[];
  scoops: string[];
  missed: string[];
}

export interface GameState {
  setup: PaperSetup;
  /** Seed for every random roll, so a game can be replayed. */
  seed: number;
  districts: Record<string, DistrictState>;
  /** -1 (left) .. +1 (right). Starts at the stated stance. */
  perceivedLean: number;
  advertisers: Record<string, AdvertiserState>;
  /** Print readers in the whole city; shrinks a little each issue. */
  printPool: number;
  /** Column inches published per category, all issues (for stated vs actual). */
  publishedInches: Record<Category, number>;
  results: IssueResult[];
  /** Extra pages the paper has grown into (see PAGE_UNLOCKS). */
  unlockedPages: PageId[];
  awards: number;
  corrections: number;
  /** Set when the game ended early (bankrupt). */
  endReason?: 'bankrupt';
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
