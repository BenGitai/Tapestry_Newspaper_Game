import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { MAX_STAFF, REFERENCE_CHECK_COST, TRAINING_PER_ISSUE } from './balance.ts';
import { createGame, defaultSetup } from './newGame.ts';
import {
  advanceStaff,
  checkReferences,
  checkStartingStaff,
  currentAttributes,
  defaultAssignment,
  hire,
  isScouted,
  release,
  reporterById,
  scoutedRange,
  setAssignment,
  signingFee,
  strengthsAndWeaknesses,
} from './staff.ts';
import type { GameState } from './types.ts';
import { ATTRIBUTE_KEYS } from '../data/schemas.ts';

const { world, stories } = loadGameData();
const r = (id: string) => reporterById(world, id)!;

function start(ids = ['okafor', 'tran']): GameState {
  return createGame(defaultSetup(), world, stories, ids.map((id) => ({ reporterId: id, assignment: defaultAssignment(world, r(id)) })));
}

describe('starting staff', () => {
  it('enforces head count and payroll budget', () => {
    expect(checkStartingStaff(world, 'founded', ['okafor']).ok).toBe(false);
    expect(checkStartingStaff(world, 'founded', ['okafor', 'tran']).ok).toBe(true);
    expect(checkStartingStaff(world, 'founded', ['ferraro', 'whitfield', 'moreau']).ok).toBe(false); // $550 > $500
  });

  it('the starting budget buys about 4-5 average reporters or 3-4 good ones', () => {
    // Five average (skill 3) reporters fit a founder's budget...
    expect(checkStartingStaff(world, 'founded', ['kowalczyk', 'tran', 'raman', 'nguyen', 'osei']).ok).toBe(true);
    // ...three good (skill 4) ones fit, and four fit an inherited paper's budget.
    expect(checkStartingStaff(world, 'founded', ['okafor', 'hale', 'castillo']).ok).toBe(true);
    expect(checkStartingStaff(world, 'inherited', ['okafor', 'hale', 'castillo', 'adeyemi']).ok).toBe(true);
  });
});

describe('scouting', () => {
  it('ranges always contain the true value', () => {
    for (const rep of world.staff_pool) {
      for (const k of ATTRIBUTE_KEYS) {
        const [lo, hi] = scoutedRange(rep, k);
        expect(lo).toBeLessThanOrEqual(rep.attributes[k]);
        expect(hi).toBeGreaterThanOrEqual(rep.attributes[k]);
        expect(lo).toBeGreaterThanOrEqual(1);
        expect(hi).toBeLessThanOrEqual(20);
      }
    }
  });

  it('checking references costs money and reveals exact attributes', () => {
    const g = start();
    expect(isScouted(g, 'ferraro')).toBe(false);
    const c = checkReferences(g, 'ferraro');
    if (!c.ok) throw new Error(c.reason);
    expect(isScouted(c.game, 'ferraro')).toBe(true);
    expect(c.game.cash).toBe(g.cash - REFERENCE_CHECK_COST);
    expect(isScouted(g, 'okafor')).toBe(true); // your own staff are known
  });
});

describe('hiring and releasing', () => {
  it('hiring charges a signing fee and the hire starts next issue', () => {
    const g = start();
    const h = hire(g, world, 'ferraro', 50);
    if (!h.ok) throw new Error(h.reason);
    expect(h.game.cash).toBe(g.cash - signingFee(r('ferraro')));
    expect(h.game.staff.find((m) => m.reporterId === 'ferraro')?.hiredIssue).toBe(2);
    expect(hire(h.game, world, 'ferraro', 50).ok).toBe(false);
  });

  it('the newsroom has a size limit', () => {
    let g = start(['okafor', 'tran']);
    g = { ...g, cash: 100000 };
    for (const r of world.staff_pool) {
      const h = hire(g, world, r.id, 50);
      if (h.ok) g = h.game;
    }
    expect(g.staff).toHaveLength(MAX_STAFF);
    const outside = world.staff_pool.find((r) => !g.staff.some((m) => m.reporterId === r.id))!;
    expect(hire(g, world, outside.id, 50).ok).toBe(false);
    expect(MAX_STAFF).toBeGreaterThanOrEqual(20);
  });

  it('releasing costs severance; you keep at least one reporter', () => {
    const g = start();
    const rel = release(g, world, 'tran');
    if (!rel.ok) throw new Error(rel.reason);
    expect(rel.game.staff.map((m) => m.reporterId)).toEqual(['okafor']);
    expect(release(rel.game, world, 'okafor').ok).toBe(false);
  });
});

describe('assignments, training and morale', () => {
  it('assignment changes wait for the next issue', () => {
    const g = start();
    const asg = { ...g.staff[0]!.assignment, beat: 'economy' as const };
    const queued = setAssignment(g, 'okafor', asg);
    expect(queued.staff[0]!.assignment.beat).toBe('politics');
    expect(queued.staff[0]!.pendingAssignment?.beat).toBe('economy');
    const advanced = advanceStaff(queued.staff, {});
    expect(advanced[0]!.assignment.beat).toBe('economy');
    expect(advanced[0]!.pendingAssignment).toBeUndefined();
    // Setting it back cancels the change.
    expect(setAssignment(queued, 'okafor', g.staff[0]!.assignment).staff[0]!.pendingAssignment).toBeUndefined();
  });

  it('training slowly raises the chosen attribute, capped at 20', () => {
    const g = start();
    let staff: GameState['staff'] = [{ ...g.staff[0]!, assignment: { ...g.staff[0]!.assignment, training: 'flair' } }];
    for (let i = 0; i < 4; i++) staff = advanceStaff(staff, {});
    expect(currentAttributes(r('okafor'), staff[0]).flair).toBeCloseTo(r('okafor').attributes.flair + 4 * TRAINING_PER_ISSUE);
    let maxed: GameState['staff'] = [{ ...staff[0]!, assignment: { ...staff[0]!.assignment, training: 'accuracy' } }];
    for (let i = 0; i < 50; i++) maxed = advanceStaff(maxed, {});
    expect(currentAttributes(r('okafor'), maxed[0]).accuracy).toBe(20);
  });

  it('crunch wears morale down; published work lifts it', () => {
    const g = start();
    const crunch = [{ ...g.staff[0]!, assignment: { ...g.staff[0]!.assignment, workload: 'crunch' as const } }];
    expect(advanceStaff(crunch, {})[0]!.morale).toBeLessThan(g.staff[0]!.morale);
    expect(advanceStaff(g.staff, { okafor: 3 })[0]!.morale).toBeGreaterThan(g.staff[0]!.morale);
  });

  it('strengths and weaknesses read off the attributes, ignoring charge', () => {
    const sw = strengthsAndWeaknesses(r('brenner').attributes);
    expect(sw.strengths).toContain('speed');
    expect(sw.weaknesses).toContain('accuracy');
    expect([...sw.strengths, ...sw.weaknesses]).not.toContain('charge');
  });
});

describe('focus morale', () => {
  it('a focus on their interest lifts morale; another focus wears it down a little', () => {
    const g = start(['kowalczyk', 'tran']);
    const m = g.staff[0]!;
    const happy = advanceStaff([{ ...m, assignment: { ...m.assignment, focus: 'baseball' } }], {}, world)[0]!;
    const meh = advanceStaff([{ ...m, assignment: { ...m.assignment, focus: 'hockey' } }], {}, world)[0]!;
    expect(happy.morale).toBeGreaterThan(m.morale);
    expect(meh.morale).toBeLessThan(m.morale);
  });
});
