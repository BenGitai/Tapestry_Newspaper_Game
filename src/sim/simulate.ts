// Resolving a printed issue: who bought it, who trusts you, where your lean
// drifted, what the hidden scorecard lines turned out to be, what advertisers
// and the rival did, and what it cost.
import type { CityWorld, Story } from '../data/schemas.ts';
import type { StorySource } from '../data/StorySource.ts';
import {
  ADVERTISERS,
  AWARDS,
  CIRCULATION,
  EXTRA_PAGE_COST_PER_COPY,
  FIT_EFFECT,
  LEAN,
  MONEY,
  MORALE,
  MORALE_EVENTS,
  PAPER_STYLE,
  READERS,
  RIVAL_SIM,
  TRUST,
} from './balance.ts';
import { formatIssueDate, issueDate } from './calendar.ts';
import { activePages, adRevenue, fitOf, prominenceOf } from './layout.ts';
import { writeLetters, type LetterCue } from './letters.ts';
import { articleForStory, freshness, wireForIssue } from './newsroom.ts';
import { angleTaste, averageTrust, leanFit, reach, stanceLean, totalReaders } from './readers.ts';
import { rivalFrontPage } from './rival.ts';
import { rng, seedFor } from './rng.ts';
import { scorecard, type Scorecard } from './scorecard.ts';
import { currentAttributes, payroll, reporterById } from './staff.ts';
import type { Article, DistrictResult, GameState, IssueResult, PageId, RevealedOutcome, StoryBlock } from './types.ts';

export interface PrintedPiece {
  article: Article;
  story: Story;
  block: StoryBlock;
  page: PageId;
  prominence: number;
  fit: number;
  card: Scorecard;
  stale: boolean;
}

