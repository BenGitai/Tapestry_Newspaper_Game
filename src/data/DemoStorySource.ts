// The demo's news feed: the hand-written stories (days 1-4) plus generated
// generic news for every day up to DEMO_DAYS. Same StorySource interface, so a
// live feed can replace it later.
import { DEMO_DAYS, GENERATED_PER_DAY } from '../sim/balance.ts';
import { generateDay, HAND_DAY_CAP } from './NewsGenerator.ts';
import type { CityWorld, Story, WireSource } from './schemas.ts';
import type { StorySource } from './StorySource.ts';

export class DemoStorySource implements StorySource {
  private readonly cache = new Map<number, Story[]>();

  constructor(
    private readonly hand: StorySource,
    private readonly world: CityWorld,
    private readonly days = DEMO_DAYS,
  ) {}

  wireSources(): WireSource[] {
    return this.hand.wireSources();
  }

  storiesForDay(day: number): Story[] {
    if (day < 1 || day > this.days) return [];
    const hit = this.cache.get(day);
    if (hit) return hit;
    const handStories = this.hand.storiesForDay(day);
    // Every day has GENERATED_PER_DAY stories in total; hand-written days are topped up.
    const generated = generateDay(
      this.world,
      day,
      handStories.length ? { count: Math.max(0, GENERATED_PER_DAY - handStories.length), maxImportance: HAND_DAY_CAP } : { count: GENERATED_PER_DAY },
    );
    const all = [...handStories, ...generated].sort((a, b) => a.filed_at.localeCompare(b.filed_at));
    this.cache.set(day, all);
    return all;
  }

  allStories(): Story[] {
    const out: Story[] = [];
    for (let d = 1; d <= this.days; d++) out.push(...this.storiesForDay(d));
    return out;
  }

  dayCount(): number {
    return this.days;
  }

  storyById(id: string): Story | undefined {
    const m = /^g(\d+)-\d+$/.exec(id);
    if (m) return this.storiesForDay(Number(m[1])).find((s) => s.id === id);
    return this.hand.storyById(id);
  }
}
