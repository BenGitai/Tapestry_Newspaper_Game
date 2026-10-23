// Creating a new game from the setup form, and the issue calendar.
import type { CityWorld, Reporter } from '../data/schemas.ts';
import type { StorySource } from '../data/StorySource.ts';
import { ADVERTISERS, STARTING_STAFF } from './balance.ts';
import { emptyDraft } from './layout.ts';
import { initialDistricts, stanceLean } from './readers.ts';
import { fileBeatArticles, settleAfterPrint } from './newsroom.ts';
import { advanceStaff, deskForCategory, newStaffMember, payroll, reporterById, startingPayrollCap } from './staff.ts';
import type { CoverageCategory, GameState, PaperSetup, StaffAssignment } from './types.ts';

export const COVERAGE_CATEGORIES: CoverageCategory[] = ['politics', 'economy', 'social', 'sports', 'culture', 'science', 'world'];

export function defaultSetup(): PaperSetup {
  return {
    paperName: 'The Evening Ledger',
    cityId: 'philadelphia',
    origin: 'founded',
    frequency: 'daily',
    style: 'neighborhood',
    coverage: { politics: 5, economy: 3, social: 3, sports: 4, culture: 2, science: 2, world: 1 },
    stance: 'neutral',
  };
}

/**
 * A suggested starting staff for the hiring screen: starting candidates ranked by
 * how much the coverage split weights their desk, added while payroll fits.
 * Ties go to data-file order so the result is deterministic.
 */
export function suggestStartingStaff(world: CityWorld, setup: PaperSetup): Reporter[] {
  const weightOf = (r: Reporter): number => {
    const cat = COVERAGE_CATEGORIES.find((c) => deskForCategory(world, c) === r.desk);
    return cat ? setup.coverage[cat] : 0;
  };
  const cap = startingPayrollCap(setup.origin);
  const picked: Reporter[] = [];
  const ranked = world.staff_pool
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.starting_candidate)
    .sort((a, b) => weightOf(b.r) - weightOf(a.r) || a.i - b.i);
  // One reporter per desk first, then fill if budget allows.
  for (const pass of ['distinct', 'any'] as const) {
    for (const { r } of ranked) {
      if (picked.length >= STARTING_STAFF.max - 1) break;
      if (picked.includes(r)) continue;
      if (pass === 'distinct' && picked.some((p) => p.desk === r.desk)) continue;
      if (payroll(world, [...picked, r].map((x) => ({ reporterId: x.id }))) <= cap) picked.push(r);
    }
  }
  return picked;
}

export interface Hire {
  reporterId: string;
  assignment: StaffAssignment;
}

/** New game: staff hired on the hiring screen start on issue 1, and file their first stories. */
export function createGame(setup: PaperSetup, world: CityWorld, stories: StorySource, hires: Hire[], seed = Date.now() % 2147483647): GameState {
  const origin = world.origins[setup.origin];
  const staff = hires
    .map((h) => {
      const r = reporterById(world, h.reporterId);
      return r ? newStaffMember(world, r, 1, origin.morale, h.assignment) : undefined;
    })
    .filter((m) => m !== undefined);
  const advertisers: GameState['advertisers'] = {};
  for (const e of world.entities) advertisers[e.id] = { relationship: ADVERTISERS.start, pulledThrough: 0 };
  const game: GameState = {
    setup,
    seed,
    districts: initialDistricts(world, setup, origin.starting_readers, origin.trust),
    perceivedLean: stanceLean(setup.stance),
    advertisers,
    printPool: world.city.print_reader_pool,
    publishedInches: { politics: 0, economy: 0, social: 0, sports: 0, culture: 0, science: 0, world: 0 },
    results: [],
    awards: 0,
    corrections: 0,
    issueNumber: 1,
    cash: origin.cash,
    debt: origin.debt,
    staff,
    articles: [],
    scouted: [],
    draft: emptyDraft(),
    archive: [],
    finished: false,
  };
  return fileBeatArticles(game, world, stories);
}

/**
 * Open the next issue after the printed one has been resolved (money, readers
 * and trust are settled in simulate.ts): articles on the page are published, the
 * rest stay in the backlog; staff train and queued assignments apply; then
 * reporters file for the new issue.
 */
export function advanceIssue(game: GameState, world: CityWorld, stories: StorySource): GameState {
  const { game: settled, publishedBy } = settleAfterPrint(game);
  const next: GameState = {
    ...settled,
    issueNumber: settled.issueNumber + 1,
    staff: advanceStaff(settled.staff, publishedBy, world),
    draft: emptyDraft(),
  };
  return fileBeatArticles(next, world, stories);
}

export { formatIssueDate, issueCount, issueDate, issueDays } from './calendar.ts';
