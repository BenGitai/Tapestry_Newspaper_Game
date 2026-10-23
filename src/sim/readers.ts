// Readers: who lives where, what they like, and how well the paper fits them.
import type { Angle, CityWorld, District, ReaderGroup } from '../data/schemas.ts';
import { CIRCULATION, LEAN, READERS, RIVAL_SIM } from './balance.ts';
import type { Category, DistrictState, PaperSetup } from './types.ts';

const SIDES = { left: -1, center: 0, right: 1 } as const;

/**
 * How well your perceived lean fits a district, 0..1. Each lean bucket in the
 * district likes you less the further you are from it. Mirror-symmetric:
 * flipping both the district's mix and your lean gives the same fit.
 */
export function leanFit(district: Pick<District, 'lean_mix'>, perceivedLean: number): number {
  let fit = 0;
  for (const side of ['left', 'center', 'right'] as const) {
    fit += district.lean_mix[side] * (1 - 0.5 * Math.abs(perceivedLean - SIDES[side]));
  }
  return fit;
}

export function stanceLean(stance: PaperSetup['stance']): number {
  return LEAN.stance[stance];
}

/** Share of each category in the stated coverage split (sums to 1). */
export function coverageShares(coverage: PaperSetup['coverage']): Record<Category, number> {
  const total = Object.values(coverage).reduce((a, b) => a + b, 0) || 1;
  const out = {} as Record<Category, number>;
  for (const [k, v] of Object.entries(coverage)) out[k as Category] = v / total;
  return out;
}

/**
 * How well the stated coverage split matches what a district reads, 0..1.
 * 0.5 is an average match; heavy coverage of what locals care about scores higher.
 */
export function coverageAlignment(world: CityWorld, district: District, coverage: PaperSetup['coverage']): number {
  const shares = coverageShares(coverage);
  let score = 0;
  let best = 0;
  for (const g of world.reader_groups) {
    const mix = district.group_mix[g.id] ?? 0;
    let s = 0;
    for (const [cat, share] of Object.entries(shares)) s += share * (g.interests[cat as Category] ?? 0);
    score += mix * s;
    best += mix * Math.max(...Object.values(g.interests));
  }
  return best > 0 ? Math.max(0, Math.min(1, score / best)) : 0.5;
}

/** Reach: the most of a district's print readers you could hope to sell to. */
export function reach(world: CityWorld, district: District, state: DistrictState, coverage: PaperSetup['coverage']): number {
  const c = CIRCULATION;
  const r =
    c.baseReach +
    coverageAlignment(world, district, coverage) * c.coverageReach +
    Math.min(c.maxNewsstands, state.newsstands) * c.perNewsstand +
    (state.bureau ? c.bureauReach : 0);
  return Math.min(c.maxReach, r);
}

/** How much a reader group likes an angle, from its taste for hard news. */
export function angleTaste(group: Pick<ReaderGroup, 'hard_news_pref'>, angle: Angle): number {
  const h = group.hard_news_pref;
  if (angle === 'hard') return READERS.hardTaste.base + READERS.hardTaste.perPref * h;
  if (angle === 'puff') return READERS.puffTaste.base + READERS.puffTaste.perPref * h;
  return 1;
}

/** Starting district state: the origin's readers spread by population and how well your coverage fits. */
export function initialDistricts(world: CityWorld, setup: PaperSetup, startingReaders: number, trust: number): Record<string, DistrictState> {
  const weights = world.districts.map((d) => d.population_share * (0.5 + coverageAlignment(world, d, setup.coverage)));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, DistrictState> = {};
  world.districts.forEach((d, i) => {
    out[d.id] = {
      readers: Math.round((startingReaders * (weights[i] ?? 0)) / total),
      trust,
      newsstands: 0,
      bureau: false,
      rivalShare: Math.min(RIVAL_SIM.maxShare, world.rival.starting_share * (RIVAL_SIM.startStrengthBase + d.rival_strength)),
    };
  });
  return out;
}

export function totalReaders(districts: Record<string, DistrictState>): number {
  return Object.values(districts).reduce((a, d) => a + d.readers, 0);
}

/** Reader-weighted average trust (plain average if you have no readers yet). */
export function averageTrust(districts: Record<string, DistrictState>): number {
  const ds = Object.values(districts);
  const readers = totalReaders(districts);
  if (readers <= 0) return ds.reduce((a, d) => a + d.trust, 0) / Math.max(1, ds.length);
  return ds.reduce((a, d) => a + d.trust * d.readers, 0) / readers;
}

/** What a district most wants to read: its top categories by weighted interest. */
export function districtInterests(world: CityWorld, district: District): { category: Category; weight: number }[] {
  const sums = new Map<Category, number>();
  for (const g of world.reader_groups) {
    const mix = district.group_mix[g.id] ?? 0;
    for (const [cat, v] of Object.entries(g.interests)) sums.set(cat as Category, (sums.get(cat as Category) ?? 0) + mix * v);
  }
  return [...sums.entries()].map(([category, weight]) => ({ category, weight })).sort((a, b) => b.weight - a.weight);
}
