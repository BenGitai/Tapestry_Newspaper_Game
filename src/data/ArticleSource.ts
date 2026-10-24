// Where the game gets article text from. Lookup order: articles generated this
// session by a remote provider, then the pre-generated cache
// (data/generated/summaries.cache.json, written by `npm run summarize`), then
// templates built from the facts. The game only ever calls `get`, so a shared
// online source can be plugged in later through RemoteArticleProvider.
import cacheRaw from '../../data/generated/summaries.cache.json';
import type { Story } from './schemas.ts';
import { cacheKey, entryToText, parseCache, requestKey, validateCacheKeys, type CacheFile } from '../summarizer/cache.ts';
import { DESK_VOICE_ID } from '../summarizer/config.ts';
import { templateArticle } from '../summarizer/templates.ts';
import type { Article, ArticleRequest, ArticleText } from '../summarizer/types.ts';

export interface ArticleSource {
  get(req: ArticleRequest, story: Story): Article;
}

export class TemplateArticleSource implements ArticleSource {
  get(req: ArticleRequest, story: Story): Article {
    return { ...templateArticle(story, req.tier), origin: 'template' };
  }
}

/**
 * The final game's online source: a server that generates each article once and
 * shares it with every player. Not built yet. Implementations take requests and
 * return text keyed by `requestKey(req)`; anything missing falls back to the cache
 * and templates. API keys live on that server, never in the game.
 */
export interface RemoteArticleProvider {
  fetch(reqs: ArticleRequest[]): Promise<Record<string, ArticleText>>;
}

/** Placeholder until the server exists: has nothing, so the game uses cache and templates. */
export class NoRemoteProvider implements RemoteArticleProvider {
  async fetch(): Promise<Record<string, ArticleText>> {
    return {};
  }
}

export class LayeredArticleSource implements ArticleSource {
  private readonly session = new Map<string, ArticleText>();

  constructor(
    private readonly cache: CacheFile,
    private readonly remote: RemoteArticleProvider = new NoRemoteProvider(),
  ) {}

  get(req: ArticleRequest, story: Story): Article {
    // Sensitive stories never run Puff, so their Puff requests share the Straight article.
    const angle = story.sensitivity === 'high' && req.angle === 'puff' ? 'straight' : req.angle;
    const exact = { ...req, angle };
    const hit = this.session.get(requestKey(exact));
    if (hit) return { ...hit, origin: 'generated' };
    const entries = this.cache.entries;
    const cached = entries[requestKey(exact)] ?? entries[cacheKey(req.storyId, DESK_VOICE_ID, angle, req.tier)];
    if (cached) return { ...entryToText(cached), origin: 'cache' };
    return { ...templateArticle(story, req.tier), origin: 'template' };
  }

  /** Ask the remote provider for articles the cache lacks, so later `get` calls find them. */
  async prefetch(reqs: ArticleRequest[], have: (req: ArticleRequest) => boolean = () => false): Promise<number> {
    const wanted = reqs.filter((r) => !have(r) && !this.session.has(requestKey(r)));
    if (wanted.length === 0) return 0;
    const got = await this.remote.fetch(wanted);
    for (const [key, text] of Object.entries(got)) this.session.set(key, text);
    return Object.keys(got).length;
  }

  cacheSize(): number {
    return Object.keys(this.cache.entries).length;
  }
}

const bundled = parseCache(cacheRaw);
validateCacheKeys(bundled);

let source: ArticleSource = new LayeredArticleSource(bundled);

export function articleSource(): ArticleSource {
  return source;
}

export function setArticleSource(next: ArticleSource): void {
  source = next;
}

/** The pre-generated cache that ships with the game (empty until `npm run summarize` is run with a key). */
export function bundledCache(): CacheFile {
  return bundled;
}
