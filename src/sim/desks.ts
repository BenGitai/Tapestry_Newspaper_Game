// Desk heads: a reporter promoted to run a desk. They mostly stop writing and
// instead filter, fix and upgrade the desk's copy, and can run the desk for you.
// What they do is up to you: each duty can be delegated or kept.
import type { CityWorld, Desk, Reporter, Story } from '../data/schemas.ts';
import type { StorySource } from '../data/StorySource.ts';
import { HEAD } from './balance.ts';
import { articleInches, availableStories, backlog, commission, freshness, isCovered, remainingCapacity, updateArticle } from './newsroom.ts';
import { scorecard } from './scorecard.ts';
import { activeStaff, currentAttributes, deskForCategory, reporterById } from './staff.ts';
import type { Category, DeskDuties, GameState, StaffMember } from './types.ts';

export const DUTY_LABEL: Record<keyof DeskDuties, string> = {
  filter: 'Filter',
  fix: 'Fix',
  upgrade: 'Upgrade',
  runDesk: 'Run the desk',
};

export const DUTY_HELP: Record<keyof DeskDuties, string> = {
  filter: 'Picks the desk’s best fresh articles for print and spikes stale or overtaken ones. You can still override.',
  fix: 'Edits copy before it runs: fewer corrections, and a good editor tones down sensational pieces.',
  upgrade: 'Sharpens the desk’s articles: better readership and impact.',
  runDesk: 'Sets each reporter’s focus to cover the beat, and commissions uncovered desk stories to reporters with time left.',
};

export const DEFAULT_DUTIES: DeskDuties = { filter: false, fix: true, upgrade: true, runDesk: false };

/** Editing skill (1-20): accuracy counts double, with flair and tact. */
export function editingSkill(r: Reporter, m?: StaffMember): number {
  const a = currentAttributes(r, m);
  return Math.round((2 * a.accuracy + a.flair + a.tact) / 4);
}

/** Leadership (1-20): tact, impact and accuracy, plus experience. */
export function leadershipSkill(r: Reporter, m?: StaffMember): number {
  const a = currentAttributes(r, m);
  return Math.min(20, Math.round((a.tact + a.impact + a.accuracy) / 3 + r.skill - 2));
}

/** The desk a staff member works on now (from their beat; World has no desk). */
export function memberDesk(world: CityWorld, m: StaffMember): Desk | undefined {
  if (m.role === 'head') return m.headOf;
  return deskForCategory(world, m.assignment.beat);
}

/** Everyone working a desk, head included. */
export function deskMembers(game: Pick<GameState, 'staff'>, world: CityWorld, desk: Desk): StaffMember[] {
  return game.staff.filter((m) => memberDesk(world, m) === desk);
}

export function headOf(game: Pick<GameState, 'staff'>, desk: Desk): StaffMember | undefined {
  return game.staff.find((m) => m.role === 'head' && m.headOf === desk);
}

/** A head only works while the desk has HEAD.minDesk journalists (head included). */
export function headActive(game: Pick<GameState, 'staff'>, world: CityWorld, desk: Desk): boolean {
  return !!headOf(game, desk) && deskMembers(game, world, desk).length >= HEAD.minDesk;
}

/** The active head responsible for a story's category, if any. */
export function editorFor(game: Pick<GameState, 'staff'>, world: CityWorld, category: Category): { member: StaffMember; reporter: Reporter } | undefined {
  const desk = deskForCategory(world, category);
  if (!desk || !headActive(game, world, desk)) return undefined;
  const member = headOf(game, desk)!;
  const reporter = reporterById(world, member.reporterId);
  return reporter ? { member, reporter } : undefined;
}

/** What the scorecard needs to know about the editor of an article. */
export interface EditorEffect {
  editing: number;
  fix: boolean;
  upgrade: boolean;
  name: string;
}

