// Staff management: attributes with training, capacity, scouting, hiring and morale.
import { ATTRIBUTE_KEYS, type Attributes, type CityWorld, type Desk, type Reporter, type Story } from '../data/schemas.ts';
import { categoryOfSubtopic } from '../data/worldData.ts';
import {
  FILING_CAPACITY,
  FOCUS,
  FREQUENCY_CAPACITY,
  HEAD,
  MAX_STAFF,
  MORALE,
  REFERENCE_CHECK_COST,
  SCOUT_RANGE,
  SEVERANCE_MULTIPLIER,
  SIGNING_FEE_MULTIPLIER,
  STARTING_PAYROLL_CAP,
  STARTING_STAFF,
  STYLE,
  TRAINING_PER_ISSUE,
  WORKLOAD,
} from './balance.ts';
import { NATIONAL_PATCH, type Category, type Frequency, type GameState, type OriginId, type StaffAssignment, type StaffMember } from './types.ts';

export const DESK_LABEL: Record<Desk, string> = {
  city_hall: 'City Hall',
  business: 'Business',
  neighborhoods: 'Neighborhoods',
  sports: 'Sports',
  culture: 'Culture',
  science_tech: 'Science & Tech',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  politics: 'Politics',
  economy: 'Economy',
  social: 'Social',
  sports: 'Sports',
  culture: 'Culture',
  science: 'Science & Tech',
  world: 'World',
};

export const ATTRIBUTE_LABEL: Record<keyof Attributes, string> = {
  speed: 'Speed',
  accuracy: 'Accuracy',
  impact: 'Impact',
  charge: 'Charge',
  flair: 'Flair',
  tact: 'Tact',
};

export const ATTRIBUTE_HELP: Record<keyof Attributes, string> = {
  speed: 'How much copy they file per issue.',
  accuracy: 'How rarely they get facts wrong. Low accuracy means corrections.',
  impact: 'How strongly readers react. Drives awards.',
  charge: 'How politically charged the writing is. High charge makes heat, and can tip into sensational.',
  flair: 'Readability. Sells light news and features.',
  tact: 'Handling of sensitive stories. Low tact can turn coverage sensational.',
};

export function reporterById(world: CityWorld, id: string): Reporter | undefined {
  return world.staff_pool.find((r) => r.id === id);
}

/** The desk whose beat this is, if any (world has no desk). */
export function deskForCategory(world: CityWorld, category: Category): Desk | undefined {
  for (const [desk, cats] of Object.entries(world.desk_categories)) {
    if (Array.isArray(cats) && cats.includes(category)) return desk as Desk;
  }
  return undefined;
}

export function homeBeat(world: CityWorld, reporter: Reporter): Category {
  const cats = world.desk_categories[reporter.desk];
  return Array.isArray(cats) && cats[0] ? cats[0] : 'social';
}

export function isOnDesk(reporter: Reporter, story: Pick<Story, 'category'>, world: CityWorld): boolean {
  const cats = world.desk_categories[reporter.desk];
  return Array.isArray(cats) && cats.includes(story.category);
}

/** Base attributes plus training growth, capped at 20. Fractional; display with Math.floor. */
export function currentAttributes(reporter: Reporter, member?: StaffMember): Attributes {
  const out = { ...reporter.attributes };
  if (member) for (const k of ATTRIBUTE_KEYS) out[k] = Math.min(20, out[k] + (member.growth[k] ?? 0));
  return out;
}

/** Column inches a reporter can file per issue (a weekly issue gives them a week). */
export function filingCapacity(reporter: Reporter, member?: StaffMember, frequency: Frequency = 'daily'): number {
  const a = currentAttributes(reporter, member);
  const asg = member?.assignment;
  const workload = asg ? WORKLOAD[asg.workload].capacity : 1;
  const pace = asg ? STYLE[asg.style].pace : 1;
  const head = member?.role === 'head' ? HEAD.writingShare : 1;
  return Math.round((FILING_CAPACITY.base + a.speed * FILING_CAPACITY.perSpeed) * workload * pace * FREQUENCY_CAPACITY[frequency] * head);
}

