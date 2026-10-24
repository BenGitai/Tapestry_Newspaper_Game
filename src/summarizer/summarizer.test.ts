import { describe, expect, it } from 'vitest';
import { LayeredArticleSource, NoRemoteProvider, TemplateArticleSource, articleSource, bundledCache } from '../data/ArticleSource.ts';
import { loadGameData } from '../data/worldData.ts';
import { cacheKey, emptyCache, parseCache, requestKey, validateCacheKeys, type CacheEntry } from './cache.ts';
import { DEFAULT_SUMMARIZER_MODEL, summarizerModel } from './config.ts';
import { callCost, estimateInputTokens, estimateOutputTokens, extrapolate } from './cost.ts';
import { buildPrompt } from './prompt.ts';
import { anglesFor, demoStories, isHandWritten, plannedRequests, voicesFor } from './plan.ts';
import { localPoolForIssue, wireForIssue } from '../sim/newsroom.ts';
import { WEEKLY_WIRE_SIZE } from '../sim/balance.ts';
import type { PaperSetup } from '../sim/types.ts';

const { world, stories } = loadGameData();
const story = stories.storyById('d1-phillies')!;
const entry: CacheEntry = { headline: 'H', deck: '', body: 'B', facts_used: [0], model: 'm', input_tokens: 1, output_tokens: 1 };

describe('config', () => {
  it('defaults to Haiku 5.5 and can be overridden by SUMMARIZER_MODEL', () => {
    expect(DEFAULT_SUMMARIZER_MODEL).toBe('claude-haiku-5-5');
    expect(summarizerModel({})).toBe('claude-haiku-5-5');
    expect(summarizerModel({ SUMMARIZER_MODEL: ' claude-sonnet-5-5 ' })).toBe('claude-sonnet-5-5');
    expect(summarizerModel({ SUMMARIZER_MODEL: '' })).toBe('claude-haiku-5-5');
  });
});

describe('cost', () => {
  it('prices Haiku 5.5 at $0.10 / $0.50 per million up to 100K prompt tokens', () => {
    expect(callCost('claude-haiku-5-5', { inputTokens: 50_000, outputTokens: 0 })).toBeCloseTo(0.005, 10);
    expect(callCost('claude-haiku-5-5', { inputTokens: 600, outputTokens: 200 })).toBeCloseTo((600 * 0.1 + 200 * 0.5) / 1e6, 12);
  });
  it('uses the long-prompt rate card above 100K tokens', () => {
    expect(callCost('claude-haiku-5-5', { inputTokens: 200_000, outputTokens: 0 })).toBeCloseTo(0.1, 6);
  });
  it('estimates tokens from the real prompt and tier', () => {
    const p = buildPrompt({ story, angle: 'straight', tier: 'lead' });
    expect(estimateInputTokens(p)).toBeGreaterThan(300);
    expect(estimateOutputTokens('lead')).toBeGreaterThan(estimateOutputTokens('secondary'));
    expect(estimateOutputTokens('secondary')).toBeGreaterThan(estimateOutputTokens('brief'));
  });
  it('extrapolates calls and cost', () => {
    expect(extrapolate(0.001, 200, 30, 1)).toEqual({ storiesPerDay: 200, days: 30, calls: 6000, cost: 6 });
  });
});

