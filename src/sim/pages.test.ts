import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { PAGE_UNLOCKS } from './balance.ts';
import { activePages, setExtraPage } from './layout.ts';
import { advanceIssue, createGame, defaultSetup } from './newGame.ts';
import { isUnlocked, nextUnlock, qualifiedPages, unlockPages } from './pages.ts';
import { resolveIssue } from './simulate.ts';
import { defaultAssignment, reporterById } from './staff.ts';
import type { GameState } from './types.ts';

const { world, stories } = loadGameData();

function base(): GameState {
  return createGame(defaultSetup(), world, stories, [{ reporterId: 'okafor', assignment: defaultAssignment(world, reporterById(world, 'okafor')!) }], 2);
}

/** Spread readers and newsstands evenly across the districts. */
function grown(g: GameState, readers: number, stands: number): GameState {
  const ids = Object.keys(g.districts);
  const districts = { ...g.districts };
  ids.forEach((id, i) => {
    districts[id] = { ...districts[id]!, readers: Math.round(readers / ids.length), newsstands: Math.floor(stands / ids.length) + (i < stands % ids.length ? 1 : 0) };
  });
  return { ...g, districts };
}

describe('page unlocks', () => {
  it('a new paper has front, A2 and A3', () => {
    const g = base();
    expect(isUnlocked(g, 'a3')).toBe(true);
    expect(isUnlocked(g, 'a4')).toBe(false);
    expect(nextUnlock(g)?.page).toBe('a4');
  });

  it('needs both readers and newsstands', () => {
    const a4 = PAGE_UNLOCKS.find((u) => u.page === 'a4')!;
    expect(qualifiedPages(grown(base(), a4.readers, 0))).not.toContain('a4');
    expect(qualifiedPages(grown(base(), 0, a4.newsstands))).not.toContain('a4');
    expect(qualifiedPages(grown(base(), a4.readers, a4.newsstands))).toContain('a4');
  });

  it('unlocks are permanent and announced after an issue', () => {
    const a5 = PAGE_UNLOCKS.find((u) => u.page === 'a5')!;
    const big = grown(base(), a5.readers * 1.3, a5.newsstands);
    const { game, result } = resolveIssue(big, world, stories);
    expect(game.unlockedPages).toEqual(expect.arrayContaining(['a3', 'a4', 'a5']));
    expect(result.events.some((e) => e.includes('page A4'))).toBe(true);
    // Even if readers fall later, the pages stay.
    const shrunk = unlockPages(grown(game, 100, 0));
    expect(shrunk.game.unlockedPages).toContain('a5');
  });

  it('pages you ran stay on next issue', () => {
    let g = base();
    g = { ...g, draft: setExtraPage(g.draft, 'a3', true) };
    const next = advanceIssue(g, world, stories);
    expect(activePages(next.draft)).toContain('a3');
  });
});
