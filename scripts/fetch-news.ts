// npm run news:fetch — pull real headlines, short descriptions and links from
// public RSS feeds (NPR, BBC News, PBS NewsHour) into data/news/snapshot.json.
// Each run merges new items into the snapshot (deduped by link), so running it on
// several days grows the pool. Only the headline, the feed's own short summary and
// the link are kept — never the article text.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface SnapshotItem {
  id: string;
  source: 'npr' | 'bbc' | 'pbs';
  feed: string;
  /** Section the feed covers; the build step decides the final category. */
  section: string;
  title: string;
  description: string;
  link: string;
  /** ISO date. */
  published: string;
}

interface Feed {
  source: SnapshotItem['source'];
  feed: string;
  section: string;
  url: string;
}

const FEEDS: Feed[] = [
  { source: 'npr', feed: 'NPR National', section: 'national', url: 'https://feeds.npr.org/1003/rss.xml' },
  { source: 'npr', feed: 'NPR World', section: 'world', url: 'https://feeds.npr.org/1004/rss.xml' },
  { source: 'npr', feed: 'NPR Politics', section: 'politics', url: 'https://feeds.npr.org/1014/rss.xml' },
  { source: 'npr', feed: 'NPR Business', section: 'economy', url: 'https://feeds.npr.org/1006/rss.xml' },
  { source: 'npr', feed: 'NPR Economy', section: 'economy', url: 'https://feeds.npr.org/1017/rss.xml' },
  { source: 'npr', feed: 'NPR Science', section: 'science', url: 'https://feeds.npr.org/1007/rss.xml' },
  { source: 'npr', feed: 'NPR Health', section: 'social', url: 'https://feeds.npr.org/1128/rss.xml' },
  { source: 'npr', feed: 'NPR Technology', section: 'science', url: 'https://feeds.npr.org/1019/rss.xml' },
  { source: 'npr', feed: 'NPR Education', section: 'social', url: 'https://feeds.npr.org/1013/rss.xml' },
  { source: 'npr', feed: 'NPR Arts & Life', section: 'culture', url: 'https://feeds.npr.org/1008/rss.xml' },
  { source: 'npr', feed: 'NPR Music', section: 'culture', url: 'https://feeds.npr.org/1039/rss.xml' },
  { source: 'npr', feed: 'NPR Movies', section: 'culture', url: 'https://feeds.npr.org/1045/rss.xml' },
  { source: 'npr', feed: 'NPR Climate', section: 'science', url: 'https://feeds.npr.org/1167/rss.xml' },
  { source: 'npr', feed: 'NPR Sports', section: 'sports', url: 'https://feeds.npr.org/1055/rss.xml' },
  { source: 'bbc', feed: 'BBC World', section: 'world', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { source: 'bbc', feed: 'BBC US & Canada', section: 'national', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
  { source: 'bbc', feed: 'BBC Africa', section: 'world', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml' },
  { source: 'bbc', feed: 'BBC Asia', section: 'world', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
  { source: 'bbc', feed: 'BBC Europe', section: 'world', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
  { source: 'bbc', feed: 'BBC Latin America', section: 'world', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
  { source: 'bbc', feed: 'BBC Middle East', section: 'world', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
  { source: 'bbc', feed: 'BBC Business', section: 'economy', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { source: 'bbc', feed: 'BBC Technology', section: 'science', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { source: 'bbc', feed: 'BBC Science & Environment', section: 'science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { source: 'bbc', feed: 'BBC Health', section: 'social', url: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  { source: 'bbc', feed: 'BBC Entertainment & Arts', section: 'culture', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
  { source: 'bbc', feed: 'BBC Sport', section: 'sports', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { source: 'pbs', feed: 'PBS Headlines', section: 'national', url: 'https://www.pbs.org/newshour/feeds/rss/headlines' },
  { source: 'pbs', feed: 'PBS Politics', section: 'politics', url: 'https://www.pbs.org/newshour/feeds/rss/politics' },
  { source: 'pbs', feed: 'PBS Nation', section: 'national', url: 'https://www.pbs.org/newshour/feeds/rss/nation' },
  { source: 'pbs', feed: 'PBS World', section: 'world', url: 'https://www.pbs.org/newshour/feeds/rss/world' },
  { source: 'pbs', feed: 'PBS Economy', section: 'economy', url: 'https://www.pbs.org/newshour/feeds/rss/economy' },
  { source: 'pbs', feed: 'PBS Science', section: 'science', url: 'https://www.pbs.org/newshour/feeds/rss/science' },
  { source: 'pbs', feed: 'PBS Health', section: 'social', url: 'https://www.pbs.org/newshour/feeds/rss/health' },
  { source: 'pbs', feed: 'PBS Arts', section: 'culture', url: 'https://www.pbs.org/newshour/feeds/rss/arts' },
];

export const SNAPSHOT_PATH = 'data/news/snapshot.json';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (m, e: string) => {
      if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith('#') && e !== '#39') return String.fromCodePoint(parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(item: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(item);
  return m ? decode(m[1]!) : '';
}

/** Strip tracking parameters so the same story from two feeds dedupes. */
export function canonicalLink(link: string): string {
  try {
    const u = new URL(link);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|at_|ns_|ocid|xtor)/i.test(k)) u.searchParams.delete(k);
    u.hash = '';
    return u.toString();
  } catch {
    return link;
  }
}

export function parseRss(xml: string, feed: Feed): SnapshotItem[] {
  const out: SnapshotItem[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const item = m[0];
    const title = tag(item, 'title');
    const link = canonicalLink(tag(item, 'link') || tag(item, 'guid'));
    const description = tag(item, 'description');
    const date = new Date(tag(item, 'pubDate') || tag(item, 'dc:date'));
    if (!title || !/^https:\/\//.test(link) || description.length < 30 || Number.isNaN(date.getTime())) continue;
    out.push({
      id: `n-${createHash('sha1').update(link).digest('hex').slice(0, 10)}`,
      source: feed.source,
      feed: feed.feed,
      section: feed.section,
      title,
      description: description.slice(0, 600),
      link,
      published: date.toISOString(),
    });
  }
  return out;
}

async function main(): Promise<void> {
  const existing: SnapshotItem[] = existsSync(SNAPSHOT_PATH) ? (JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { items: SnapshotItem[] }).items : [];
  const byLink = new Map(existing.map((i) => [i.link, i]));
  const seenTitles = new Set(existing.map((i) => i.title.toLowerCase()));
  let added = 0;
  for (const feed of FEEDS) {
    try {
      const r = await fetch(feed.url, { headers: { 'User-Agent': 'TapestryNewspaperGame demo build (offline snapshot)' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const items = parseRss(await r.text(), feed);
      let n = 0;
      for (const it of items) {
        if (byLink.has(it.link) || seenTitles.has(it.title.toLowerCase())) continue;
        byLink.set(it.link, it);
        seenTitles.add(it.title.toLowerCase());
        n++;
      }
      added += n;
      console.log(`${feed.feed.padEnd(26)} ${String(items.length).padStart(3)} items, ${n} new`);
    } catch (e) {
      console.log(`${feed.feed.padEnd(26)} failed: ${(e as Error).message}`);
    }
  }
  const items = [...byLink.values()].sort((a, b) => a.published.localeCompare(b.published));
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, JSON.stringify({ fetched_at: new Date().toISOString(), note: 'Headlines, feed summaries and links from public RSS feeds (NPR, BBC News, PBS NewsHour). No article text. Used to build the demo news; see docs.', items }, null, 1) + '\n');
  console.log(`\nSnapshot: ${items.length} items (${added} new).`);
}

await main();