describe('cache and article source', () => {
  it('keys on story, journalist (or the desk voice), angle and tier', () => {
    expect(cacheKey('s', null, 'hard', 'lead')).toBe('s|desk|hard|lead');
    expect(requestKey({ storyId: 's', journalistId: 'r1', angle: 'puff', tier: 'brief' })).toBe('s|r1|puff|brief');
  });

  it('rejects malformed caches', () => {
    expect(() => parseCache({ version: 2, generated_at: null, entries: {} })).toThrow();
    const bad = { ...emptyCache(), entries: { 's|desk|loud|lead': entry } };
    expect(() => validateCacheKeys(bad)).toThrow(/Bad summaries cache key/);
  });

  it('the bundled cache is valid', () => {
    expect(() => validateCacheKeys(bundledCache())).not.toThrow();
  });

  it('falls back to the template when the cache is empty', () => {
    const a = new LayeredArticleSource(emptyCache()).get({ storyId: story.id, journalistId: null, angle: 'straight', tier: 'lead' }, story);
    expect(a.origin).toBe('template');
    expect(a.headline).toBe(story.wire_headline);
    expect(new TemplateArticleSource().get({ storyId: story.id, journalistId: null, angle: 'straight', tier: 'lead' }, story).origin).toBe('template');
  });

  it('prefers the reporter entry, then the desk voice, then the template', () => {
    const cache = { ...emptyCache(), entries: { [cacheKey(story.id, 'r1', 'hard', 'lead')]: { ...entry, headline: 'Reporter' }, [cacheKey(story.id, null, 'hard', 'lead')]: { ...entry, headline: 'Desk' } } };
    const src = new LayeredArticleSource(cache);
    const get = (j: string | null, angle: 'hard' | 'straight' = 'hard') => src.get({ storyId: story.id, journalistId: j, angle, tier: 'lead' }, story);
    expect(get('r1')).toMatchObject({ headline: 'Reporter', origin: 'cache' });
    expect(get('r2')).toMatchObject({ headline: 'Desk', origin: 'cache' });
    expect(get(null)).toMatchObject({ headline: 'Desk', origin: 'cache' });
    expect(get('r1', 'straight').origin).toBe('template');
  });

  it('serves the Straight article for a Puff request on a sensitive story', () => {
    const s = stories.allStories().find((x) => x.sensitivity === 'high')!;
    const cache = { ...emptyCache(), entries: { [cacheKey(s.id, null, 'straight', 'lead')]: { ...entry, headline: 'Plain' } } };
    expect(new LayeredArticleSource(cache).get({ storyId: s.id, journalistId: null, angle: 'puff', tier: 'lead' }, s).headline).toBe('Plain');
  });

  it('a remote provider fills the session layer without touching game code', async () => {
    const req = { storyId: story.id, journalistId: null, angle: 'hard' as const, tier: 'lead' as const };
    const remote = { fetch: async () => ({ [requestKey(req)]: { headline: 'Online', deck: '', body: 'x', facts_used: [0] } }) };
    const src = new LayeredArticleSource(emptyCache(), remote);
    expect(src.get(req, story).origin).toBe('template');
    expect(await src.prefetch([req])).toBe(1);
    expect(src.get(req, story)).toMatchObject({ headline: 'Online', origin: 'generated' });
    expect(await new NoRemoteProvider().fetch()).toEqual({});
  });

  it('the game reads through the shared ArticleSource interface', () => {
    const a = articleSource().get({ storyId: story.id, journalistId: null, angle: 'straight', tier: 'secondary' }, story);
    expect(a.headline.length).toBeGreaterThan(0);
  });
});

describe('plan', () => {
  const plan = plannedRequests(stories, world);

  it('covers the national wire and the local pool of issues 1-10, daily and weekly', () => {
    const ids = new Set(demoStories(stories).map((s) => s.id));
    for (const frequency of ['daily', 'weekly'] as const) {
      for (let i = 1; i <= 10; i++) {
        const game = { setup: { frequency } as PaperSetup, issueNumber: i };
        const wire = wireForIssue(game, stories);
        expect(wire.length).toBeGreaterThan(0);
        expect(wire.length).toBeLessThanOrEqual(WEEKLY_WIRE_SIZE);
        for (const s of [...wire, ...localPoolForIssue(game, stories)]) expect(ids.has(s.id), s.id).toBe(true);
      }
    }
  });

  it('writes real news in the desk voice only', () => {
    const real = demoStories(stories).find((s) => s.id.startsWith('n-'))!;
    expect(isHandWritten(real.id)).toBe(false);
    expect(plan.filter((p) => p.story.id === real.id).every((p) => p.req.journalistId === null)).toBe(true);
  });

  it('has unique keys, no Puff for sensitive stories, and every angle and tier otherwise', () => {
    expect(new Set(plan.map((p) => p.key)).size).toBe(plan.length);
    expect(plan.filter((p) => p.story.sensitivity === 'high' && p.req.angle === 'puff')).toEqual([]);
    const forStory = plan.filter((p) => p.story.id === story.id && p.req.journalistId === null);
    expect(forStory).toHaveLength(anglesFor(story).length * 3);
  });

  it('writes hand-written stories in matching desk voices and generated ones in the desk voice only', () => {
    const voices = voicesFor(story, world);
    expect(voices.length).toBeGreaterThan(0);
    for (const v of voices) expect(world.staff_pool.find((r) => r.id === v)?.desk).toBe('sports');
    const gen = stories.storiesForDay(5).find((s) => !isHandWritten(s.id))!;
    expect(voicesFor(gen, world)).toEqual([]);
    expect(plan.filter((p) => p.story.id === gen.id).every((p) => p.req.journalistId === null)).toBe(true);
  });
});
