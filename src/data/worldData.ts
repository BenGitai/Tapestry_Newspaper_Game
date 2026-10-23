// Loads and validates the static demo data. Pure: works in the browser, in Node
// scripts and in tests.
import storiesRaw from '../../data/stories.philly.json';
import worldRaw from '../../data/districts.philly.json';
import citiesRaw from '../../data/cities.json';
import { cityListSchema, cityWorldSchema, type City, type CityWorld } from './schemas.ts';
import { JsonStorySource, type StorySource } from './StorySource.ts';

export interface GameData {
  world: CityWorld;
  cities: City[];
  stories: StorySource;
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
  const stories = new JsonStorySource(storiesRaw);
  validateStoryRefs(stories, world);
  const cities = cityListSchema.parse(citiesRaw).cities;
  cached = { world, cities, stories };
  return cached;
}

/** Strips the "(fictional)" marker from data names for display on the printed page. */
export function displayName(name: string): string {
  return name.replace(/\s*\(fictional\)\s*/i, '').trim();
}
