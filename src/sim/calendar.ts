// The issue calendar: which wire days feed which issue, and the date it prints.
import { DEMO_START_DATE } from './balance.ts';
import type { Frequency } from './types.ts';

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
