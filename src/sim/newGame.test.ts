import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { advanceIssue, createGame, defaultSetup, issueCount, issueDate, issueDays, suggestStartingStaff, type Hire } from './newGame.ts';
import { defaultAssignment, payroll, startingPayrollCap } from './staff.ts';
import { newAdBlock, newStoryBlock, putBlock } from './layout.ts';

const { world, stories } = loadGameData();

function hires(ids: string[]): Hire[] {
  return ids.map((id) => ({ reporterId: id, assignment: defaultAssignment(world, world.staff_pool.find((r) => r.id === id)!) }));
}

describe('new game', () => {
  it('suggests starting staff by coverage split, within the payroll budget', () => {
    const setup = { ...defaultSetup(), coverage: { politics: 9, economy: 1, social: 2, sports: 8, culture: 0, science: 0, world: 0 } };
    const picked = suggestStartingStaff(world, setup);
    expect(picked.map((r) => r.id).slice(0, 2)).toEqual(['okafor', 'kowalczyk']);
    expect(payroll(world, picked.map((r) => ({ reporterId: r.id })))).toBeLessThanOrEqual(startingPayrollCap(setup.origin));
    expect(picked.every((r) => r.starting_candidate)).toBe(true);
  });

  it('a science-heavy split brings the science reporter', () => {
    const setup = { ...defaultSetup(), coverage: { politics: 0, economy: 0, social: 0, sports: 0, culture: 0, science: 10, world: 0 } };
    expect(suggestStartingStaff(world, setup)[0]?.id).toBe('osei');
  });

  it('origin sets cash and debt, and reporters file on day one', () => {
    const g = createGame({ ...defaultSetup(), origin: 'bought' }, world, stories, hires(['okafor', 'kowalczyk']));
    expect(g.cash).toBe(4000);
    expect(g.debt).toBe(20000);
    expect(g.staff).toHaveLength(2);
    expect(g.articles.length).toBeGreaterThan(0);
    expect(g.articles.every((a) => a.issueFiled === 1 && a.status === 'backlog')).toBe(true);
  });

  it('advancing publishes what ran, keeps the rest, pays staff and collects ad money', () => {
    let g = createGame(defaultSetup(), world, stories, hires(['okafor', 'kowalczyk', 'tran']));
    const [first, second] = g.articles;
    const story = stories.storyById(first!.storyId)!;
    let draft = putBlock(g.draft, 'front', newStoryBlock(story, 'secondary', { col: 0, row: 3 }));
    if (!draft.ok) throw new Error(draft.reason);
    draft = putBlock(draft.draft, 'a2', newAdBlock('city_hall', { col: 0, row: 1 }));
    if (!draft.ok) throw new Error(draft.reason);
    g = { ...g, draft: draft.draft };
    const cash = g.cash;
    const next = advanceIssue(g, world, stories);
    expect(next.issueNumber).toBe(2);
    expect(next.articles.find((a) => a.id === first!.id)?.status).toBe('published');
    expect(next.articles.find((a) => a.id === second!.id)?.status).toBe('backlog');
    expect(next.cash).toBe(cash + 350 - payroll(world, g.staff));
    expect(next.articles.some((a) => a.issueFiled === 2)).toBe(true);
    expect(next.draft.pages.front).toHaveLength(0);
  });
});

describe('calendar', () => {
  it('daily runs one issue per wire day', () => {
    expect(issueCount('daily', 4)).toBe(4);
    expect(issueDays('daily', 3, 4)).toEqual([3]);
  });

  it('weekly runs one issue from every day', () => {
    expect(issueCount('weekly', 4)).toBe(1);
    expect(issueDays('weekly', 1, 4)).toEqual([1, 2, 3, 4]);
  });

  it('day 1 is a Wednesday', () => {
    expect(issueDate('daily', 1, 4).getDay()).toBe(3);
    expect(issueDate('daily', 3, 4).getDay()).toBe(5);
  });
});