export function strengthsAndWeaknesses(attrs: Attributes): { strengths: (keyof Attributes)[]; weaknesses: (keyof Attributes)[] } {
  // Charge is neither good nor bad; it's a dial. Leave it out of strengths/weaknesses.
  const keys = ATTRIBUTE_KEYS.filter((k) => k !== 'charge');
  const sorted = [...keys].sort((a, b) => attrs[b] - attrs[a]);
  return {
    strengths: sorted.filter((k) => attrs[k] >= 14).slice(0, 2),
    weaknesses: sorted.filter((k) => attrs[k] <= 8).reverse().slice(0, 2),
  };
}

// ---------------------------------------------------------------------------
// Scouting: candidates you haven't checked show attribute ranges
// ---------------------------------------------------------------------------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A believable range that contains the true value. Same every time for the same reporter. */
export function scoutedRange(reporter: Reporter, key: keyof Attributes): [number, number] {
  const v = reporter.attributes[key];
  const shift = (hash(reporter.id + key) % (SCOUT_RANGE * 2 + 1)) - SCOUT_RANGE;
  const lo = Math.max(1, v - SCOUT_RANGE + Math.max(0, shift));
  const hi = Math.min(20, v + SCOUT_RANGE + Math.min(0, shift));
  return [lo, hi];
}

