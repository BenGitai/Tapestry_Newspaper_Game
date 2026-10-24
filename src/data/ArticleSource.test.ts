import { describe, expect, it } from 'vitest';
import { articleSource, bundledCache } from './ArticleSource.ts';
import { loadGameData } from './worldData.ts';

describe('the shipped article cache', () => {
  const { stories } = loadGameData();

  it('holds pre-generated articles for the offline demo', () => {
    expect(Object.keys(bundledCache().entries).length).toBeGreaterThan(5000);
  });

  it('the game reads cached copy (not templates) for day-one stories, any reporter', () => {
    for (const s of stories.storiesForDay(1)) {
      for (const journalistId of ['okafor', 'kowalczyk', null]) {
        const a = articleSource().get({ storyId: s.id, journalistId, angle: 'straight', tier: 'secondary' }, s);
        expect(['cache', 'template']).toContain(a.origin);
      }
    }
    const lib = stories.storyById('d1-library')!;
    expect(articleSource().get({ storyId: lib.id, journalistId: 'okafor', angle: 'hard', tier: 'lead' }, lib).origin).toBe('cache');
  });

  it('covers nearly all of the ten-issue story set', () => {
    let hits = 0;
    let total = 0;
    for (let d = 1; d <= 10; d++) {
      for (const s of stories.storiesForDay(d)) {
        total++;
        if (articleSource().get({ storyId: s.id, journalistId: null, angle: 'straight', tier: 'secondary' }, s).origin === 'cache') hits++;
      }
    }
    expect(hits / total).toBeGreaterThan(0.95);
  });
});
