import { describe, expect, it } from 'vitest';
import worldRaw from '../../data/districts.philly.json';
import { JsonStorySource } from './StorySource.ts';
import { displayName, loadGameData, parseWorld } from './worldData.ts';

describe('demo data', () => {
  const { world, stories, cities } = loadGameData();

  it('loads 30 stories over 4 days', () => {
    expect(stories.allStories()).toHaveLength(30);
    expect(stories.dayCount()).toBe(4);
    expect([1, 2, 3, 4].map((d) => stories.storiesForDay(d).length)).toEqual([8, 8, 7, 7]);
  });

  it('every category has stories, including science and tech', () => {
    const cats = new Set(stories.allStories().map((s) => s.category));
    expect([...cats].sort()).toEqual(['culture', 'economy', 'politics', 'science', 'social', 'sports', 'world']);
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
    expect(world.staff_pool).toHaveLength(18);
    for (const r of world.staff_pool) {
      for (const v of Object.values(r.attributes)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(20);
      }
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
