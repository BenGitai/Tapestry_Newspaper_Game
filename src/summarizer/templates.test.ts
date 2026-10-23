import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { templateArticle } from './templates.ts';

const { stories } = loadGameData();

describe('template fallback', () => {
  it('uses only the story facts and wire headline, verbatim', () => {
    for (const s of stories.allStories()) {
      for (const tier of ['lead', 'secondary', 'brief'] as const) {
        const a = templateArticle(s, tier);
        expect(a.headline).toBe(s.wire_headline);
        expect(a.body).toBe(a.facts_used.map((i) => s.facts[i]).join(' '));
        if (a.deck) expect(s.facts).toContain(a.deck);
      }
    }
  });

  it('always uses at least one fact, and briefs use exactly one', () => {
    for (const s of stories.allStories()) {
      expect(templateArticle(s, 'brief').facts_used).toEqual([0]);
      expect(templateArticle(s, 'secondary').facts_used.length).toBeGreaterThan(0);
    }
  });

  it('leads carry more facts than secondaries', () => {
    const s = stories.storyById('d1-library')!;
    expect(templateArticle(s, 'lead').facts_used.length).toBeGreaterThan(templateArticle(s, 'secondary').facts_used.length);
  });
});
