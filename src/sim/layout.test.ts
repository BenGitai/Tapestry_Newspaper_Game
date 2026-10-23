import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { PAGE, PROMINENCE } from './balance.ts';
import {
  adRevenue,
  checkPlacement,
  defaultShape,
  emptyDraft,
  filingCapacity,
  findFreeSpot,
  findStoryBlock,
  fitOf,
  newAdBlock,
  newStoryBlock,
  pageUsage,
  prominenceOf,
  putBlock,
  removeBlock,
  reporterLoad,
  resizeBlock,
  setExtraPage,
  setTier,
  textInches,
  togglePhoto,
  type EditResult,
} from './layout.ts';
import type { IssueDraft, StoryBlock } from './types.ts';

const { stories, world } = loadGameData();
const library = stories.storyById('d1-library')!; // 14 in
const pickles = stories.storyById('d1-pickles')!; // 6 in

function ok(r: EditResult): IssueDraft {
  if (!r.ok) throw new Error(r.reason);
  return r.draft;
}

describe('placement', () => {
  it('blocks the masthead and the edges of the page', () => {
    const d = emptyDraft();
    expect(checkPlacement(d, 'front', { col: 0, row: 0, cols: 2, rows: 4 }).ok).toBe(false);
    expect(checkPlacement(d, 'front', { col: 0, row: PAGE.frontMastheadRows, cols: 2, rows: 4 }).ok).toBe(true);
    expect(checkPlacement(d, 'front', { col: 5, row: 5, cols: 2, rows: 4 }).ok).toBe(false);
    expect(checkPlacement(d, 'front', { col: 0, row: PAGE.rows - 2, cols: 2, rows: 4 }).ok).toBe(false);
    expect(checkPlacement(d, 'a2', { col: 0, row: PAGE.insideHeaderRows, cols: 2, rows: 4 }).ok).toBe(true);
  });

  it('does not let blocks overlap', () => {
    const d = ok(putBlock(emptyDraft(), 'front', newStoryBlock(library, 'secondary', { col: 0, row: 3 })));
    const check = checkPlacement(d, 'front', { col: 1, row: 4, cols: 2, rows: 3 });
    expect(check.ok).toBe(false);
    expect(check.ok ? '' : check.reason).toMatch(/Overlaps/);
    // Moving a block onto its own old footprint is fine.
    const moved = putBlock(d, 'front', { ...(d.pages.front[0] as StoryBlock), col: 1 });
    expect(moved.ok).toBe(true);
  });

  it('a story lives in one place only', () => {
    let d = ok(putBlock(emptyDraft(), 'front', newStoryBlock(library, 'secondary', { col: 0, row: 3 })));
    d = ok(putBlock(d, 'a2', { ...(d.pages.front[0] as StoryBlock), col: 2, row: 2 }));
    expect(d.pages.front).toHaveLength(0);
    expect(d.pages.a2).toHaveLength(1);
    expect(findStoryBlock(d, library.id)?.page).toBe('a2');
  });

  it('extra pages must be switched on, and switching off clears them', () => {
    const block = newStoryBlock(pickles, 'brief', { col: 0, row: 2 });
    expect(putBlock(emptyDraft(), 'a3', block).ok).toBe(false);
    let d = setExtraPage(emptyDraft(), 'a3', true);
    d = ok(putBlock(d, 'a3', block));
    expect(d.pages.a3).toHaveLength(1);
    d = setExtraPage(d, 'a3', false);
    expect(d.pages.a3).toHaveLength(0);
    expect(d.extraPages).toEqual([]);
  });

  it('removing a block clears it from the page', () => {
    const d = ok(putBlock(emptyDraft(), 'front', newStoryBlock(library, 'secondary', { col: 0, row: 3 })));
    expect(removeBlock(d, 'story:d1-library').pages.front).toHaveLength(0);
  });
});

