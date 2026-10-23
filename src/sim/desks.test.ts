import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { HEAD } from './balance.ts';
import { canPromote, deskMembers, editorEffect, filterDesk, headActive, mentoring, promote, runDeskAssignments, setDuties, stepDown } from './desks.ts';
import { advanceIssue, createGame, defaultSetup, startIssue, type Hire } from './newGame.ts';
import { backlog, isCovered, wireForIssue } from './newsroom.ts';
import { scorecard } from './scorecard.ts';
import { advanceStaff, defaultAssignment, filingCapacity, payroll, release, reporterById } from './staff.ts';
import type { GameState } from './types.ts';

const { world, stories, subtopics } = loadGameData();
const r = (id: string) => reporterById(world, id)!;

/** Everyone on the City Hall desk (politics beat). */
function cityHall(ids = ['okafor', 'brenner', 'nguyen', 'whitfield']): GameState {
  const hires: Hire[] = ids.map((id) => ({ reporterId: id, assignment: { ...defaultAssignment(world, r(id)), beat: 'politics' } }));
  return createGame({ ...defaultSetup(), origin: 'inherited' }, world, stories, hires, 9);
}

function promoted(g: GameState, id = 'okafor'): GameState {
  const p = promote(g, world, id);
  if (!p.ok) throw new Error(p.reason);
  return p.game;
}

describe('promotion', () => {
  it('a desk needs three journalists before it gets a head', () => {
    const small = cityHall(['okafor', 'brenner']);
    const check = canPromote(small, world, 'okafor');
    expect(check.ok).toBe(false);
    expect(check.ok ? '' : check.reason).toMatch(/needs 3/);
    expect(canPromote(cityHall(['okafor', 'brenner', 'nguyen']), world, 'okafor').ok).toBe(true);
  });

  it('one head per desk; heads earn more and mostly stop writing', () => {
    const g = promoted(cityHall());
    expect(canPromote(g, world, 'nguyen').ok).toBe(false);
    const head = g.staff.find((m) => m.reporterId === 'okafor')!;
    expect(head.role).toBe('head');
    expect(head.headOf).toBe('city_hall');
    expect(payroll(world, [head])).toBe(Math.round(r('okafor').salary_per_issue * HEAD.salaryMultiplier));
    const asReporter = { ...head, role: 'reporter' as const };
    expect(filingCapacity(r('okafor'), head)).toBeLessThan(filingCapacity(r('okafor'), asReporter) * 0.5);
  });

  it('a head must step down before they can be released; stepping down costs morale', () => {
    const g = promoted(cityHall());
    expect(release(g, world, 'okafor').ok).toBe(false);
    const s = stepDown(g, 'okafor');
    if (!s.ok) throw new Error(s.reason);
    const m = s.game.staff.find((x) => x.reporterId === 'okafor')!;
    expect(m.role).toBe('reporter');
    expect(m.morale).toBeLessThan(g.staff.find((x) => x.reporterId === 'okafor')!.morale);
  });

  it('the head goes quiet if the desk shrinks below three', () => {
    let g = promoted(cityHall(['okafor', 'brenner', 'nguyen']));
    expect(headActive(g, world, 'city_hall')).toBe(true);
    g = { ...g, staff: g.staff.filter((m) => m.reporterId !== 'nguyen') };
    expect(headActive(g, world, 'city_hall')).toBe(false);
    expect(editorEffect(g, world, { category: 'politics' })).toBeUndefined();
  });
});

