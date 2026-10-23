import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { COMMISSION_RESERVE, GENERATED_PER_DAY, STALENESS_PER_ISSUE, STYLE } from './balance.ts';
import { createGame, defaultSetup, type Hire } from './newGame.ts';
import { angleFor, articleInches, hasRoomFor, backlog, commission, fileBeatArticles, freshness, inchesFiled, isCovered, remainingCapacity, settleAfterPrint, updateArticle, wireForIssue } from './newsroom.ts';
import { newStoryBlock, putBlock } from './layout.ts';
import { defaultAssignment, filingCapacity, reporterById } from './staff.ts';
import type { GameState, StaffAssignment } from './types.ts';

import storiesRaw from '../../data/stories.philly.json';
import { JsonStorySource } from '../data/StorySource.ts';

const { world } = loadGameData();
/** The hand-written stories only, so these tests don't depend on generated news. */
const stories = new JsonStorySource(storiesRaw);

function game(staff: [string, Partial<StaffAssignment>?][], issue = 1): GameState {
  // Tests about specific stories pin focus off unless they set it.
  const hires: Hire[] = staff.map(([id, asg]) => ({ reporterId: id, assignment: { ...defaultAssignment(world, reporterById(world, id)!), focus: 'none', ...asg } }));
  const g = createGame(defaultSetup(), world, stories, hires);
  if (issue === 1) return g;
  return fileBeatArticles({ ...g, issueNumber: issue, articles: [] }, world, stories);
}