/** Everything that ran in this issue, with the numbers the simulation needs. */
export function printedPieces(game: GameState, world: CityWorld, stories: StorySource): PrintedPiece[] {
  const out: PrintedPiece[] = [];
  for (const page of activePages(game.draft)) {
    for (const b of game.draft.pages[page]) {
      if (b.kind !== 'story') continue;
      const article = articleForStory(game, b.storyId);
      const story = stories.storyById(b.storyId);
      if (!article || !story) continue;
      const f = freshness(article, game, stories);
      const member = game.staff.find((m) => m.reporterId === article.reporterId);
      out.push({
        article,
        story,
        block: b,
        page,
        prominence: prominenceOf(page, b),
        fit: FIT_EFFECT[fitOf({ base_column_inches: article.inches }, b).status],
        card: scorecard(article, story, world, member, f.value),
        stale: article.issueFiled < game.issueNumber,
      });
    }
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function inDistrict(story: Story, districtId: string): boolean {
  return story.districts.length === 0 || story.districts.includes(districtId);
}

/** The lean signal one printed piece sends (negative = reads left, positive = reads right). */
export function leanSignal(piece: Pick<PrintedPiece, 'prominence' | 'story' | 'article'>, charge: number): number {
  return piece.prominence * piece.story.hard_hitting_lean * LEAN.angle[piece.article.angle] * (LEAN.chargeBase + charge / 20);
}

export function resolveIssue(game: GameState, world: CityWorld, stories: StorySource): { game: GameState; result: IssueResult } {
  const issue = game.issueNumber;
  const pieces = printedPieces(game, world, stories);
  const style = PAPER_STYLE[game.setup.style];
  const events: string[] = [];
  const cues: LetterCue[] = [];
  const origin = world.origins[game.setup.origin];

  // ---- hidden scorecard lines get rolled ----
  const revealed: RevealedOutcome[] = pieces.map((p) => {
    const r = rng(seedFor(game.seed, issue, p.article.id));
    const correction = r() < p.card.hidden.correctionRisk;
    const award = r() < p.card.hidden.awardChance * (0.5 + 0.5 * p.prominence);
    const swing = p.card.shown.sensational ? (r() < 0.5 ? 'up' : 'down') : undefined;
    return { articleId: p.article.id, storyId: p.story.id, reporterId: p.article.reporterId, correction, award, sensationalSwing: swing };
  });
  const outcome = (id: string) => revealed.find((o) => o.articleId === id);

  // ---- rival ----
  const wire = wireForIssue(game, stories);
  const rivalFront = rivalFrontPage(wire);
  const placed = new Set(pieces.map((p) => p.story.id));
  const scoops = pieces.filter((p) => p.page === 'front' && p.block.tier !== 'brief' && !rivalFront.includes(p.story.id)).map((p) => p.story.id);
  const missed = rivalFront.filter((id) => !placed.has(id) && (stories.storyById(id)?.importance ?? 0) >= 4);
  const scoopSet = new Set(scoops);

  // ---- readers and trust, district by district ----
  const districts = { ...game.districts };
  const districtResults: Record<string, DistrictResult> = {};
  for (const d of world.districts) {
    const st = { ...game.districts[d.id]! };
    let sat = 0;
    for (const g of world.reader_groups) {
      const mix = d.group_mix[g.id] ?? 0;
      if (!mix) continue;
      let score = 0;
      for (const p of pieces) {
        const o = outcome(p.article.id);
        let s = p.prominence * p.fit * (g.interests[p.story.category] ?? 0) * angleTaste(g, p.article.angle);
        s *= READERS.readershipFactor.min + (READERS.readershipFactor.max - READERS.readershipFactor.min) * p.card.shown.readership;
        if (p.story.districts.includes(d.id)) s *= READERS.localBoost * (st.bureau ? READERS.bureauLocalBoost : 1) * ('localBonus' in style ? style.localBonus : 1);
        if (p.article.angle === 'puff' && p.story.importance >= 4) s /= style.puffPenalty;
        if (o?.sensationalSwing === 'up') s *= READERS.sensationalUp * style.sensationalSales;
        if (o?.sensationalSwing === 'down') s *= READERS.sensationalDown;
        if (p.stale) s *= READERS.staleSalesFactor;
        score += s;
      }
      sat += mix * Math.min(READERS.satisfactionMax, score / READERS.satisfactionBaseline);
    }

    const fit = leanFit(d, game.perceivedLean);
    const pool = game.printPool * d.population_share;
    const appeal = sat * (0.5 + fit) * (0.6 + (0.4 * st.trust) / 100);
    const scooped = pieces.some((p) => scoopSet.has(p.story.id) && p.story.districts.includes(d.id));
    const target = pool * reach(world, d, st, game.setup.coverage) * appeal * (1 - st.rivalShare * CIRCULATION.rivalCompetition) * (scooped ? 1 + CIRCULATION.scoopBonus : 1);
    let delta = (target - st.readers) * CIRCULATION.adjustRate;
    if (delta < 0) delta *= 1 - (CIRCULATION.trustCushion * st.trust) / 100;
    let readers = Math.max(0, st.readers + delta);
    if (origin.readership_decline_per_issue) readers *= 1 - origin.readership_decline_per_issue;

    let trustDelta = 0;
    for (const p of pieces) {
      const here = inDistrict(p.story, d.id) ? 1 : TRUST.elsewhere;
      trustDelta += p.card.shown.trust * p.prominence * p.fit * TRUST.perArticle * style.trustGain * here;
      const o = outcome(p.article.id);
      if (o?.correction && inDistrict(p.story, d.id)) trustDelta += TRUST.correction;
      if (o?.award) trustDelta += TRUST.awardEverywhere;
    }
    if (fit < TRUST.leanFitFloor) trustDelta -= TRUST.leanMisfitPenalty;
    const trust = clamp(st.trust + trustDelta, 0, 100);

    districts[d.id] = { ...st, readers: Math.round(readers), trust };
    districtResults[d.id] = {
      readers: Math.round(readers),
      readersChange: Math.round(readers) - st.readers,
      trust,
      trustChange: trust - st.trust,
      satisfaction: sat,
    };
  }

  // ---- perceived lean ----
  let signal = 0;
  for (const p of pieces) {
    const r = p.article.reporterId ? reporterById(world, p.article.reporterId) : undefined;
    const member = game.staff.find((m) => m.reporterId === p.article.reporterId);
    const charge = r ? currentAttributes(r, member).charge : 5;
    signal += leanSignal(p, charge);
  }
  for (const id of missed) signal -= (stories.storyById(id)?.hard_hitting_lean ?? 0) * LEAN.omission;
  const perceivedLean = clamp(game.perceivedLean + signal * LEAN.rate, -1, 1);

  // ---- advertisers ----
  const advertisers = { ...game.advertisers };
  const hit = new Map<string, number>();
  for (const p of pieces) {
    if (p.article.angle !== 'hard') continue;
    for (const t of p.story.targets) hit.set(t, (hit.get(t) ?? 0) + p.prominence);
  }
  for (const e of world.entities) {
    const a = { ...(advertisers[e.id] ?? { relationship: ADVERTISERS.start, pulledThrough: 0 }) };
    const h = hit.get(e.id) ?? 0;
    if (h > 0) {
      a.relationship = clamp(a.relationship - ADVERTISERS.hitPenalty * h, 0, 100);
      if (a.relationship < ADVERTISERS.pullBelow && a.pulledThrough < issue) {
        a.pulledThrough = issue + ADVERTISERS.pullIssues;
        events.push(`${e.name.replace(/\s*\(fictional\)/, '')} is pulling its ads for ${ADVERTISERS.pullIssues} issues after your coverage.`);
      } else {
        events.push(`${e.name.replace(/\s*\(fictional\)/, '')} is unhappy with your coverage.`);
      }
    } else {
      a.relationship = clamp(a.relationship + ADVERTISERS.recovery, 0, 100);
    }
    advertisers[e.id] = a;
  }

  // ---- revealed outcomes, morale, events ----
  let staff = game.staff;
  let awards = game.awards;
  let corrections = game.corrections;
  for (const o of revealed) {
    const p = pieces.find((x) => x.article.id === o.articleId)!;
    const headline = p.story.wire_headline;
    if (o.correction) {
      corrections++;
      events.push(`Correction: “${headline}” got a fact wrong. Trust drops where it ran.`);
      cues.push({ kind: 'correction', headline, district: p.story.districts[0] ?? world.districts[0]!.id });
    }
    if (o.award) {
      awards++;
      events.push(`Award: “${headline}” wins a regional press award ($${MONEY.awardPrize}).`);
    }
    if (o.sensationalSwing === 'up') events.push(`“${headline}” is the talk of the town. Copies fly off the stands.`);
    if (o.sensationalSwing === 'down') events.push(`“${headline}” turned readers off. Some cancelled.`);
    if (p.stale) events.push(`Online outlets had “${headline}” before you did.`);
    if (o.reporterId && (o.correction || o.award)) {
      const change = (o.award ? AWARDS.moraleBonus : 0) + (o.correction ? MORALE_EVENTS.correction : 0);
      staff = staff.map((m) => (m.reporterId === o.reporterId ? { ...m, morale: clamp(m.morale + change, MORALE.min, MORALE.max) } : m));
    }
  }
  for (const id of scoops) events.push(`Scoop: the Herald didn’t front “${stories.storyById(id)?.wire_headline}”.`);
  for (const id of missed) events.push(`The Herald led with “${stories.storyById(id)?.wire_headline}”. You didn’t run it.`);

  // ---- rival share drifts ----
  for (const d of world.districts) {
    const st = districts[d.id]!;
    let shift = 0;
    for (const id of missed) if (inDistrict(stories.storyById(id)!, d.id)) shift += RIVAL_SIM.shift;
    for (const id of scoops) if (stories.storyById(id)!.districts.includes(d.id)) shift -= RIVAL_SIM.shift;
    districts[d.id] = { ...st, rivalShare: clamp(st.rivalShare + shift, RIVAL_SIM.minShare, RIVAL_SIM.maxShare) };
  }

  // ---- money ----
  const copies = totalReaders(districts);
  const extraPages = game.draft.extraPages.length;
  const revenue = {
    sales: Math.round(copies * world.pricing.cover_price),
    ads: adRevenue(game.draft, world.entities),
    prizes: revealed.filter((o) => o.award).length * MONEY.awardPrize,
  };
  const costs = {
    printing: Math.round(copies * (world.pricing.print_cost_per_copy * origin.cost_multiplier + extraPages * EXTRA_PAGE_COST_PER_COPY)),
    distribution:
      world.districts.filter((d) => districts[d.id]!.readers >= MONEY.distributionMinReaders || districts[d.id]!.newsstands > 0).length *
        world.pricing.distribution_cost_per_district_per_issue +
      Math.round(copies * MONEY.deliveryPerCopy),
    payroll: payroll(world, game.staff.filter((m) => m.hiredIssue <= issue)),
    overhead: Math.round(MONEY.overheadPerIssue * origin.cost_multiplier),
    wire: pieces.filter((p) => p.article.reporterId === null).length * MONEY.wireCopyFee,
    debt: Math.round(game.debt * (MONEY.debtInterest + MONEY.debtRepayment)),
  };
  const profit = revenue.sales + revenue.ads + revenue.prizes - Object.values(costs).reduce((a, b) => a + b, 0);
  const cash = game.cash + profit;
  const debt = Math.max(0, game.debt - Math.round(game.debt * MONEY.debtRepayment));

  // ---- what got published, by category ----
  const publishedInches = { ...game.publishedInches };
  for (const p of pieces) publishedInches[p.story.category] = (publishedInches[p.story.category] ?? 0) + p.article.inches;

  // ---- letters ----
  const best = [...pieces].sort((a, b) => b.card.shown.readership * b.prominence - a.card.shown.readership * a.prominence)[0];
  if (best) cues.push({ kind: 'loved_story', headline: best.story.wire_headline, district: best.story.districts[0] ?? 'center_city' });
  for (const p of pieces) {
    if (p.article.angle === 'puff' && p.story.importance >= 4) cues.push({ kind: 'too_soft', headline: p.story.wire_headline, district: p.story.districts[0] ?? 'center_city' });
    if (p.card.shown.sensational && p.story.sensitivity === 'high') cues.push({ kind: 'sensational', headline: p.story.wire_headline, district: p.story.districts[0] ?? 'center_city' });
  }
  for (const id of missed) cues.push({ kind: 'missed', headline: stories.storyById(id)?.wire_headline ?? '', district: stories.storyById(id)?.districts[0] ?? 'center_city' });
  const ranked = Object.entries(districtResults).sort((a, b) => a[1].satisfaction - b[1].satisfaction);
  const worst = ranked[0];
  const happiest = ranked[ranked.length - 1];
  if (worst && worst[1].satisfaction < 0.5) cues.push({ kind: pieces.length < 3 ? 'thin_issue' : 'local_ignored', district: worst[0] });
  if (happiest && happiest[1].satisfaction > 1.4) cues.push({ kind: 'great_issue', district: happiest[0] });
  const drift = perceivedLean - stanceLean(game.setup.stance);
  if (Math.abs(drift) > 0.15) cues.push({ kind: 'lean_drift', direction: drift < 0 ? 'left' : 'right', district: ranked[Math.floor(ranked.length / 2)]?.[0] ?? 'center_city' });
  const letters = writeLetters(world, cues, seedFor(game.seed, issue, 'letters'));

  const dateLabel = formatIssueDate(issueDate(game.setup.frequency, issue, stories.dayCount()));
  const previousCopies = totalReaders(game.districts);
  const result: IssueResult = {
    issueNumber: issue,
    dateLabel,
    copies,
    copiesChange: copies - previousCopies,
    districts: districtResults,
    revenue,
    costs,
    profit,
    cashAfter: cash,
    leanBefore: game.perceivedLean,
    leanAfter: perceivedLean,
    trustBefore: averageTrust(game.districts),
    trustAfter: averageTrust(districts),
    revealed,
    events,
    letters,
    rivalFront,
    scoops,
    missed,
  };

  const next: GameState = {
    ...game,
    districts,
    perceivedLean,
    advertisers,
    staff,
    awards,
    corrections,
    cash,
    debt,
    publishedInches,
    printPool: Math.round(game.printPool * (1 - CIRCULATION.printPoolDecline)),
    results: [...game.results, result],
    endReason: cash < MONEY.bankruptAt ? 'bankrupt' : game.endReason,
  };
  if (next.endReason === 'bankrupt') events.push('The bank has stopped extending credit. The presses stop after this issue.');
  return { game: next, result };
}

/** Are this advertiser's ads available for the current issue? */
export function adsAvailable(game: Pick<GameState, 'advertisers' | 'issueNumber'>, adId: string): boolean {
  return (game.advertisers[adId]?.pulledThrough ?? 0) < game.issueNumber;
}

