import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { STALENESS_PER_ISSUE, STYLE } from './balance.ts';
import { createGame, defaultSetup, type Hire } from './newGame.ts';
import { angleFor, articleInches, backlog, commission, fileBeatArticles, freshness, inchesFiled, isCovered, remainingCapacity, settleAfterPrint, updateArticle, wireForIssue } from './newsroom.ts';
import { newStoryBlock, putBlock } from './layout.ts';
import { defaultAssignment, filingCapacity, reporterById } from './staff.ts';
import type { GameState, StaffAssignment } from './types.ts';

const { world, stories } = loadGameData();

function game(staff: [string, Partial<StaffAssignment>?][], issue = 1): GameState {
  const hires: Hire[] = staff.map(([id, asg]) => ({ reporterId: id, assignment: { ...defaultAssignment(world, reporterById(world, id)!), ...asg } }));
  const g = createGame(defaultSetup(), world, stories, hires);
  if (issue === 1) return g;
  return fileBeatArticles({ ...g, issueNumber: issue, articles: [] }, world, stories);
}

describe('beat filing', () => {
  it('reporters only file stories on their beat and patch', () => {
    const g = game([['okafor'], ['kowalczyk']]);
    for (const a of g.articles) {
      const s = stories.storyById(a.storyId)!;
      expect(a.reporterId === 'okafor' ? s.category : 'sports').toBe(a.reporterId === 'okafor' ? 'politics' : s.category);
    }
    expect(g.articles.map((a) => a.storyId).sort()).toEqual(['d1-library', 'd1-phillies']);
  });

  it('a district patch limits stories to that district and marks local knowledge', () => {
    const g = game([['tran', { beat: 'social', patch: 'north_philly' }]], 2);
    expect(g.articles.map((a) => a.storyId)).toEqual(['d2-fire']);
    expect(g.articles[0]!.onPatch).toBe(true);
    const elsewhere = game([['tran', { beat: 'social', patch: 'center_city' }]], 2);
    expect(elsewhere.articles).toHaveLength(0);
  });

  it('everyone can file their first piece, even if it is longer than their capacity', () => {
    const g = game([['okafor']]);
    const cap = filingCapacity(reporterById(world, 'okafor')!, g.staff[0]);
    expect(stories.storyById('d1-library')!.base_column_inches).toBeGreaterThan(cap);
    expect(g.articles.map((a) => a.storyId)).toContain('d1-library');
  });

  it('never files extra pieces past capacity', () => {
    const g = game([['brenner', { beat: 'economy', workload: 'light' }]], 2);
    const cap = filingCapacity(reporterById(world, 'brenner')!, g.staff[0]);
    const filed = g.articles.map((a) => a.inches);
    expect(filed.length).toBeGreaterThan(0);
    expect(filed.reduce((x, y) => x + y, 0) - (filed[filed.length - 1] ?? 0)).toBeLessThanOrEqual(cap);
    expect(inchesFiled(g, 'brenner') <= cap || filed.length === 1).toBe(true);
  });

  it('crunch files more than light', () => {
    const light = game([['okafor', { beat: 'economy', workload: 'light' }]], 2);
    const crunch = game([['okafor', { beat: 'economy', workload: 'crunch' }]], 2);
    expect(inchesFiled(crunch, 'okafor')).toBeGreaterThanOrEqual(inchesFiled(light, 'okafor'));
    expect(filingCapacity(reporterById(world, 'okafor')!, crunch.staff[0])).toBeGreaterThan(filingCapacity(reporterById(world, 'okafor')!, light.staff[0]));
  });

  it('writing style sets angle and length; sensitive stories never get Puff', () => {
    const fire = stories.storyById('d2-fire')!;
    expect(angleFor('feature', fire)).toBe('straight');
    expect(angleFor('feature', stories.storyById('d1-pickles')!)).toBe('puff');
    expect(angleFor('investigative', fire)).toBe('hard');
    expect(articleInches(fire, 'investigative')).toBe(Math.round(10 * STYLE.investigative.length));
  });

  it('two reporters never file the same story', () => {
    const g = game([['okafor'], ['brenner']]);
    const ids = g.articles.map((a) => a.storyId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('commissions', () => {
  it('a commission uses the reporter’s remaining copy and goes straight to the print pile', () => {
    const g = game([['okafor'], ['kowalczyk']]);
    const before = remainingCapacity(g, world, g.staff[1]!);
    const r = commission(g, world, stories, 'd1-pickles', 'kowalczyk');
    if (!r.ok) throw new Error(r.reason);
    const a = r.game.articles.find((x) => x.storyId === 'd1-pickles')!;
    expect(a.commissioned).toBe(true);
    expect(a.selected).toBe(true);
    expect(remainingCapacity(r.game, world, r.game.staff[1]!)).toBe(before - a.inches);
  });

  it('refuses stories already covered, off this issue’s wire, or too long for the time left', () => {
    const g = game([['okafor'], ['tran']]);
    expect(commission(g, world, stories, 'd1-library', 'tran').ok).toBe(false);
    expect(commission(g, world, stories, 'd2-fire', 'tran').ok).toBe(false);
    const busy = { ...g, articles: [...g.articles, { ...g.articles[0]!, id: 'x', storyId: 'd1-robotics', reporterId: 'tran', inches: 99 }] };
    const r = commission(busy, world, stories, 'd1-sewers', 'tran');
    expect(r.ok).toBe(false);
  });

  it('wire copy needs no reporter and runs straight', () => {
    const g = game([['okafor']]);
    const r = commission(g, world, stories, 'd1-bridges', null);
    if (!r.ok) throw new Error(r.reason);
    const a = r.game.articles.find((x) => x.storyId === 'd1-bridges')!;
    expect(a.reporterId).toBeNull();
    expect(a.angle).toBe('straight');
    expect(isCovered(r.game, 'd1-bridges')).toBe(true);
  });

  it('commissioned Puff on a sensitive story is refused', () => {
    const g = game([['tran', { beat: 'culture' }]], 2);
    expect(commission(g, world, stories, 'd2-fire', 'tran', 'puff').ok).toBe(false);
  });
});

describe('backlog', () => {
  it('unplaced articles stay in the backlog after printing; placed ones are published', () => {
    let g = game([['okafor'], ['kowalczyk']]);
    const lib = g.articles.find((a) => a.storyId === 'd1-library')!;
    g = updateArticle(g, lib.id, { selected: true });
    const placed = putBlock(g.draft, 'front', newStoryBlock(stories.storyById('d1-library')!, 'secondary', { col: 0, row: 3 }));
    if (!placed.ok) throw new Error(placed.reason);
    const { game: after, publishedBy } = settleAfterPrint({ ...g, draft: placed.draft });
    expect(after.articles.find((a) => a.id === lib.id)?.status).toBe('published');
    expect(backlog(after).map((a) => a.storyId)).toEqual(['d1-phillies']);
    expect(publishedBy).toEqual({ okafor: 1 });
  });

  it('articles go stale, and drop sharply once their storyline moves on', () => {
    const g = game([['hale']]);
    const fares = g.articles.find((a) => a.storyId === 'd1-fares')!;
    expect(freshness(fares, g, stories).value).toBe(1);
    const later = { ...g, issueNumber: 2 };
    const f = freshness(fares, later, stories);
    expect(f.superseded).toBe(true); // d2-strikethreat continues the transit_fares storyline
    expect(f.value).toBeCloseTo((1 - STALENESS_PER_ISSUE) * 0.3);
    const pickles = { ...fares, storyId: 'd1-pickles' };
    expect(freshness(pickles, later, stories).value).toBe(1 - STALENESS_PER_ISSUE);
  });

  it('wire for an issue follows frequency', () => {
    const g = game([['okafor']]);
    expect(wireForIssue(g, stories)).toHaveLength(8);
    expect(wireForIssue({ ...g, setup: { ...g.setup, frequency: 'weekly' } }, stories)).toHaveLength(30);
  });
});
