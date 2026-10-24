// The demo's national and international wire: real news built from public RSS
// headlines and summaries (data/news/stories.json, made by npm run news:build).
// Each story's "day" is the demo issue it belongs to (1-10).
import { DAILY_WIRE_SIZE, WEEKLY_WIRE_SIZE } from '../sim/balance.ts';
import type { Frequency } from '../sim/types.ts';
import { storyFileSchema, type Story, type WireSource } from './schemas.ts';
import type { StorySource } from './StorySource.ts';

export class RealNewsSource {
  private readonly stories: Story[];
  private readonly sources: WireSource[];
  private readonly byId: Map<string, Story>;

  constructor(raw: unknown) {
    const parsed = storyFileSchema.parse(raw);
    this.stories = parsed.stories;
    this.sources = parsed.wire_sources;
    this.byId = new Map(this.stories.map((s) => [s.id, s]));
  }

  wireSources(): WireSource[] {
    return this.sources;
  }

  /**
   * The issue's real stories: the most important of each desk in turn, so every
   * beat has something on the wire. Shown in the order they were published.
   */
  wireForIssue(frequency: Frequency, issue: number): Story[] {
    const size = frequency === 'daily' ? DAILY_WIRE_SIZE : WEEKLY_WIRE_SIZE;
    const byDesk = new Map<string, Story[]>();
    for (const s of this.stories.filter((x) => x.day === issue).sort((a, b) => b.importance - a.importance || (a.published ?? '').localeCompare(b.published ?? ''))) {
      byDesk.set(s.category, [...(byDesk.get(s.category) ?? []), s]);
    }
    const picked: Story[] = [];
    for (let round = 0; picked.length < size; round++) {
      const next = [...byDesk.values()].map((list) => list[round]).filter((s): s is Story => !!s);
      if (!next.length) break;
      picked.push(...next.sort((a, b) => b.importance - a.importance).slice(0, size - picked.length));
    }
    return picked.sort((a, b) => (a.published ?? '').localeCompare(b.published ?? ''));
  }

  all(): Story[] {
    return this.stories;
  }

  storyById(id: string): Story | undefined {
    return this.byId.get(id);
  }
}

/** Real national/world wire plus the local Philadelphia pool, as one source. */
export class GameNewsSource implements StorySource {
  constructor(
    private readonly real: RealNewsSource,
    private readonly local: StorySource,
  ) {}

  wireSources(): WireSource[] {
    return [...this.local.wireSources(), ...this.real.wireSources()];
  }

  wireForIssue(frequency: Frequency, issue: number): Story[] {
    return this.real.wireForIssue(frequency, issue);
  }

  localForIssue(frequency: Frequency, issue: number): Story[] {
    return this.local.localForIssue(frequency, issue);
  }

  storiesForDay(day: number): Story[] {
    return this.local.storiesForDay(day);
  }

  allStories(): Story[] {
    return [...this.real.all(), ...this.local.allStories()];
  }

  dayCount(): number {
    return this.local.dayCount();
  }

  storyById(id: string): Story | undefined {
    return id.startsWith('n-') ? this.real.storyById(id) : this.local.storyById(id);
  }
}