describe('beat filing', () => {
  it('reporters file their beat first, then pick up other stories with the copy they have left', () => {
    const g = game([['okafor'], ['kowalczyk']]);
    const by = (id: string) => g.articles.filter((a) => a.reporterId === id).map((a) => stories.storyById(a.storyId)!);
    expect(by('okafor')[0]!.id).toBe('d1-library');
    expect(by('kowalczyk')[0]!.id).toBe('d1-phillies');
    for (const id of ['okafor', 'kowalczyk']) {
      const beat = id === 'okafor' ? 'politics' : 'sports';
      const cats = by(id).map((s) => s.category);
      // Once they go off their beat they never come back to it in the same issue.
      const firstOff = cats.findIndex((c) => c !== beat);
      if (firstOff >= 0) expect(cats.slice(firstOff).every((c) => c !== beat)).toBe(true);
    }
  });

  it('a district patch limits stories to that district and marks local knowledge', () => {
    const g = game([['tran', { beat: 'social', patch: 'north_philly' }]], 2);
    expect(g.articles[0]!.storyId).toBe('d2-fire');
    expect(g.articles[0]!.onPatch).toBe(true);
    for (const a of g.articles) expect(stories.storyById(a.storyId)!.districts).toContain('north_philly');
    const elsewhere = game([['tran', { beat: 'social', patch: 'center_city' }]], 2);
    expect(elsewhere.articles.some((a) => stories.storyById(a.storyId)!.category === 'social')).toBe(false);
  });

  it('everyone can file their first piece, even if it is longer than their capacity', () => {
    const g = game([['okafor']]);
    const member = g.staff[0]!;
    const cap = filingCapacity(reporterById(world, 'okafor')!, member);
    const empty = { ...g, articles: [] };
    expect(hasRoomFor(empty, world, member, cap + 10)).toBe(true);
    expect(hasRoomFor(g, world, member, cap + 10)).toBe(false);
  });

  it('their own filing leaves room for the editor’s commissions', () => {
    const demo = loadGameData().stories;
    const g = createGame(defaultSetup(), world, demo, [{ reporterId: 'okafor', assignment: defaultAssignment(world, reporterById(world, 'okafor')!) }], 1);
    const cap = filingCapacity(reporterById(world, 'okafor')!, g.staff[0]);
    expect(remainingCapacity(g, world, g.staff[0]!)).toBeGreaterThanOrEqual(cap * COMMISSION_RESERVE - 0.01);
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
    // On the full demo wire there are always stories left over; commission one to whoever has the most room.
    const demo = loadGameData().stories;
    const hiresLight: Hire[] = ['okafor', 'kowalczyk'].map((id) => ({ reporterId: id, assignment: { ...defaultAssignment(world, reporterById(world, id)!), workload: 'light' } }));
    const g = createGame(defaultSetup(), world, demo, hiresLight, 1);
    const member = g.staff.reduce((best, m) => (remainingCapacity(g, world, m) > remainingCapacity(g, world, best) ? m : best));
    const before = remainingCapacity(g, world, member);
    const target = wireForIssue(g, demo).find((s) => !isCovered(g, s.id) && articleInches(s, member.assignment.style) <= before)!;
    const r = commission(g, world, demo, target.id, member.reporterId);
    if (!r.ok) throw new Error(r.reason);
    const a = r.game.articles.find((x) => x.storyId === target.id)!;
    expect(a.commissioned).toBe(true);
    expect(a.selected).toBe(true);
    expect(remainingCapacity(r.game, world, r.game.staff.find((m) => m.reporterId === member.reporterId)!)).toBe(before - a.inches);
  });

  it('refuses stories already covered, off this issue’s wire, or too long for the time left', () => {
    const g = game([['okafor'], ['tran']]);
    expect(commission(g, world, stories, 'd1-library', 'tran').ok).toBe(false); // already covered
    expect(commission(g, world, stories, 'd2-fire', 'tran').ok).toBe(false);
    const open = wireForIssue(g, stories).filter((s) => !isCovered(g, s.id));
    if (open.length) {
      const busy = { ...g, articles: [...g.articles, { ...g.articles[0]!, id: 'x', storyId: 'zz', reporterId: 'tran', inches: 99 }] };
      expect(commission(busy, world, stories, open[0]!.id, 'tran').ok).toBe(false);
    }
  });

  it('wire copy needs no reporter and runs straight', () => {
    const g = game([['okafor', { workload: 'light' }]]);
    const open = wireForIssue(g, stories).find((s) => !isCovered(g, s.id))!;
    const r = commission(g, world, stories, open.id, null);
    if (!r.ok) throw new Error(r.reason);
    const a = r.game.articles.find((x) => x.storyId === open.id)!;
    expect(a.reporterId).toBeNull();
    expect(a.angle).toBe('straight');
    expect(isCovered(r.game, open.id)).toBe(true);
  });

  it('commissioned Puff on a sensitive story is refused', () => {
    const g = game([['tran', { beat: 'culture', patch: 'center_city' }]], 2);
    expect(isCovered(g, 'd2-fire')).toBe(false);
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
    expect(backlog(after).map((a) => a.storyId)).toContain('d1-phillies');
    expect(backlog(after).map((a) => a.storyId)).not.toContain('d1-library');
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
    const demo = loadGameData().stories;
    expect(wireForIssue(g, demo)).toHaveLength(GENERATED_PER_DAY);
    const weekly = wireForIssue({ ...g, setup: { ...g.setup, frequency: 'weekly' } }, demo);
    expect(weekly).toHaveLength(40);
    // A weekly wire is the week's biggest stories.
    const week = [1, 2, 3, 4, 5, 6, 7].flatMap((d) => demo.storiesForDay(d));
    const cutoff = Math.min(...weekly.map((s) => s.importance));
    expect(week.filter((s) => s.importance > cutoff).every((s) => weekly.includes(s))).toBe(true);
  });

  it('a weekly paper gives reporters a week of filing', () => {
    const daily = game([['okafor']]);
    const weekly = { ...daily, setup: { ...daily.setup, frequency: 'weekly' as const } };
    const r = reporterById(world, 'okafor')!;
    expect(filingCapacity(r, weekly.staff[0], 'weekly')).toBeGreaterThan(2 * filingCapacity(r, daily.staff[0], 'daily'));
  });
});

describe('sub-focus', () => {
  it('a reporter prefers stories on their focus, and the article remembers it', () => {
    // Day 2, Okafor on economy: with focus on jobs she files the jobs story before the bigger transit one.
    const g = game([['okafor', { beat: 'economy', focus: 'jobs' }]], 2);
    const first = g.articles[0]!;
    expect(stories.storyById(first.storyId)!.subtopic).toBe('jobs');
    expect(first.onFocus).toBe(true);
  });

  it('marks stories on the reporter’s own interest', () => {
    const g = game([['kowalczyk']]);
    const a = g.articles.find((x) => x.storyId === 'd1-phillies')!;
    expect(a.onInterest).toBe(true);
  });

  it('starts reporters on their own interest when it fits their beat', () => {
    expect(defaultAssignment(world, reporterById(world, 'kowalczyk')!).focus).toBe('baseball');
    expect(defaultAssignment(world, reporterById(world, 'okafor')!).focus).toBe('policy');
  });
});
