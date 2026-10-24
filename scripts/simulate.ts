// npm run simulate: play the demo headlessly with fixed strategies and print how
// each one ends up. Use it to check that the balance numbers create trade-offs.
import { loadGameData } from '../src/data/worldData.ts';
import { findFreeSpot, newAdBlock, newStoryBlock, putBlock, setExtraPage } from '../src/sim/layout.ts';
import { addNewsstand } from '../src/sim/paperStats.ts';
import { createGame, defaultSetup, issueCount, suggestStartingStaff } from '../src/sim/newGame.ts';
import { backlog, commission, updateArticle, wireForIssue } from '../src/sim/newsroom.ts';
import { leanLabel } from '../src/sim/paperStats.ts';
import { averageTrust, totalReaders } from '../src/sim/readers.ts';
import { adsAvailable, resolveIssue } from '../src/sim/simulate.ts';
import { advanceIssue } from '../src/sim/newGame.ts';
import { defaultAssignment, hire, payroll } from '../src/sim/staff.ts';
import { CITY_PATCH } from '../src/sim/types.ts';
import { promote, setDuties } from '../src/sim/desks.ts';
import type { Angle, GameState, PageId, PaperSetup, Tier } from '../src/sim/types.ts';

const { world, stories } = loadGameData();

interface Strategy {
  name: string;
  angle?: Angle;
  /** How many ads to sell per issue. */
  ads: number;
  /** Commission every uncovered story as wire copy. */
  wireCopy: boolean;
  print: boolean;
  setup?: Partial<PaperSetup>;
  /** Hire whenever cash allows, and promote desk heads with every duty delegated. */
  grow?: boolean;
}

const STRATEGIES: Strategy[] = [
  { name: 'Reporters as filed', ads: 1, wireCopy: false, print: true },
  { name: 'Everything wire too', ads: 1, wireCopy: true, print: true },
  { name: 'All hard-hitting', angle: 'hard', ads: 1, wireCopy: true, print: true },
  { name: 'All puff', angle: 'puff', ads: 1, wireCopy: true, print: true },
  { name: 'Ad heavy', ads: 4, wireCopy: true, print: true },
  { name: 'No ads', ads: 0, wireCopy: true, print: true },
  { name: 'Tabloid, hard', angle: 'hard', ads: 1, wireCopy: true, print: true, setup: { style: 'tabloid' } },
  { name: 'Left stance, hard', angle: 'hard', ads: 1, wireCopy: true, print: true, setup: { stance: 'left' } },
  { name: 'Right stance, hard', angle: 'hard', ads: 1, wireCopy: true, print: true, setup: { stance: 'right' } },
  { name: 'Print nothing', ads: 0, wireCopy: false, print: false },
  { name: 'Grow + desk heads', ads: 2, wireCopy: true, print: true, grow: true },
];

function makeUpPaper(game: GameState, s: Strategy): GameState {
  let g = game;
  if (s.wireCopy) {
    for (const story of wireForIssue(g, stories)) {
      const r = commission(g, world, stories, story.id, null);
      if (r.ok) g = r.game;
    }
  }
  if (!s.print) return g;
  // Most important first: lead, then secondaries, then briefs, front page then A2.
  const pile = backlog(g).sort((a, b) => (stories.storyById(b.storyId)?.importance ?? 0) - (stories.storyById(a.storyId)?.importance ?? 0));
  pile.forEach((a, i) => {
    const story = stories.storyById(a.storyId)!;
    const angle = s.angle && !(s.angle === 'puff' && story.sensitivity === 'high') && a.reporterId ? s.angle : a.angle;
    g = updateArticle(g, a.id, { selected: true, angle });
    const tier: Tier = i === 0 ? 'lead' : i < 6 ? 'secondary' : 'brief';
    const sized = { ...story, base_column_inches: a.inches };
    // Growing papers also fill every inside page they've unlocked.
    const pages = s.grow ? (['front', 'a2', ...g.unlockedPages] as PageId[]) : (['front', 'a2'] as const);
    for (const page of pages) {
      if (page !== 'front' && page !== 'a2' && !g.draft.extraPages.includes(page)) g = { ...g, draft: setExtraPage(g.draft, page, true) };
      const block = newStoryBlock(sized, tier, { col: 0, row: 0 });
      const spot = findFreeSpot(g.draft, page, block);
      if (!spot) continue;
      const r = putBlock(g.draft, page, { ...block, ...spot });
      if (r.ok) {
        g = { ...g, draft: r.draft };
        break;
      }
    }
  });
  let sold = 0;
  for (const e of [...world.entities].sort((a, b) => b.ad_revenue_per_issue - a.ad_revenue_per_issue)) {
    if (sold >= s.ads || !adsAvailable(g, e.id)) continue;
    const block = newAdBlock(e.id, { col: 0, row: 0 });
    const spot = findFreeSpot(g.draft, 'a2', block) ?? findFreeSpot(g.draft, 'front', block);
    if (!spot) continue;
    const r = putBlock(g.draft, findFreeSpot(g.draft, 'a2', block) ? 'a2' : 'front', { ...block, ...spot });
    if (r.ok) {
      g = { ...g, draft: r.draft };
      sold++;
    }
  }
  return g;
}

