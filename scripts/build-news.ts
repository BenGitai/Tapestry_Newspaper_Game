// npm run news:build — turn the RSS snapshot (data/news/snapshot.json) into game
// stories (data/news/stories.json). For each new item the model picks a category,
// subtopic, importance, sensitivity and lean signal, and restates the headline and
// summary as facts; facts with numbers or names not in the source are dropped.
// Results are kept per item, so re-runs only pay for new items. Stories are then
// spread over the demo's 10 issues in the order they were published.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadGameData } from '../src/data/worldData.ts';
import type { Category, Story } from '../src/data/schemas.ts';
import { MAX_ISSUES } from '../src/sim/balance.ts';
import { callCost, type Usage } from '../src/summarizer/cost.ts';
import { summarizerModel } from '../src/summarizer/config.ts';
import { makeClient } from '../server/generate.ts';
import { checkFacts, extract, type Extraction } from '../server/newsFacts.ts';
import type { SnapshotItem } from './fetch-news.ts';

const SNAPSHOT_PATH = 'data/news/snapshot.json';
const STORIES_PATH = 'data/news/stories.json';
const EXTRACTIONS_PATH = 'data/news/extractions.json';

const args = parseArgs({ options: { limit: { type: 'string' }, concurrency: { type: 'string', default: '8' } } }).values;
const { subtopics } = loadGameData();
const model = summarizerModel(process.env);

const snapshot = (JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { items: SnapshotItem[] }).items;
const extractions: Record<string, Extraction | { usable: false; failed: string }> = existsSync(EXTRACTIONS_PATH)
  ? (JSON.parse(readFileSync(EXTRACTIONS_PATH, 'utf8')) as { items: Record<string, Extraction> }).items
  : {};

const todo = snapshot.filter((i) => !(i.id in extractions)).slice(0, args.limit ? Number(args.limit) : undefined);
console.log(`Model: ${model}. Snapshot ${snapshot.length} items, ${Object.keys(extractions).length} already processed, ${todo.length} to process.`);

const save = () => writeFileSync(EXTRACTIONS_PATH, JSON.stringify({ model, items: extractions }, null, 1) + '\n');
const usage: Usage[] = [];
if (todo.length) {
  const client = makeClient();
  let next = 0;
  let done = 0;
  const work = async () => {
    for (;;) {
      const i = next++;
      const item = todo[i];
      if (!item) return;
      try {
        const r = await extract(client, model, item, subtopics);
        usage.push(r.usage);
        extractions[item.id] = r.data ?? { usable: false, failed: r.stop ?? 'unparseable' };
      } catch (e) {
        extractions[item.id] = { usable: false, failed: (e as Error).message.slice(0, 120) };
      }
      if (++done % 25 === 0) {
        save();
        console.log(`  ${done}/${todo.length}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Number(args.concurrency)) }, work));
  save();
  const cost = usage.reduce((a, u) => a + callCost(model, u), 0);
  console.log(`Extraction cost: ${usage.length} calls, $${cost.toFixed(4)}`);
}

// ---- turn extractions into stories ----
const INCHES = [0, 6, 8, 10, 12, 14];
const valid = (cat: Category, sub: string) => subtopics[cat].some((s) => s.id === sub);
const stories: Story[] = [];
const dropped: Record<string, number> = {};
const drop = (why: string) => (dropped[why] = (dropped[why] ?? 0) + 1);

for (const item of snapshot) {
  const x = extractions[item.id];
  if (!x || !x.usable || !('facts' in x)) {
    drop('not usable');
    continue;
  }
  // World holds only international news. Foreign politics and society go to World;
  // foreign sport, science, culture and business keep their own desks.
  let category: Category = x.category;
  if (x.scope === 'international' && (category === 'politics' || category === 'social')) category = 'world';
  if (x.scope === 'us' && category === 'world') {
    drop('US story marked world');
    continue;
  }
  let subtopic = x.subtopic;
  if (category === 'politics' && subtopic === 'council') subtopic = 'state_federal';
  if (!valid(category, subtopic)) subtopic = subtopics[category][0]!.id;
  const facts = checkFacts(x.facts, item);
  if (facts.length === 0) {
    drop('no facts survived the check');
    continue;
  }
  const strength = x.lean === 'none' ? 0 : Math.min(3, Math.max(1, x.lean_strength));
  const lean = x.lean === 'left' ? -0.1 * strength : x.lean === 'right' ? 0.1 * strength : 0;
  const published = new Date(item.published);
  stories.push({
    id: item.id,
    day: 0,
    filed_at: published.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }),
    wire_source: item.source,
    category,
    subtopic,
    scope: x.scope === 'us' ? 'national' : 'world',
    districts: [],
    wire_headline: item.title,
    wire_text: item.description,
    facts,
    importance: x.importance,
    base_column_inches: INCHES[x.importance]!,
    sensitivity: x.sensitive ? 'high' : 'normal',
    hard_hitting_lean: Math.round(lean * 10) / 10,
    targets: [],
    tags: [subtopic, 'real-news', item.source],
    real_story_url: item.link,
    published: item.published,
    feed: item.feed,
  });
}

// ---- spread over the issues, oldest first ----
stories.sort((a, b) => (a.published ?? '').localeCompare(b.published ?? ''));
stories.forEach((s, i) => (s.day = Math.floor((i * MAX_ISSUES) / stories.length) + 1));

writeFileSync(
  STORIES_PATH,
  JSON.stringify(
    {
      built_at: new Date().toISOString(),
      model,
      note: 'Real news for the demo, built from public RSS headlines and summaries (NPR, BBC News, PBS NewsHour). Facts restate only the headline and summary; links go to the original coverage. "day" is the issue the story belongs to.',
      wire_sources: [
        { id: 'npr', name: 'NPR', fictional: false },
        { id: 'bbc', name: 'BBC News', fictional: false },
        { id: 'pbs', name: 'PBS NewsHour', fictional: false },
      ],
      stories,
    },
    null,
    1,
  ) + '\n',
);
const perIssue = Array.from({ length: MAX_ISSUES }, (_, i) => stories.filter((s) => s.day === i + 1).length);
const byCat: Record<string, number> = {};
for (const s of stories) byCat[s.category] = (byCat[s.category] ?? 0) + 1;
console.log(`\n${stories.length} stories built. Per issue: ${perIssue.join(', ')}`);
console.log('By category:', byCat);
console.log('Dropped:', dropped);