describe('duties', () => {
  it('Fix and Upgrade: edited copy has fewer errors and reads better', () => {
    const g = promoted(cityHall());
    const story = stories.storyById('d1-library')!;
    const article = g.articles.find((a) => a.storyId === 'd1-library') ?? { ...g.articles[0]!, storyId: 'd1-library' };
    const member = g.staff.find((m) => m.reporterId === article.reporterId);
    const plain = scorecard(article, story, world, member, 1);
    const edited = scorecard(article, story, world, member, 1, editorEffect(g, world, story));
    expect(edited.hidden.correctionRisk).toBeLessThan(plain.hidden.correctionRisk);
    expect(edited.shown.readership).toBeGreaterThan(plain.shown.readership);
    // With both duties off, the head doesn't touch the copy.
    const off = setDuties(g, 'okafor', { filter: false, fix: false, upgrade: false, runDesk: false });
    expect(editorEffect(off, world, story)).toBeUndefined();
  });

  it('Fix: a good editor tones down sensational pieces', () => {
    const g = promoted(cityHall());
    const story = stories.storyById('d2-wagetax')!; // politics: the City Hall head edits it
    const brenner = g.staff.find((m) => m.reporterId === 'brenner')!;
    const a = { ...g.articles[0]!, storyId: story.id, reporterId: 'brenner', angle: 'hard' as const, onFocus: false, onInterest: false };
    expect(scorecard(a, story, world, brenner, 1).shown.sensational).toBe(true);
    expect(scorecard(a, story, world, brenner, 1, editorEffect(g, world, story)).shown.sensational).toBe(false);
  });

  it('Filter: picks the desk’s best fresh articles for print', () => {
    let g = promoted(cityHall());
    g = setDuties(g, 'okafor', { filter: true, fix: true, upgrade: true, runDesk: false });
    const before = backlog(g).filter((a) => stories.storyById(a.storyId)!.category === 'politics' && a.selected).length;
    const after = filterDesk(g, world, stories);
    const picks = backlog(after).filter((a) => a.deskPick);
    expect(picks.length).toBeGreaterThan(before);
    expect(picks.every((a) => a.selected)).toBe(true);
  });

  it('Run the desk: reporters get distinct focuses covering the beat, and uncovered stories get commissioned', () => {
    let g = promoted(cityHall());
    g = setDuties(g, 'okafor', { filter: false, fix: true, upgrade: true, runDesk: true });
    const planned = runDeskAssignments(g, world, (c) => subtopics[c].map((s) => s.id));
    const focuses = planned.staff.filter((m) => m.role !== 'head').map((m) => m.assignment.focus);
    expect(new Set(focuses).size).toBe(focuses.length);
    expect(planned.staff.find((m) => m.reporterId === 'whitfield')!.assignment.focus).toBe('courts'); // their own interest
    // Next issue: the head runs the whole start-of-issue pipeline.
    const next = advanceIssue(g, world, stories);
    const uncoveredPolitics = wireForIssue(next, stories).filter((s) => s.category === 'politics' && s.importance >= HEAD.commissionMinImportance && !isCovered(next, s.id));
    expect(uncoveredPolitics.length).toBeLessThanOrEqual(1);
  });

  it('mentoring: desk reporters train faster and gain morale', () => {
    const g = promoted(cityHall());
    const mentors = mentoring(g, world);
    expect(Object.keys(mentors).sort()).toEqual(['brenner', 'nguyen', 'whitfield']);
    const m = { ...g.staff.find((x) => x.reporterId === 'nguyen')!, assignment: { ...g.staff.find((x) => x.reporterId === 'nguyen')!.assignment, training: 'flair' as const } };
    const plain = advanceStaff([m], {}, world)[0]!;
    const mentored = advanceStaff([m], {}, world, mentors)[0]!;
    expect(mentored.growth.flair!).toBeGreaterThan(plain.growth.flair!);
    expect(mentored.morale).toBeGreaterThan(plain.morale);
  });

  it('start of issue runs cleanly with heads in a big newsroom', () => {
    const ids = world.staff_pool.slice(0, 20).map((x) => x.id);
    let g = createGame({ ...defaultSetup(), origin: 'inherited' }, world, stories, ids.map((id) => ({ reporterId: id, assignment: defaultAssignment(world, r(id)) })), 3);
    for (const desk of ['city_hall', 'business', 'neighborhoods', 'sports', 'culture', 'science_tech'] as const) {
      const members = deskMembers(g, world, desk);
      if (members.length >= 3) g = promoted(g, members[0]!.reporterId);
    }
    expect(g.staff.length).toBe(20);
    const s = startIssue({ ...g, articles: [] }, world, stories);
    expect(s.articles.length).toBeGreaterThan(10);
  });
});
