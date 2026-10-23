// Paste-up rules: the page grid, placement, fit and prominence.
// Pure functions over IssueDraft; every edit returns a new draft.
import type { Entity, Reporter, Story } from '../data/schemas.ts';
import {
  AD_SIZES,
  DEFAULT_AD_SIZE,
  FILING_CAPACITY,
  FIT,
  FRONT_PAGE_AD_MULTIPLIER,
  LEAD_PHOTO_ROWS,
  PAGE,
  PROMINENCE,
  TIERS,
} from './balance.ts';
import type { AdBlock, Block, IssueDraft, PageId, Rect, StoryBlock, Tier } from './types.ts';

export const ALL_PAGES: PageId[] = ['front', 'a2', 'a3'];

export function emptyDraft(): IssueDraft {
  return { pages: { front: [], a2: [], a3: [] }, extraPages: [], assignments: {} };
}

/** Pages that will actually print in this draft, in order. */
export function activePages(draft: IssueDraft): PageId[] {
  return ALL_PAGES.filter((p) => p === 'front' || p === 'a2' || draft.extraPages.includes(p));
}

export function pageLabel(page: PageId): string {
  return page === 'front' ? 'Front' : page.toUpperCase();
}

/** First and one-past-last row that blocks may occupy on a page. */
export function usableRows(page: PageId): { top: number; bottom: number } {
  return { top: page === 'front' ? PAGE.frontMastheadRows : PAGE.insideHeaderRows, bottom: PAGE.rows };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;
}

export type PlacementCheck = { ok: true } | { ok: false; reason: string; blockingId?: string };