describe('shapes and fit', () => {
  it('default shapes fit the story', () => {
    for (const s of stories.allStories()) {
      for (const tier of ['lead', 'secondary'] as const) {
        const shape = defaultShape(tier, s);
        const block = newStoryBlock(s, tier, { col: 0, row: 3 });
        expect(block.cols).toBe(shape.cols);
        expect(fitOf(s, block).status).toBe('fits');
      }
    }
  });

  it('text inches subtract headline and photo', () => {
    expect(textInches({ tier: 'secondary', photo: false, cols: 2, rows: 6 })).toBe(9);
    expect(textInches({ tier: 'lead', photo: false, cols: 4, rows: 7 })).toBe(16);
    expect(textInches({ tier: 'lead', photo: true, cols: 4, rows: 7 })).toBe(10);
  });

  it('labels cut, trimmed and padded stories', () => {
    const base = newStoryBlock(library, 'secondary', { col: 0, row: 3 });
    expect(fitOf(library, { ...base, rows: 4 }).status).toBe('cutHard'); // 5 / 14
    expect(fitOf(library, { ...base, rows: 7 }).status).toBe('trimmed'); // 11 / 14
    const big = newStoryBlock(pickles, 'secondary', { col: 0, row: 3 });
    expect(fitOf(pickles, { ...big, cols: 3, rows: 6 }).status).toBe('padded'); // 13.5 / 6
    expect(fitOf(library, newStoryBlock(library, 'brief', { col: 0, row: 3 })).status).toBe('brief');
  });

  it('resizing stays inside the tier limits', () => {
    let d = ok(putBlock(emptyDraft(), 'front', newStoryBlock(library, 'secondary', { col: 0, row: 3 })));
    d = ok(resizeBlock(d, 'story:d1-library', 20, 1));
    const b = d.pages.front[0] as StoryBlock;
    expect(b.cols).toBe(4);
    expect(b.rows).toBe(3);
  });

  it('ads cannot be resized', () => {
    const d = ok(putBlock(emptyDraft(), 'a2', newAdBlock('city_hall', { col: 0, row: 1 })));
    expect(resizeBlock(d, 'ad:city_hall', 4, 4).ok).toBe(false);
  });

  it('changing tier re-shapes and finds room nearby', () => {
    let d = ok(putBlock(emptyDraft(), 'front', newStoryBlock(library, 'secondary', { col: 0, row: 3 })));
    d = ok(setTier(d, 'story:d1-library', 'lead', library));
    const b = d.pages.front[0] as StoryBlock;
    expect(b.tier).toBe('lead');
    expect(b.photo).toBe(true);
    expect(b.cols).toBe(4);
    d = ok(togglePhoto(d, b.id));
    expect((d.pages.front[0] as StoryBlock).photo).toBe(false);
  });

  it('changing tier fails cleanly when the page is full', () => {
    let d = emptyDraft();
    // Fill A2 with briefs 1x3 in every spot.
    const all = stories.allStories();
    let i = 0;
    for (let row = 1; row + 3 <= PAGE.rows; row += 3) {
      for (let col = 0; col < PAGE.cols; col++) {
        const s = all[i++ % all.length]!;
        const r = putBlock(d, 'a2', { ...newStoryBlock(s, 'brief', { col, row }), id: `story:x${i}`, storyId: `x${i}` });
        if (r.ok) d = r.draft;
      }
    }
    const first = d.pages.a2[0]!;
    const r = setTier(d, first.id, 'lead', library);
    expect(r.ok).toBe(false);
  });

  it('findFreeSpot returns the closest free position', () => {
    const d = ok(putBlock(emptyDraft(), 'front', newStoryBlock(library, 'secondary', { col: 0, row: 3 })));
    expect(findFreeSpot(d, 'front', { cols: 2, rows: 3 })).toEqual({ col: 2, row: 3 });
    expect(findFreeSpot(d, 'front', { cols: 2, rows: 3 }, undefined, { col: 0, row: 12 })).toEqual({ col: 0, row: 12 });
  });
});

describe('prominence', () => {
  it('follows the spec multipliers', () => {
    const above = newStoryBlock(library, 'secondary', { col: 0, row: 3 });
    const below = { ...above, row: PAGE.foldRow };
    expect(prominenceOf('front', above)).toBe(PROMINENCE.frontAboveFold);
    expect(prominenceOf('front', below)).toBe(PROMINENCE.frontBelowFold);
    expect(prominenceOf('a2', above)).toBe(PROMINENCE.inside);
    expect(prominenceOf('front', { ...above, tier: 'brief' })).toBe(PROMINENCE.brief);
  });

  it('a block whose top row is above the fold counts as above', () => {
    const b = newStoryBlock(library, 'secondary', { col: 0, row: PAGE.foldRow - 1 });
    expect(prominenceOf('front', b)).toBe(PROMINENCE.frontAboveFold);
  });
});

describe('money and filing', () => {
  it('front-page ads pay more', () => {
    let d = ok(putBlock(emptyDraft(), 'front', newAdBlock('city_hall', { col: 0, row: 15 })));
    d = ok(putBlock(d, 'a2', newAdBlock('mariners_hardware', { col: 0, row: 1 })));
    expect(adRevenue(d, world.entities)).toBe(Math.round(350 * 1.25) + 150);
  });

  it('page usage adds up', () => {
    const d = ok(putBlock(emptyDraft(), 'front', newAdBlock('city_hall', { col: 0, row: 15 })));
    const u = pageUsage(d, 'front');
    expect(u.adInches).toBe(8);
    expect(u.totalInches).toBe(PAGE.cols * (PAGE.rows - PAGE.frontMastheadRows));
    expect(u.freeInches).toBe(u.totalInches - 8);
  });

  it('reporters file the text inches of placed stories only', () => {
    let d = ok(putBlock(emptyDraft(), 'front', newStoryBlock(library, 'secondary', { col: 0, row: 3 })));
    d = { ...d, assignments: { 'd1-library': { reporterId: 'okafor', angle: 'hard' }, 'd1-pickles': { reporterId: 'okafor', angle: 'puff' } } };
    expect(reporterLoad(d, 'okafor')).toBe(textInches(d.pages.front[0] as StoryBlock));
    expect(reporterLoad(d, 'tran')).toBe(0);
  });

  it('faster reporters can file more', () => {
    const brenner = world.staff_pool.find((r) => r.id === 'brenner')!;
    const ferraro = world.staff_pool.find((r) => r.id === 'ferraro')!;
    expect(filingCapacity(brenner)).toBeGreaterThan(filingCapacity(ferraro));
  });
});