export function editorEffect(game: Pick<GameState, 'staff'>, world: CityWorld, story: Pick<Story, 'category'>): EditorEffect | undefined {
  const e = editorFor(game, world, story.category);
  if (!e) return undefined;
  const duties = e.member.duties ?? DEFAULT_DUTIES;
  if (!duties.fix && !duties.upgrade) return undefined;
  return { editing: editingSkill(e.reporter, e.member), fix: duties.fix, upgrade: duties.upgrade, name: e.reporter.name };
}

// ---------------------------------------------------------------------------
// Promotion
// ---------------------------------------------------------------------------

export type DeskEdit = { ok: true; game: GameState } | { ok: false; reason: string };

export function canPromote(game: GameState, world: CityWorld, reporterId: string): { ok: true; desk: Desk } | { ok: false; reason: string } {
  const m = game.staff.find((x) => x.reporterId === reporterId);
  if (!m) return { ok: false, reason: 'Not on staff' };
  if (m.role === 'head') return { ok: false, reason: 'Already a desk head' };
  const desk = memberDesk(world, m);
  if (!desk) return { ok: false, reason: 'World & national has no desk to run' };
  if (headOf(game, desk)) return { ok: false, reason: 'That desk already has a head' };
  const size = deskMembers(game, world, desk).length;
  if (size < HEAD.minDesk) return { ok: false, reason: `A desk needs ${HEAD.minDesk} journalists before it gets a head (it has ${size})` };
  return { ok: true, desk };
}

export function promote(game: GameState, world: CityWorld, reporterId: string): DeskEdit {
  const check = canPromote(game, world, reporterId);
  if (!check.ok) return check;
  return {
    ok: true,
    game: {
      ...game,
      staff: game.staff.map((m) =>
        m.reporterId === reporterId ? { ...m, role: 'head', headOf: check.desk, duties: { ...DEFAULT_DUTIES }, morale: Math.min(100, m.morale + HEAD.promotionMorale), pendingAssignment: undefined } : m,
      ),
    },
  };
}

export function stepDown(game: GameState, reporterId: string): DeskEdit {
  const m = game.staff.find((x) => x.reporterId === reporterId);
  if (!m || m.role !== 'head') return { ok: false, reason: 'Not a desk head' };
  return {
    ok: true,
    game: { ...game, staff: game.staff.map((x) => (x.reporterId === reporterId ? { ...x, role: 'reporter', headOf: undefined, duties: undefined, morale: Math.max(0, x.morale - HEAD.demotionMorale) } : x)) },
  };
}

export function setDuties(game: GameState, reporterId: string, duties: DeskDuties): GameState {
  return { ...game, staff: game.staff.map((m) => (m.reporterId === reporterId && m.role === 'head' ? { ...m, duties } : m)) };
}

// ---------------------------------------------------------------------------
// The desk head's work at the start of an issue
// ---------------------------------------------------------------------------

/**
 * Run the desk (before filing): give the desk's reporters focuses that cover the
 * beat. Each reporter keeps their own interest if nobody else has it; otherwise
 * they get the next uncovered subtopic. Patches are left as the player set them.
 */
export function runDeskAssignments(game: GameState, world: CityWorld, subtopicsOf: (c: Category) => string[]): GameState {
  let staff = game.staff;
  for (const head of game.staff.filter((m) => m.role === 'head' && m.headOf)) {
    const desk = head.headOf!;
    if (!(head.duties ?? DEFAULT_DUTIES).runDesk || !headActive(game, world, desk)) continue;
    const reporters = staff.filter((m) => m.role !== 'head' && memberDesk(world, m) === desk);
    const beat = reporters[0]?.assignment.beat;
    if (!beat) continue;
    const subs = subtopicsOf(beat);
    const taken = new Set<string>();
    const plan = new Map<string, string>();
    for (const m of reporters) {
      const interest = reporterById(world, m.reporterId)?.interest;
      if (interest && subs.includes(interest) && !taken.has(interest)) {
        plan.set(m.reporterId, interest);
        taken.add(interest);
      }
    }
    for (const m of reporters) {
      if (plan.has(m.reporterId)) continue;
      const next = subs.find((s) => !taken.has(s)) ?? 'none';
      plan.set(m.reporterId, next);
      if (next !== 'none') taken.add(next);
    }
    staff = staff.map((m) => (plan.has(m.reporterId) ? { ...m, assignment: { ...m.assignment, focus: plan.get(m.reporterId)! }, pendingAssignment: undefined } : m));
  }
  return { ...game, staff };
}

