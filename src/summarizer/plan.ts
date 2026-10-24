// Which articles the demo ships pre-generated. The demo plays a 10-issue game:
// daily = the full wire of days 1-10, weekly = the top WEEKLY_WIRE_SIZE stories of
// weeks 1-10. Both come from wireForIssue, so the set cannot drift from the game.
//
// Combinations per story: angle x length tier (Puff is skipped for sensitive
// stories). Hand-written stories are written in each matching desk reporter's
// voice as well as the neutral desk voice; generated stories use the desk voice
// only, and the game falls back to it for any other reporter.
import type { Angle, CityWorld, Story } from '../data/schemas.ts';
import { ANGLES } from '../data/schemas.ts';
import type { StorySource } from '../data/StorySource.ts';
import { wireForIssue } from '../sim/newsroom.ts';
import type { Frequency, PaperSetup, Tier } from '../sim/types.ts';
import { cacheKey } from './cache.ts';
import { DESK_VOICE_ID } from './config.ts';
import type { ArticleRequest } from './types.ts';

export const DEMO_ISSUES = 10;
export const TIER_LIST: Tier[] = ['lead', 'secondary', 'brief'];

/** Ids of the hand-written stories (generated ones look like g12-3). */
export const isHandWritten = (storyId: string): boolean => !/^g\d+-\d+$/.test(storyId);

/** Every story in the demo's fixed set, in id order. */
export function demoStories(stories: StorySource, issues = DEMO_ISSUES): Story[] {
  const byId = new Map<string, Story>();
  for (const frequency of ['daily', 'weekly'] as Frequency[]) {
    for (let issueNumber = 1; issueNumber <= issues; issueNumber++) {
      for (const s of wireForIssue({ setup: { frequency } as PaperSetup, issueNumber }, stories)) byId.set(s.id, s);
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Reporters in the original staff pool whose desk covers the story's category. */
export function voicesFor(story: Story, world: CityWorld): string[] {
  if (!isHandWritten(story.id)) return [];
  const desks = Object.entries(world.desk_categories)
    .filter(([, cats]) => Array.isArray(cats) && (cats as string[]).includes(story.category))
    .map(([desk]) => desk);
  return world.staff_pool.filter((r) => !r.id.startsWith('cand-') && desks.includes(r.desk)).map((r) => r.id);
}

export function anglesFor(story: Story): Angle[] {
  return story.sensitivity === 'high' ? ANGLES.filter((a) => a !== 'puff') : [...ANGLES];
}

export function plannedRequests(stories: StorySource, world: CityWorld, issues = DEMO_ISSUES): { req: ArticleRequest; story: Story; key: string }[] {
  const out: { req: ArticleRequest; story: Story; key: string }[] = [];
  for (const story of demoStories(stories, issues)) {
    const voices: (string | null)[] = [null, ...voicesFor(story, world)];
    for (const journalistId of voices) {
      for (const angle of anglesFor(story)) {
        for (const tier of TIER_LIST) {
          out.push({ req: { storyId: story.id, journalistId, angle, tier }, story, key: cacheKey(story.id, journalistId ?? DESK_VOICE_ID, angle, tier) });
        }
      }
    }
  }
  return out;
}
