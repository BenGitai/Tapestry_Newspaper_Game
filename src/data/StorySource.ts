// Stories come through this interface so a live news source can replace the
// fixed JSON file later without the game noticing.
import { storyFileSchema, type Story, type WireSource } from './schemas.ts';

export interface StorySource {
  /** All wire sources this feed can credit. */
  wireSources(): WireSource[];
  /** Stories that arrive on the wire for one in-game day (1-based). */
  storiesForDay(day: number): Story[];
  /** Every story the source knows about (used by the summarizer script and lab). */
  allStories(): Story[];
  /** Number of in-game days this source can supply. */
  dayCount(): number;
  storyById(id: string): Story | undefined;
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
