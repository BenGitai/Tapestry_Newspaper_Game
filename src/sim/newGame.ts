// Creating a new game from the setup form, and the issue calendar.
import type { CityWorld, Desk, Reporter } from '../data/schemas.ts';
import { DEMO_START_DATE, STARTING_STAFF } from './balance.ts';
import { emptyDraft } from './layout.ts';
import type { CoverageCategory, Frequency, GameState, PaperSetup } from './types.ts';

export const COVERAGE_CATEGORIES: CoverageCategory[] = ['politics', 'economy', 'social', 'sports', 'culture'];

export const DESK_FOR_CATEGORY: Record<CoverageCategory, Desk> = {
  politics: 'city_hall',
  economy: 'business',
  social: 'neighborhoods',
  sports: 'sports',
  culture: 'culture',
};

export function defaultSetup(): PaperSetup {
  return {
    paperName: 'The Evening Ledger',
    cityId: 'philadelphia',
    origin: 'founded',
    frequency: 'daily',
    coverage: { politics: 5, economy: 3, social: 3, sports: 4, culture: 2 },
    stance: 'neutral',
  };
}

/**
 * Starting reporters: rank the starting candidates by how much weight the
 * coverage split puts on their desk, keep the top STARTING_STAFF. Ties go to
 * data-file order so the result is deterministic.
 */
export function pickStartingStaff(world: CityWorld, coverage: PaperSetup['coverage']): Reporter[] {
  const weightOf = (desk: Desk): number => {
    const cat = COVERAGE_CATEGORIES.find((c) => DESK_FOR_CATEGORY[c] === desk);
    return cat ? coverage[cat] : 0;
  };
  return world.staff_pool
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.starting_candidate)
    .sort((a, b) => weightOf(b.r.desk) - weightOf(a.r.desk) || a.i - b.i)
    .slice(0, STARTING_STAFF)
    .map(({ r }) => r);
}

export function createGame(setup: PaperSetup, world: CityWorld): GameState {
  const origin = world.origins[setup.origin];
  return {
    setup,
    issueNumber: 1,
    cash: origin.cash,
    debt: origin.debt,
    staff: pickStartingStaff(world, setup.coverage).map((r) => r.id),
    draft: emptyDraft(),
    archive: [],
    finished: false,
  };
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** How many issues the demo runs for a frequency, given the days of wire available. */
export function issueCount(frequency: Frequency, dayCount: number): number {
  return frequency === 'daily' ? dayCount : 1;
}

/** Wire days that feed an issue. Weekly pulls every day into one issue (more stories to choose from). */
export function issueDays(frequency: Frequency, issueNumber: number, dayCount: number): number[] {
  if (frequency === 'daily') return [issueNumber];
  return Array.from({ length: dayCount }, (_, i) => i + 1);
}

/** The date printed on an issue: the last wire day it covers. */
export function issueDate(frequency: Frequency, issueNumber: number, dayCount: number): Date {
  const days = issueDays(frequency, issueNumber, dayCount);
  const last = days[days.length - 1] ?? 1;
  const d = new Date(`${DEMO_START_DATE}T12:00:00`);
  d.setDate(d.getDate() + last - 1);
  return d;
}

export function formatIssueDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
