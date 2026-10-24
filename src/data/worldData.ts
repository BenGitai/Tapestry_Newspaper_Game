// Loads and validates the static demo data. Pure: works in the browser, in Node
// scripts and in tests.
import storiesRaw from '../../data/stories.philly.json';
import worldRaw from '../../data/districts.philly.json';
import citiesRaw from '../../data/cities.json';
import subtopicsRaw from '../../data/subtopics.json';
import { cityListSchema, cityWorldSchema, reporterSchema, subtopicFileSchema, type Category, type City, type CityWorld, type SubtopicMap } from './schemas.ts';
import { JsonStorySource, type StorySource } from './StorySource.ts';
import { DemoStorySource } from './DemoStorySource.ts';
import { GameNewsSource, RealNewsSource } from './RealNewsSource.ts';
import realNewsRaw from '../../data/news/stories.json';
import { generateCandidates } from './CandidateGenerator.ts';
import { EXTRA_CANDIDATES } from '../sim/balance.ts';

export interface GameData {
  world: CityWorld;
  cities: City[];
  stories: StorySource;
  subtopics: SubtopicMap;
}

export function parseSubtopics(raw: unknown): SubtopicMap {
  return subtopicFileSchema.parse(raw).subtopics as SubtopicMap;
}

/** Every story's subtopic must belong to its category; every reporter's interest must exist. */
export function validateSubtopics(stories: StorySource, world: CityWorld, subtopics: SubtopicMap, days = stories.dayCount()): void {
  const all = new Set(Object.values(subtopics).flat().map((s) => s.id));
  for (let d = 1; d <= days; d++) {
    for (const s of stories.storiesForDay(d)) {
      if (!subtopics[s.category].some((x) => x.id === s.subtopic)) throw new Error(`Story ${s.id}: subtopic ${s.subtopic} is not in ${s.category}`);
    }
  }
  for (const r of world.staff_pool) if (!all.has(r.interest)) throw new Error(`Reporter ${r.id}: unknown interest ${r.interest}`);
}

export function subtopicName(id: string): string {
  for (const list of Object.values(loadGameData().subtopics)) {
    const s = list.find((x) => x.id === id);
    if (s) return s.name;
  }
  return id;
}

export function categoryOfSubtopic(id: string): Category | undefined {
  for (const [cat, list] of Object.entries(loadGameData().subtopics)) if (list.some((x) => x.id === id)) return cat as Category;
  return undefined;
}

export function parseWorld(raw: unknown): CityWorld {
  const world = cityWorldSchema.parse(raw);
  const districtIds = new Set(world.districts.map((d) => d.id));
  const groupIds = new Set(world.reader_groups.map((g) => g.id));
  for (const d of world.districts) {
    for (const g of Object.keys(d.group_mix)) {
      if (!groupIds.has(g)) throw new Error(`District ${d.id} references unknown reader group ${g}`);
    }
  }
  for (const id of world.rival.strong_districts) {
    if (!districtIds.has(id)) throw new Error(`Rival strong district ${id} is unknown`);
  }
  return world;
}

export function validateStoryRefs(stories: StorySource, world: CityWorld): void {
  const districtIds = new Set(world.districts.map((d) => d.id));
  const entityIds = new Set(world.entities.map((e) => e.id));
  for (const s of stories.allStories()) {
    for (const d of s.districts) if (!districtIds.has(d)) throw new Error(`Story ${s.id}: unknown district ${d}`);
    for (const t of s.targets) if (!entityIds.has(t)) throw new Error(`Story ${s.id}: unknown target ${t}`);
  }
}

let cached: GameData | undefined;

export function loadGameData(): GameData {
  if (cached) return cached;
  const world = parseWorld(worldRaw);
  const hand = new JsonStorySource(storiesRaw);
  validateStoryRefs(hand, world);
  const subtopics = parseSubtopics(subtopicsRaw);
  validateSubtopics(hand, world, subtopics, hand.dayCount());
  const stories = new GameNewsSource(new RealNewsSource(realNewsRaw), new DemoStorySource(hand, world));
  const cities = cityListSchema.parse(citiesRaw).cities;
  // Grow the hiring market with generated candidates (validated like the rest).
  const extra = generateCandidates(world, subtopics, EXTRA_CANDIDATES).map((c) => reporterSchema.parse(c));
  const full: CityWorld = { ...world, staff_pool: [...world.staff_pool, ...extra] };
  validateSubtopics(hand, full, subtopics, hand.dayCount());
  cached = { world: full, cities, stories, subtopics };
  return cached;
}

/** Strips the "(fictional)" marker from data names for display on the printed page. */
export function displayName(name: string): string {
  return name.replace(/\s*\(fictional\)\s*/i, '').trim();
}
