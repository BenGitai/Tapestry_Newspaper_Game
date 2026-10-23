import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { createGame, defaultSetup, issueCount, issueDate, issueDays, pickStartingStaff } from './newGame.ts';

const { world } = loadGameData();

describe('new game', () => {
  it('starts with three reporters picked by coverage split', () => {
    const politicsAndSports = pickStartingStaff(world, { politics: 9, economy: 1, social: 2, sports: 8, culture: 0 });
    expect(politicsAndSports.map((r) => r.id)).toEqual(['okafor', 'kowalczyk', 'tran']);
    const business = pickStartingStaff(world, { politics: 0, economy: 10, social: 5, sports: 0, culture: 0 });
    expect(business.map((r) => r.id)).toEqual(['hale', 'tran', 'okafor']);
  });

  it('only picks starting candidates', () => {
    const staff = pickStartingStaff(world, { politics: 0, economy: 0, social: 0, sports: 0, culture: 10 });
    expect(staff.every((r) => r.starting_candidate)).toBe(true);
    expect(staff).toHaveLength(3);
  });

  it('origin sets cash and debt', () => {
    const g = createGame({ ...defaultSetup(), origin: 'bought' }, world);
    expect(g.cash).toBe(4000);
    expect(g.debt).toBe(20000);
    expect(g.issueNumber).toBe(1);
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