export function checkPlacement(draft: IssueDraft, page: PageId, rect: Rect, ignoreId?: string): PlacementCheck {
  const { top, bottom } = usableRows(page);
  if (page !== 'front' && page !== 'a2' && !draft.extraPages.includes(page)) {
    return { ok: false, reason: `${pageLabel(page)} is not running in this issue` };
  }
  if (rect.col < 0 || rect.col + rect.cols > PAGE.cols) return { ok: false, reason: 'Runs off the side of the page' };
  if (rect.row < top) return { ok: false, reason: page === 'front' ? 'That space is the masthead' : 'That space is the page header' };
  if (rect.row + rect.rows > bottom) return { ok: false, reason: 'Runs off the bottom of the page' };
  for (const b of draft.pages[page]) {
    if (b.id !== ignoreId && rectsOverlap(rect, b)) return { ok: false, reason: 'Overlaps another item', blockingId: b.id };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Shapes and fit
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function clampToTier(tier: Tier, cols: number, rows: number): { cols: number; rows: number } {
  const t = TIERS[tier];
  return { cols: clamp(Math.round(cols), t.minCols, t.maxCols), rows: clamp(Math.round(rows), t.minRows, t.maxRows) };
}

export function photoArea(block: Pick<StoryBlock, 'tier' | 'photo' | 'cols'>): number {
  if (block.tier !== 'lead' || !block.photo) return 0;
  return Math.ceil(block.cols / 2) * LEAD_PHOTO_ROWS;
}

/** Column inches left for body text after headline and photo. */
export function textInches(block: Pick<StoryBlock, 'tier' | 'photo' | 'cols' | 'rows'>): number {
  const head = block.cols * TIERS[block.tier].headlineRows;
  return Math.max(0, block.cols * block.rows - head - photoArea(block));
}

/** The shape a story gets when it first lands in a tier: the smallest that fits its base length. */
export function defaultShape(tier: Tier, story: Pick<Story, 'base_column_inches'>, photo = tier === 'lead'): { cols: number; rows: number } {
  const t = TIERS[tier];
  const cols = tier === 'lead' ? 4 : tier === 'secondary' ? 2 : 1;
  if (tier === 'brief') return { cols, rows: 3 };
  for (let rows = t.minRows; rows <= t.maxRows; rows++) {
    if (textInches({ tier, photo, cols, rows }) >= story.base_column_inches) return { cols, rows };
  }
  return { cols, rows: t.maxRows };
}

export type FitStatus = 'cutHard' | 'trimmed' | 'fits' | 'padded' | 'brief';

export function fitOf(story: Pick<Story, 'base_column_inches'>, block: StoryBlock): { ratio: number; status: FitStatus } {
  const ratio = textInches(block) / story.base_column_inches;
  if (block.tier === 'brief') return { ratio, status: 'brief' };
  if (ratio < FIT.cutHard) return { ratio, status: 'cutHard' };
  if (ratio < FIT.trimmed) return { ratio, status: 'trimmed' };
  if (ratio > FIT.padded) return { ratio, status: 'padded' };
  return { ratio, status: 'fits' };
}

export const FIT_LABEL: Record<FitStatus, string> = {
  cutHard: 'Cut hard',
  trimmed: 'Trimmed',
  fits: 'Fits',
  padded: 'Padded',
  brief: 'Brief',
};

export function isAboveFold(page: PageId, block: Rect): boolean {
  return page === 'front' && block.row < PAGE.foldRow;
}

export function prominenceOf(page: PageId, block: StoryBlock): number {
  if (block.tier === 'brief') return PROMINENCE.brief;
  if (page !== 'front') return PROMINENCE.inside;
  return isAboveFold(page, block) ? PROMINENCE.frontAboveFold : PROMINENCE.frontBelowFold;
}

export function placementLabel(page: PageId, block: StoryBlock): string {
  const where = page === 'front' ? (isAboveFold(page, block) ? 'front, above the fold' : 'front, below the fold') : pageLabel(page);
  return `${where} · ${block.tier}`;
}

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------

export function adSize(adId: string): { cols: number; rows: number } {
  return AD_SIZES[adId] ?? DEFAULT_AD_SIZE;
}

export function adPay(entity: Pick<Entity, 'ad_revenue_per_issue'>, page: PageId): number {
  return Math.round(entity.ad_revenue_per_issue * (page === 'front' ? FRONT_PAGE_AD_MULTIPLIER : 1));
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export interface Located<B extends Block = Block> {
  page: PageId;
  block: B;
}

export function findBlock(draft: IssueDraft, blockId: string): Located | undefined {
  for (const page of ALL_PAGES) {
    const block = draft.pages[page].find((b) => b.id === blockId);
    if (block) return { page, block };
  }
  return undefined;
}

export function findStoryBlock(draft: IssueDraft, storyId: string): Located<StoryBlock> | undefined {
  for (const page of ALL_PAGES) {
    const block = draft.pages[page].find((b): b is StoryBlock => b.kind === 'story' && b.storyId === storyId);
    if (block) return { page, block };
  }
  return undefined;
}

export function findAdBlock(draft: IssueDraft, adId: string): Located<AdBlock> | undefined {
  for (const page of ALL_PAGES) {
    const block = draft.pages[page].find((b): b is AdBlock => b.kind === 'ad' && b.adId === adId);
    if (block) return { page, block };
  }
  return undefined;
}

export function storyBlockId(storyId: string): string {
  return `story:${storyId}`;
}

export function adBlockId(adId: string): string {
  return `ad:${adId}`;
}

// ---------------------------------------------------------------------------
// Edits (each returns a new draft, or an error reason)
// ---------------------------------------------------------------------------

export type EditResult = { ok: true; draft: IssueDraft } | { ok: false; reason: string };

function withPages(draft: IssueDraft, page: PageId, blocks: Block[]): IssueDraft {
  return { ...draft, pages: { ...draft.pages, [page]: blocks } };
}

function removeFromAll(draft: IssueDraft, blockId: string): IssueDraft {
  const found = findBlock(draft, blockId);
  if (!found) return draft;
  return withPages(draft, found.page, draft.pages[found.page].filter((b) => b.id !== blockId));
}

/** Put a block at a position (adding it, or moving it from wherever it was). */
export function putBlock(draft: IssueDraft, page: PageId, block: Block): EditResult {
  const check = checkPlacement(draft, page, block, block.id);
  if (!check.ok) return check;
  const without = removeFromAll(draft, block.id);
  return { ok: true, draft: withPages(without, page, [...without.pages[page], block]) };
}

export function removeBlock(draft: IssueDraft, blockId: string): IssueDraft {
  return removeFromAll(draft, blockId);
}

export function newStoryBlock(story: Story, tier: Tier, at: { col: number; row: number }): StoryBlock {
  const photo = tier === 'lead';
  return { kind: 'story', id: storyBlockId(story.id), storyId: story.id, tier, photo, ...at, ...defaultShape(tier, story, photo) };
}

export function newAdBlock(adId: string, at: { col: number; row: number }): AdBlock {
  return { kind: 'ad', id: adBlockId(adId), adId, ...at, ...adSize(adId) };
}

/** Scan a page for the free spot closest to `near` (or top-left first) that fits a shape. */
export function findFreeSpot(
  draft: IssueDraft,
  page: PageId,
  shape: { cols: number; rows: number },
  ignoreId?: string,
  near?: { col: number; row: number },
): { col: number; row: number } | undefined {
  const { top, bottom } = usableRows(page);
  let best: { col: number; row: number; d: number } | undefined;
  for (let row = top; row + shape.rows <= bottom; row++) {
    for (let col = 0; col + shape.cols <= PAGE.cols; col++) {
      if (!checkPlacement(draft, page, { col, row, ...shape }, ignoreId).ok) continue;
      const d = near ? Math.abs(col - near.col) + Math.abs(row - near.row) : row * PAGE.cols + col;
      if (!best || d < best.d) best = { col, row, d };
    }
  }
  return best && { col: best.col, row: best.row };
}

/** Change a story's tier. Re-shapes it to the new tier's default and keeps it as close to where it was as possible. */
export function setTier(draft: IssueDraft, blockId: string, tier: Tier, story: Story): EditResult {
  const found = findBlock(draft, blockId);
  if (!found || found.block.kind !== 'story') return { ok: false, reason: 'Not a story on the page' };
  const old = found.block;
  const photo = tier === 'lead' ? old.tier === 'lead' ? old.photo : true : false;
  const shape = defaultShape(tier, story, photo);
  const spot = findFreeSpot(draft, found.page, shape, blockId, old);
  if (!spot) return { ok: false, reason: `No room on ${pageLabel(found.page)} for a ${tier}` };
  return putBlock(draft, found.page, { ...old, tier, photo, ...shape, ...spot });
}

export function resizeBlock(draft: IssueDraft, blockId: string, cols: number, rows: number): EditResult {
  const found = findBlock(draft, blockId);
  if (!found) return { ok: false, reason: 'Not on the page' };
  if (found.block.kind !== 'story') return { ok: false, reason: 'Ads are sold at a fixed size' };
  const shape = clampToTier(found.block.tier, cols, rows);
  return putBlock(draft, found.page, { ...found.block, ...shape });
}

export function togglePhoto(draft: IssueDraft, blockId: string): EditResult {
  const found = findBlock(draft, blockId);
  if (!found || found.block.kind !== 'story' || found.block.tier !== 'lead') return { ok: false, reason: 'Only a lead can carry a photo' };
  return putBlock(draft, found.page, { ...found.block, photo: !found.block.photo });
}

/** Turn an extra page on or off. Turning a page off sends its items back to the wire / ad desk. */
export function setExtraPage(draft: IssueDraft, page: PageId, on: boolean): IssueDraft {
  if (page === 'front' || page === 'a2') return draft;
  if (on) return draft.extraPages.includes(page) ? draft : { ...draft, extraPages: [...draft.extraPages, page] };
  return { ...withPages(draft, page, []), extraPages: draft.extraPages.filter((p) => p !== page) };
}

// ---------------------------------------------------------------------------
// Reporters and page accounting
// ---------------------------------------------------------------------------

export function filingCapacity(reporter: Pick<Reporter, 'attributes'>): number {
  return Math.round(FILING_CAPACITY.base + reporter.attributes.speed * FILING_CAPACITY.perSpeed);
}

/** Column inches a reporter is filing in this draft (only stories that are placed count). */
export function reporterLoad(draft: IssueDraft, reporterId: string): number {
  let inches = 0;
  for (const [storyId, a] of Object.entries(draft.assignments)) {
    if (a.reporterId !== reporterId) continue;
    const found = findStoryBlock(draft, storyId);
    if (found) inches += textInches(found.block);
  }
  return Math.round(inches * 10) / 10;
}

export interface PageUsage {
  totalInches: number;
  newsInches: number;
  adInches: number;
  freeInches: number;
}

export function pageUsage(draft: IssueDraft, page: PageId): PageUsage {
  const { top, bottom } = usableRows(page);
  const totalInches = PAGE.cols * (bottom - top);
  let newsInches = 0;
  let adInches = 0;
  for (const b of draft.pages[page]) {
    if (b.kind === 'story') newsInches += b.cols * b.rows;
    else adInches += b.cols * b.rows;
  }
  return { totalInches, newsInches, adInches, freeInches: totalInches - newsInches - adInches };
}

export function adRevenue(draft: IssueDraft, entities: Entity[]): number {
  let total = 0;
  for (const page of activePages(draft)) {
    for (const b of draft.pages[page]) {
      if (b.kind !== 'ad') continue;
      const e = entities.find((x) => x.id === b.adId);
      if (e) total += adPay(e, page);
    }
  }
  return total;
}
