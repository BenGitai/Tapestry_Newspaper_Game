import { describe, expect, it } from 'vitest';
import worldRaw from '../../data/districts.philly.json';
import storiesRaw from '../../data/stories.philly.json';
import { DEMO_DAYS, EXTRA_CANDIDATES, GENERATED_PER_DAY } from '../sim/balance.ts';
import { storySchema } from './schemas.ts';
import { JsonStorySource } from './StorySource.ts';
import { displayName, loadGameData, parseWorld, validateSubtopics } from './worldData.ts';

describe('demo data', () => {
  const { world, cities, subtopics } = loadGameData();
  const stories = new JsonStorySource(storiesRaw);

  it('loads 30 stories over 4 days', () => {
    expect(stories.allStories()).toHaveLength(30);
    expect(stories.dayCount()).toBe(4);
    expect([1, 2, 3, 4].map((d) => stories.storiesForDay(d).length)).toEqual([8, 8, 7, 7]);
  });

  it('every category has stories, including science and tech', () => {
    const cats = new Set(stories.allStories().map((s) => s.category));
    expect([...cats].sort()).toEqual(['culture', 'economy', 'politics', 'science', 'social', 'sports', 'world']);
  });

  it('every story has a subtopic from its category, and every reporter an interest', () => {
    expect(() => validateSubtopics(stories, world, subtopics)).not.toThrow();
  });

  it('story lean signals are balanced between left and right', () => {
    const leans = stories.allStories().map((s) => s.hard_hitting_lean);
    const left = leans.filter((l) => l < 0).reduce((a, b) => a + b, 0);
    const right = leans.filter((l) => l > 0).reduce((a, b) => a + b, 0);
    expect(Math.abs(left + right)).toBeLessThan(0.15);
  });

  it('sorts a day by time filed', () => {
    const times = stories.storiesForDay(1).map((s) => s.filed_at);
    expect(times).toEqual([...times].sort());
  });

  it('only Philadelphia is playable', () => {
    expect(cities.filter((c) => c.enabled).map((c) => c.id)).toEqual(['philadelphia']);
  });

  it('every reporter has a full set of 1-20 attributes', () => {
    expect(world.staff_pool).toHaveLength(18 + EXTRA_CANDIDATES);
    for (const r of world.staff_pool) {
      for (const v of Object.values(r.attributes)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(20);
      }
    }
  });

  it('generated candidates are unique, fictional-looking hires with salaries in the normal range', () => {
    const extra = world.staff_pool.filter((r) => r.id.startsWith('cand-'));
    expect(extra).toHaveLength(EXTRA_CANDIDATES);
    expect(new Set(world.staff_pool.map((r) => r.name)).size).toBe(world.staff_pool.length);
    for (const r of extra) {
      expect(r.salary_per_issue).toBeGreaterThanOrEqual(30);
      expect(r.salary_per_issue).toBeLessThanOrEqual(220);
    }
  });

  it('district population shares add up to 1', () => {
    const total = world.districts.reduce((a, d) => a + d.population_share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('rejects a story with an unknown wire source', () => {
    expect(
      () =>
        new JsonStorySource({
          wire_sources: [{ id: 'a', name: 'A', fictional: true }],
          stories: [{ ...stories.allStories()[0], wire_source: 'nope' }],
        }),
    ).toThrow(/unknown wire source/);
  });

  it('rejects a reporter missing attributes', () => {
    const bad = structuredClone(worldRaw) as { staff_pool: { attributes?: unknown }[] };
    delete bad.staff_pool[0]!.attributes;
    expect(() => parseWorld(bad)).toThrow();
  });

  it('strips the fictional marker for print', () => {
    expect(displayName('Helix Forge Therapeutics (fictional)')).toBe('Helix Forge Therapeutics');
  });
});

describe('generated news', () => {
  const { world, stories, subtopics } = loadGameData();
  const all = stories.allStories();
  const generated = all.filter((s) => s.id.startsWith('g'));

  it('covers every day of the demo with valid stories', () => {
    expect(stories.dayCount()).toBe(DEMO_DAYS);
    for (const d of [1, 2, 3, 4, 5, 33]) expect(stories.storiesForDay(d)).toHaveLength(GENERATED_PER_DAY);
    expect(stories.storiesForDay(5)).toHaveLength(GENERATED_PER_DAY);
    expect(stories.storiesForDay(DEMO_DAYS)).toHaveLength(GENERATED_PER_DAY);
    for (const s of generated) expect(() => storySchema.parse(s)).not.toThrow();
    expect(() => validateSubtopics(stories, world, subtopics)).not.toThrow();
  });

  it('is deterministic and ids resolve', () => {
    const again = loadGameData().stories.storiesForDay(23);
    expect(again).toEqual(stories.storiesForDay(23));
    expect(stories.storyById(generated[100]!.id)).toEqual(generated[100]);
  });

  it('every number in a headline appears in the facts', () => {
    for (const s of generated) {
      const facts = s.facts.join(' ');
      for (const num of s.wire_headline.match(/\d[\d,.]*/g) ?? []) expect(facts, s.wire_headline).toContain(num.replace(/[.,]$/, ''));
    }
  });

  it('only references real districts and entities, and every category appears each day', () => {
    const districtIds = new Set(world.districts.map((d) => d.id));
    const entityIds = new Set(world.entities.map((e) => e.id));
    for (const s of generated) {
      for (const d of s.districts) expect(districtIds.has(d)).toBe(true);
      for (const t of s.targets) expect(entityIds.has(t)).toBe(true);
    }
    for (let d = 5; d <= 12; d++) expect(new Set(stories.storiesForDay(d).map((s) => s.category)).size).toBe(7);
  });

  it('left and right lean stay balanced across the whole demo, also weighted by importance', () => {
    for (const weight of [() => 1, (s: { importance: number }) => s.importance]) {
      const left = generated.filter((s) => s.hard_hitting_lean < 0).reduce((a, s) => a + s.hard_hitting_lean * weight(s), 0);
      const right = generated.filter((s) => s.hard_hitting_lean > 0).reduce((a, s) => a + s.hard_hitting_lean * weight(s), 0);
      expect(Math.abs(left + right) / Math.max(1, right - left)).toBeLessThan(0.05);
    }
  });

  it('hand-written days keep their designed headlines on top', () => {
    for (let d = 1; d <= 4; d++) {
      for (const s of stories.storiesForDay(d).filter((x) => x.id.startsWith('g'))) expect(s.importance).toBeLessThanOrEqual(3);
    }
  });
});