function play(s: Strategy, origin: PaperSetup['origin']): GameState {
  const setup: PaperSetup = { ...defaultSetup(), origin, ...s.setup };
  // A sensible player splits the staff: half work the national wire, half dig up city news.
  const hires = suggestStartingStaff(world, setup).map((r, i) => ({ reporterId: r.id, assignment: { ...defaultAssignment(world, r), ...(i % 2 === 0 ? { patch: CITY_PATCH } : {}) } }));
  let g = createGame(setup, world, stories, hires, 12345);
  const issues = issueCount(setup.frequency, stories.dayCount());
  for (let i = 0; i < issues; i++) {
    g = resolveIssue(makeUpPaper(g, s), world, stories).game;
    if (g.endReason) break;
    if (s.grow) g = growNewsroom(g);
    if (i < issues - 1) g = advanceIssue(g, world, stories);
  }
  return g;
}

/** Hire the best-value candidate while cash stays above a cushion, then promote heads. */
function growNewsroom(game: GameState): GameState {
  let g = game;
  const cushion = 2500;
  for (;;) {
    const market = world.staff_pool.filter((r) => !g.staff.some((m) => m.reporterId === r.id));
    const value = (r: (typeof market)[number]) => Object.values(r.attributes).reduce((a, b) => a + b, 0) / r.salary_per_issue;
    const best = [...market].sort((a, b) => value(b) - value(a))[0];
    if (!best || g.cash - best.salary_per_issue * 2 < cushion + payroll(world, g.staff) * 2) break;
    const h = hire(g, world, best.id, 60);
    if (!h.ok) break;
    g = h.game;
  }
  // Newsstands where the paper sells best, keeping a cushion.
  for (const d of [...world.districts].sort((a, b) => (g.districts[b.id]?.readers ?? 0) - (g.districts[a.id]?.readers ?? 0))) {
    if (g.cash < cushion + world.pricing.newsstand_cost * 2) break;
    const n = addNewsstand(g, world, d.id);
    if (n.ok) g = n.game;
  }
  for (const m of g.staff) {
    const p = promote(g, world, m.reporterId);
    if (p.ok) g = setDuties(p.game, m.reporterId, { filter: false, fix: true, upgrade: true, runDesk: true });
  }
  return g;
}

const pad = (v: string | number, n: number) => String(v).padStart(n);
for (const origin of ['founded', 'inherited', 'bought'] as const) {
  console.log(`\n=== Origin: ${world.origins[origin].name} (start ${world.origins[origin].starting_readers} readers, $${world.origins[origin].cash}) ===`);
  console.log(`${'strategy'.padEnd(22)} ${pad('readers', 8)} ${pad('cash', 8)} ${pad('trust', 6)} ${pad('awards', 7)} ${pad('corr', 5)} ${pad('staff', 6)} ${pad('pages', 6)}  seen as`);
  for (const s of STRATEGIES) {
    const g = play(s, origin);
    console.log(
      `${s.name.padEnd(22)} ${pad(totalReaders(g.districts), 8)} ${pad(g.cash, 8)} ${pad(Math.round(averageTrust(g.districts)), 6)} ${pad(g.awards, 7)} ${pad(g.corrections, 5)} ${pad(g.staff.length, 6)} ${pad(2 + g.unlockedPages.length, 6)}  ${leanLabel(g.perceivedLean)}${g.endReason ? ' (bankrupt)' : ''}`,
    );
  }
}
