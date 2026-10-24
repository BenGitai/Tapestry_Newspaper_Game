// npm run summarize: pre-generate article text for the demo's fixed set of stories
// and write the committed cache (data/generated/summaries.cache.json), then print
// a cost report. Needs ANTHROPIC_API_KEY in .env, except with --dry-run.
//
//   npm run summarize -- --dry-run          estimate only, no API calls
//   npm run summarize -- --story d1-fares   only this story
//   npm run summarize -- --limit 20         stop after 20 new articles
//   npm run summarize -- --force            regenerate even if cached
//
// Only articles that pass the fact check are written; the game uses the template
// for the rest. Safe to stop and re-run: it saves as it goes and skips what is cached.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadGameData } from '../src/data/worldData.ts';
import { cacheKey, emptyCache, parseCache, type CacheFile } from '../src/summarizer/cache.ts';
import { summarizerModel } from '../src/summarizer/config.ts';
import { callCost, estimateInputTokens, estimateOutputTokens, extrapolate, priceFor, sumUsage, type Usage } from '../src/summarizer/cost.ts';
import { buildPrompt } from '../src/summarizer/prompt.ts';
import { plannedRequests, TIER_LIST } from '../src/summarizer/plan.ts';

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    story: { type: 'string' },
    force: { type: 'boolean', default: false },
    limit: { type: 'string' },
    concurrency: { type: 'string', default: '6' },
    verbose: { type: 'boolean', default: false },
  },
});

const CACHE_PATH = join(import.meta.dirname, '..', 'data', 'generated', 'summaries.cache.json');
const model = summarizerModel(process.env);
const { world, stories } = loadGameData();
const money = (v: number) => `$${v.toFixed(v < 0.01 ? 5 : v < 1 ? 4 : 2)}`;
const pad = (v: string | number, n: number) => String(v).padStart(n);

function loadCache(): CacheFile {
  try {
    return parseCache(JSON.parse(readFileSync(CACHE_PATH, 'utf8')));
  } catch {
    return emptyCache();
  }
}

