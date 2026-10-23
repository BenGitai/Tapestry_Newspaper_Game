// The issue calendar: which wire days feed which issue, and the date it prints.
import { DEMO_START_DATE, MAX_ISSUES } from './balance.ts';
import type { Frequency } from './types.ts';

/** How many issues the demo runs: capped at MAX_ISSUES, and by the days of wire available. */
export function issueCount(frequency: Frequency, dayCount: number): number {
  const possible = frequency === 'daily' ? dayCount : Math.floor(dayCount / 7);
  return Math.min(MAX_ISSUES, possible);
}

/** Wire days that feed an issue: one day for a daily, a week for a weekly. */
export function issueDays(frequency: Frequency, issueNumber: number): number[] {
  if (frequency === 'daily') return [issueNumber];
  return Array.from({ length: 7 }, (_, i) => (issueNumber - 1) * 7 + i + 1);
}

/** The date printed on an issue: the last wire day it covers. */
export function issueDate(frequency: Frequency, issueNumber: number): Date {
  const days = issueDays(frequency, issueNumber);
  const last = days[days.length - 1] ?? 1;
  const d = new Date(`${DEMO_START_DATE}T12:00:00`);
  d.setDate(d.getDate() + last - 1);
  return d;
}

export function formatIssueDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