export function isScouted(game: Pick<GameState, 'scouted' | 'staff'>, reporterId: string): boolean {
  return game.scouted.includes(reporterId) || game.staff.some((m) => m.reporterId === reporterId);
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export function defaultAssignment(world: CityWorld, reporter: Reporter): StaffAssignment {
  const beat = homeBeat(world, reporter);
  // Start them on their own interest if it belongs to their beat.
  const focus = categoryOfSubtopic(reporter.interest) === beat ? reporter.interest : 'none';
  return { beat, focus, patch: NATIONAL_PATCH, style: 'news', workload: 'normal', training: 'none' };
}

export function newStaffMember(world: CityWorld, reporter: Reporter, issue: number, morale: number, assignment?: StaffAssignment): StaffMember {
  return { reporterId: reporter.id, hiredIssue: issue, morale, assignment: assignment ?? defaultAssignment(world, reporter), growth: {} };
}

/** The assignment that applies this issue, or what's queued for next issue if one is pending. */
export function shownAssignment(m: StaffMember): StaffAssignment {
  return m.pendingAssignment ?? m.assignment;
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export function payroll(world: CityWorld, staff: { reporterId: string; role?: StaffMember['role'] }[]): number {
  return staff.reduce((sum, m) => sum + salaryOf(world, m), 0);
}

/** Salary per issue, with the desk-head raise. */
export function salaryOf(world: CityWorld, m: { reporterId: string; role?: StaffMember['role'] }): number {
  const base = reporterById(world, m.reporterId)?.salary_per_issue ?? 0;
  return Math.round(base * (m.role === 'head' ? HEAD.salaryMultiplier : 1));
}

export function startingPayrollCap(origin: OriginId): number {
  return STARTING_PAYROLL_CAP[origin];
}

export type StartingCheck = { ok: true } | { ok: false; reason: string };

export function checkStartingStaff(world: CityWorld, origin: OriginId, ids: string[]): StartingCheck {
  if (ids.length < STARTING_STAFF.min) return { ok: false, reason: `Hire at least ${STARTING_STAFF.min} reporters` };
  if (ids.length > STARTING_STAFF.max) return { ok: false, reason: `You can start with at most ${STARTING_STAFF.max}` };
  const pay = payroll(world, ids.map((reporterId) => ({ reporterId })));
  const cap = startingPayrollCap(origin);
  if (pay > cap) return { ok: false, reason: `Payroll $${pay} is over your $${cap} budget per issue` };
  return { ok: true };
}

export function signingFee(reporter: Reporter): number {
  return reporter.salary_per_issue * SIGNING_FEE_MULTIPLIER;
}

export function severance(reporter: Reporter): number {
  return reporter.salary_per_issue * SEVERANCE_MULTIPLIER;
}

export type StaffEdit = { ok: true; game: GameState } | { ok: false; reason: string };

export function hire(game: GameState, world: CityWorld, reporterId: string, morale: number): StaffEdit {
  const r = reporterById(world, reporterId);
  if (!r) return { ok: false, reason: 'Unknown reporter' };
  if (game.staff.some((m) => m.reporterId === reporterId)) return { ok: false, reason: `${r.name} already works here` };
  if (game.staff.length >= MAX_STAFF) return { ok: false, reason: `The newsroom holds ${MAX_STAFF} reporters` };
  const fee = signingFee(r);
  if (game.cash < fee) return { ok: false, reason: `Signing ${r.name} costs $${fee}` };
  // New hires start next issue with a default assignment, queued so you can change it first.
  const member = newStaffMember(world, r, game.issueNumber + 1, morale);
  return { ok: true, game: { ...game, cash: game.cash - fee, staff: [...game.staff, member] } };
}

export function release(game: GameState, world: CityWorld, reporterId: string): StaffEdit {
  const r = reporterById(world, reporterId);
  if (!r || !game.staff.some((m) => m.reporterId === reporterId)) return { ok: false, reason: 'Not on staff' };
  if (game.staff.length <= 1) return { ok: false, reason: 'You need at least one reporter' };
  const cost = severance(r);
  if (game.cash < cost) return { ok: false, reason: `Severance for ${r.name} is ${cost}` };
  if (game.staff.find((m) => m.reporterId === reporterId)?.role === 'head') return { ok: false, reason: `${r.name} heads a desk. Have them step down first.` };
  return { ok: true, game: { ...game, cash: game.cash - cost, staff: game.staff.filter((m) => m.reporterId !== reporterId) } };
}

export function checkReferences(game: GameState, reporterId: string): StaffEdit {
  if (game.scouted.includes(reporterId)) return { ok: true, game };
  if (game.cash < REFERENCE_CHECK_COST) return { ok: false, reason: `Reference checks cost $${REFERENCE_CHECK_COST}` };
  return { ok: true, game: { ...game, cash: game.cash - REFERENCE_CHECK_COST, scouted: [...game.scouted, reporterId] } };
}

/** Queue an assignment change for next issue. Changing it back cancels the change. */
export function setAssignment(game: GameState, reporterId: string, next: StaffAssignment): GameState {
  return {
    ...game,
    staff: game.staff.map((m) => {
      if (m.reporterId !== reporterId) return m;
      const same = JSON.stringify(next) === JSON.stringify(m.assignment);
      // A reporter who hasn't started yet takes the new assignment directly.
      if (m.hiredIssue > game.issueNumber) return { ...m, assignment: next, pendingAssignment: undefined };
      return { ...m, pendingAssignment: same ? undefined : next };
    }),
  };
}

/** Morale change per issue from their focus: happy on their interest, a little worn otherwise. */
export function focusMorale(asg: StaffAssignment, reporter: Reporter | undefined): number {
  if (!reporter || asg.focus === 'none') return 0;
  return asg.focus === reporter.interest ? FOCUS.moraleWhenInterest : FOCUS.moraleWhenOther;
}

/** Between issues: apply queued assignments, training and morale changes. */
export function advanceStaff(staff: StaffMember[], publishedBy: Record<string, number>, world?: CityWorld, mentors: Record<string, number> = {}): StaffMember[] {
  return staff.map((m) => {
    const asg = m.assignment;
    const growth = { ...m.growth };
    // A desk head's leadership (1-20) speeds up their reporters' training.
    const mentor = mentors[m.reporterId];
    const trainingRate = TRAINING_PER_ISSUE * (mentor ? 1 + (HEAD.mentorTraining * mentor) / 20 : 1);
    if (asg.training !== 'none') growth[asg.training] = (growth[asg.training] ?? 0) + trainingRate;
    const reporter = world ? reporterById(world, m.reporterId) : undefined;
    const morale = Math.max(
      MORALE.min,
      Math.min(
        MORALE.max,
        m.morale +
          WORKLOAD[asg.workload].moralePerIssue +
          (publishedBy[m.reporterId] ?? 0) * MORALE.perPublished +
          focusMorale(asg, reporter) +
          (mentor ? HEAD.mentorMorale : 0),
      ),
    );
    return { ...m, growth, morale, assignment: m.pendingAssignment ?? m.assignment, pendingAssignment: undefined };
  });
}

/** Reporters who are working this issue (new hires start the issue after they sign). */
export function activeStaff(game: Pick<GameState, 'staff' | 'issueNumber'>): StaffMember[] {
  return game.staff.filter((m) => m.hiredIssue <= game.issueNumber);
}

export function initials(name: string): string {
  const parts = name.split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return `${(parts[0] ?? '').charAt(0)}. ${last}`;
}