function saveCache(cache: CacheFile): void {
  const entries = Object.fromEntries(Object.entries(cache.entries).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(CACHE_PATH, JSON.stringify({ ...cache, generated_at: new Date().toISOString(), entries }, null, 1) + '\n');
}

const cache = loadCache();
let plan = plannedRequests(stories, world);
if (args.story) {
  plan = plan.filter((p) => p.story.id === args.story);
  if (plan.length === 0) {
    console.error(`No planned articles for story "${args.story}". Check the id (see data/stories.philly.json, or g<day>-<n> for generated news).`);
    process.exit(1);
  }
}
const todo = plan.filter((p) => args.force || !cache.entries[p.key]);
const limit = args.limit ? Number(args.limit) : Infinity;
const work = todo.slice(0, limit);

const { price, known } = priceFor(model);
console.log(`Model: ${model}${known ? '' : ' (price unknown, using Haiku 5.5 rates for estimates)'}  ·  $${price.inputPerM}/M in, $${price.outputPerM}/M out`);
console.log(`Planned: ${plan.length} articles for ${new Set(plan.map((p) => p.story.id)).size} stories. Cached: ${plan.length - todo.length}. To write: ${work.length}${work.length < todo.length ? ` (limited from ${todo.length})` : ''}.`);

function promptFor(p: (typeof plan)[number]) {
  const j = p.req.journalistId ? world.staff_pool.find((r) => r.id === p.req.journalistId) : undefined;
  return buildPrompt({ story: p.story, angle: p.req.angle, tier: p.req.tier, ...(j ? { journalist: { name: j.name, voice: j.voice } } : {}) });
}

function report(calls: Usage[], label: string): void {
  const total = sumUsage(calls);
  // Each call is priced on its own prompt length, not on the run total.
  const cost = calls.reduce((a, u) => a + callCost(model, u), 0);
  const avg = calls.length ? cost / calls.length : 0;
  console.log(`\n${label}`);
  console.log(`  calls ${calls.length}  ·  input ${total.inputTokens.toLocaleString()} tokens  ·  output ${total.outputTokens.toLocaleString()} tokens  ·  cost ${money(cost)}  ·  avg ${money(avg)}/article`);
  const one = extrapolate(avg, 200, 30, 1);
  const all = extrapolate(avg, 200, 30, 9);
  console.log(`  Extrapolation, ${one.storiesPerDay} stories/day for ${one.days} days at this average:`);
  console.log(`    one article per story (${one.calls.toLocaleString()} calls): ${money(one.cost)}`);
  console.log(`    every angle x length (${all.calls.toLocaleString()} calls): ${money(all.cost)}`);
}

if (args['dry-run']) {
  // Estimates only: input from the real prompt text, output from the tier's word target.
  const calls = work.map((p) => ({ inputTokens: estimateInputTokens(promptFor(p)), outputTokens: estimateOutputTokens(p.req.tier) }));
  if (args.verbose) work.forEach((p, i) => console.log(`  ${p.key.padEnd(48)} in ~${pad(calls[i]!.inputTokens, 5)}  out ~${pad(calls[i]!.outputTokens, 4)}`));
  console.log('\nDRY RUN: nothing was sent and the cache was not changed. Token counts are estimates.');
  for (const tier of TIER_LIST) {
    const sub = work.map((p, i) => ({ p, u: calls[i]! })).filter(({ p }) => p.req.tier === tier);
    if (sub.length) console.log(`  ${tier.padEnd(9)} ${pad(sub.length, 5)} articles  in ~${pad(Math.round(sumUsage(sub.map((s) => s.u)).inputTokens / sub.length), 4)}  out ~${pad(Math.round(sumUsage(sub.map((s) => s.u)).outputTokens / sub.length), 4)} tokens each`);
  }
  report(calls, 'Estimated cost to fill the cache');
  console.log('\nThe estimate covers only what is still missing from the cache. Real runs also retry articles that fail the fact check once, so allow about 5-10% more.');
  process.exit(0);
}

if (work.length === 0) {
  console.log('Nothing to do. Use --force to regenerate.');
  process.exit(0);
}

// The SDK is imported here (not at the top) so a dry run never needs a key.
const { generateArticle, makeClient } = await import('../server/generate.ts');
let client: ReturnType<typeof makeClient>;
try {
  client = makeClient();
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  console.error('Use --dry-run to estimate the cost without a key.');
  process.exit(1);
}
const calls: Usage[] = [];
const failures: { key: string; why: string }[] = [];
let done = 0;
let sinceSave = 0;

async function one(p: (typeof plan)[number]): Promise<void> {
  const j = p.req.journalistId ? world.staff_pool.find((r) => r.id === p.req.journalistId) : undefined;
  let r;
  try {
    r = await generateArticle(client, model, { story: p.story, angle: p.req.angle, tier: p.req.tier, ...(j ? { journalist: { name: j.name, voice: j.voice } } : {}) }, world);
  } catch (e) {
    failures.push({ key: p.key, why: `API error: ${e instanceof Error ? e.message : String(e)}` });
    return;
  }
  calls.push(r.usage);
  const ok = r.article !== null && r.check?.passed === true;
  console.log(`[${pad(++done, 4)}/${work.length}] ${p.key.padEnd(48)} in ${pad(r.usage.inputTokens, 5)}  out ${pad(r.usage.outputTokens, 4)}  ${money(r.cost)}  ${ok ? 'ok' : 'LEFT OUT'}${r.attempts > 1 ? ' (retried)' : ''}`);
  if (ok && r.article) {
    cache.entries[cacheKey(p.req.storyId, p.req.journalistId, p.req.angle, p.req.tier)] = { ...r.article, model, input_tokens: r.usage.inputTokens, output_tokens: r.usage.outputTokens };
    if (++sinceSave >= 25) {
      saveCache(cache);
      sinceSave = 0;
    }
  } else {
    const why = r.failure ?? [...(r.check?.flags.map((f) => `${f.kind} "${f.text}" in ${f.field}`) ?? []), ...(r.check?.problems ?? [])].join('; ');
    failures.push({ key: p.key, why });
  }
}

const queue = [...work];
const workers = Array.from({ length: Math.max(1, Number(args.concurrency)) }, async () => {
  for (let p = queue.shift(); p; p = queue.shift()) await one(p);
});
await Promise.all(workers);
saveCache(cache);

report(calls, 'Cost report');
console.log(`\nCache now holds ${Object.keys(cache.entries).length} of ${plan.length} planned articles.`);
if (failures.length) {
  console.log(`\n${failures.length} articles were left out (the game uses templates for them). Re-run to try them again:`);
  for (const f of failures) console.log(`  ${f.key}: ${f.why}`);
}