/** Run the desk (after filing): commission uncovered desk stories to reporters with time left. */
export function runDeskCommissions(game: GameState, world: CityWorld, stories: StorySource): GameState {
  let state = game;
  for (const head of game.staff.filter((m) => m.role === 'head' && m.headOf)) {
    const desk = head.headOf!;
    if (!(head.duties ?? DEFAULT_DUTIES).runDesk || !headActive(state, world, desk)) continue;
    const open = availableStories(state, stories)
      .filter((s) => !isCovered(state, s.id) && deskForCategory(world, s.category) === desk && s.importance >= HEAD.commissionMinImportance)
      .sort((a, b) => b.importance - a.importance);
    for (const s of open) {
      const crew = activeStaff(state)
        .filter((m) => m.role !== 'head' && memberDesk(world, m) === desk)
        .filter((m) => articleInches(s, m.assignment.style) <= remainingCapacity(state, world, m))
        .sort((a, b) => remainingCapacity(state, world, b) - remainingCapacity(state, world, a));
      const pick = crew[0];
      if (!pick) continue;
      const r = commission(state, world, stories, s.id, pick.reporterId);
      if (r.ok) state = { ...r.game, articles: r.game.articles.map((a) => (a.storyId === s.id ? { ...a, selected: false, deskPick: false } : a)) };
    }
  }
  return state;
}

/** Filter: pick the desk's best fresh articles for print, spike stale or overtaken ones. */
export function filterDesk(game: GameState, world: CityWorld, stories: StorySource): GameState {
  let state = game;
  for (const head of game.staff.filter((m) => m.role === 'head' && m.headOf)) {
    const desk = head.headOf!;
    if (!(head.duties ?? DEFAULT_DUTIES).filter || !headActive(state, world, desk)) continue;
    const mine = backlog(state).filter((a) => {
      const s = stories.storyById(a.storyId);
      return s && deskForCategory(world, s.category) === desk;
    });
    const scored = mine.map((a) => {
      const s = stories.storyById(a.storyId)!;
      const f = freshness(a, state, stories);
      const member = state.staff.find((m) => m.reporterId === a.reporterId);
      return { a, f, value: scorecard(a, s, world, member, f.value).shown.readership * (1 + s.importance / 5) };
    });
    for (const { a, f } of scored) {
      if (f.superseded || f.value <= HEAD.spikeBelowFreshness) state = updateArticle(state, a.id, { status: 'spiked', selected: false });
    }
    const keep = scored.filter(({ f }) => !f.superseded && f.value > HEAD.spikeBelowFreshness).sort((x, y) => y.value - x.value);
    const n = Math.max(1, Math.ceil(keep.length * HEAD.pickShare));
    for (const { a } of keep.slice(0, n)) state = { ...state, articles: state.articles.map((x) => (x.id === a.id ? { ...x, selected: true, deskPick: true } : x)) };
  }
  return state;
}

/** Reporters on a desk with an active head get mentored: faster training, steadier morale. */
export function mentoring(game: Pick<GameState, 'staff'>, world: CityWorld): Record<string, number> {
  const out: Record<string, number> = {};
  for (const head of game.staff.filter((m) => m.role === 'head' && m.headOf)) {
    if (!headActive(game, world, head.headOf!)) continue;
    const r = reporterById(world, head.reporterId);
    if (!r) continue;
    const lead = leadershipSkill(r, head);
    for (const m of deskMembers(game, world, head.headOf!)) if (m.role !== 'head') out[m.reporterId] = lead;
  }
  return out;
}

