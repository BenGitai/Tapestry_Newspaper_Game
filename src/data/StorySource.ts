// Stories come through this interface so a live news source can replace the
// fixed JSON file later without the game noticing.
//
// Two kinds of news: the WIRE (national and international, real news in the
// demo) that everyone sees, and the LOCAL pool (Philadelphia) that only reporters
// on a city or district patch dig up.
import { WEEKLY_LOCAL_SIZE } from '../sim/balance.ts';
import type { Frequency } from '../sim/types.ts';
import { storyFileSchema, type Story, type WireSource } from './schemas.ts';

export interface StorySource {
  /** National and international wire for an issue. */
  wireForIssue(frequency: Frequency, issue: number): Story[];
  /** Philadelphia stories for an issue. Only reporters on a local patch find these. */
  localForIssue(frequency: Frequency, issue: number): Story[];
  /** All wire sources this feed can credit. */
  wireSources(): WireSource[];
  /** Local stories for one in-game day (1-based). */
  storiesForDay(day: number): Story[];
  /** Every story the source knows about (used by the summarizer script and lab). */
  allStories(): Story[];
  /** Number of in-game days this source can supply. */
  dayCount(): number;
  storyById(id: string): Story | undefined;
}

/** The local pool for an issue: one day for a daily, the week's top stories for a weekly. */
export function localPool(source: Pick<StorySource, 'storiesForDay'>, frequency: Frequency, issue: number): Story[] {
  const local = (d: number) => source.storiesForDay(d).filter((s) => s.scope === 'local');
  if (frequency === 'daily') return local(issue);
  const week = Array.from({ length: 7 }, (_, i) => (issue - 1) * 7 + i + 1).flatMap(local);
  return [...week]
    .sort((a, b) => b.importance - a.importance || a.day - b.day || a.filed_at.localeCompare(b.filed_at))
    .slice(0, WEEKLY_LOCAL_SIZE)
    .sort((a, b) => a.day - b.day || a.filed_at.localeCompare(b.filed_at));
}

export class JsonStorySource implements StorySource {
  private readonly stories: Story[];
  private readonly sources: WireSource[];

  constructor(raw: unknown) {
    const parsed = storyFileSchema.parse(raw);
    const ids = new Set<string>();
    for (const s of parsed.stories) {
      if (ids.has(s.id)) throw new Error(`Duplicate story id: ${s.id}`);
      ids.add(s.id);
      if (!parsed.wire_sources.some((w) => w.id === s.wire_source)) {
        throw new Error(`Story ${s.id} credits unknown wire source ${s.wire_source}`);
      }
    }
    this.stories = parsed.stories;
    this.sources = parsed.wire_sources;
  }

  wireSources(): WireSource[] {
    return this.sources;
  }

  /** The hand-written file has no national wire. */
  wireForIssue(): Story[] {
    return [];
  }

  localForIssue(frequency: Frequency, issue: number): Story[] {
    return localPool(this, frequency, issue);
  }

  storiesForDay(day: number): Story[] {
    return this.stories.filter((s) => s.day === day).sort((a, b) => a.filed_at.localeCompare(b.filed_at));
  }

  allStories(): Story[] {
    return this.stories;
  }

  dayCount(): number {
    return Math.max(0, ...this.stories.map((s) => s.day));
  }

  storyById(id: string): Story | undefined {
    return this.stories.find((s) => s.id === id);
  }
}

/** True if a story's original-coverage link is a real web address we can open (https only). */
export function isOriginalStoryUrl(url: string): boolean {
  return /^https:\/\/[^\s]+$/.test(url);
}
