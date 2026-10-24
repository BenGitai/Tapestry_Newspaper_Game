import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { adStatus, hitPreview, moodOf, nextAdvertiser } from './ads.ts';
import { ADVERTISERS } from './balance.ts';
import { createGame, defaultSetup } from './newGame.ts';
import { totalReaders } from './readers.ts';
import { defaultAssignment, reporterById } from './staff.ts';
import type { GameState } from './types.ts';

const { world, stories } = loadGameData();
const entity = (id: string) => world.entities.find((e) => e.id === id)!;
const base = (): GameState => createGame(defaultSetup(), world, stories, [{ reporterId: 'okafor', assignment: defaultAssignment(world, reporterById(world, 'okafor')!) }], 3);

/** The same game with every district's readers scaled to reach a total. */
function withReaders(g: GameState, total: number): GameState {
  const now = totalReaders(g.districts);
  const districts = Object.fromEntries(Object.entries(g.districts).map(([k, d]) => [k, { ...d, readers: Math.round((d.readers * total) / now) }]));
  return { ...g, districts };
}

describe('ad desk', () => {
  it('bigger advertisers wait until the paper has enough readers', () => {
    const g = base();
    const big = entity('market_st_grocers');
    expect(adStatus(g, big).state).toBe('locked');
    expect(adStatus(g, big).readersNeeded).toBe(big.min_readers - totalReaders(g.districts));
    expect(adStatus(withReaders(g, big.min_readers + 100), big).state).toBe('open');
    expect(adStatus(g, entity('city_hall')).state).toBe('open');
  });

  it('names the next advertiser to sign', () => {
    const g = base();
    const next = nextAdvertiser(g, world)!;
    expect(next.min_readers).toBeGreaterThan(totalReaders(g.districts));
    expect(world.entities.filter((e) => e.min_readers > totalReaders(g.districts)).every((e) => e.min_readers >= next.min_readers)).toBe(true);
    expect(nextAdvertiser(withReaders(g, 1_000_000), world)).toBeUndefined();
  });

  it('pulled advertisers say when they come back', () => {
    const g = { ...base(), advertisers: { ...base().advertisers, city_hall: { relationship: 30, pulledThrough: 3 } } };
    const s = adStatus({ ...g, issueNumber: 2 }, entity('city_hall'));
    expect(s.state).toBe('pulled');
    expect(s.reason).toContain('issue 3');
    expect(adStatus({ ...g, issueNumber: 4 }, entity('city_hall')).state).toBe('open');
  });

  it('warns before a hard-hitting story would make them pull out', () => {
    const g = base();
    expect(hitPreview(g, 'city_hall', 1)).toEqual({ loss: ADVERTISERS.hitPenalty, wouldPull: ADVERTISERS.start - ADVERTISERS.hitPenalty < ADVERTISERS.pullBelow });
    const uneasy = { ...g, advertisers: { ...g.advertisers, city_hall: { relationship: ADVERTISERS.pullBelow + 5, pulledThrough: 0 } } };
    expect(hitPreview(uneasy, 'city_hall', 1).wouldPull).toBe(true);
    expect(moodOf(ADVERTISERS.pullBelow + 5)).toBe('uneasy');
    expect(moodOf(100)).toBe('happy');
  });
});
