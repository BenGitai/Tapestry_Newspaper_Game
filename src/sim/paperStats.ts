// "Stated vs actual": what the paper said it would be on Form 1-A, against what
// it has actually printed.
import type { CityWorld } from '../data/schemas.ts';
import { CIRCULATION } from './balance.ts';
import { coverageShares, stanceLean } from './readers.ts';
import type { Category, GameState } from './types.ts';

export interface PaperReport {
  coverage: { category: Category; stated: number; actual: number }[];
  statedLean: number;
  perceivedLean: number;
  /** Shares of published articles, 0..1. */
  angles: { puff: number; straight: number; hard: number };
  sensational: number;
  local: number;
  published: number;
}

const CATS: Category[] = ['politics', 'economy', 'social', 'sports', 'culture', 'science', 'world'];

export function paperReport(game: GameState): PaperReport {
  const stated = coverageShares(game.setup.coverage);
  const totalInches = CATS.reduce((a, c) => a + (game.publishedInches[c] ?? 0), 0);
  const published = game.articles.filter((a) => a.status === 'published');
  const n = published.length || 1;
  const sensationalIds = new Set(game.results.flatMap((r) => r.revealed.filter((o) => o.sensationalSwing).map((o) => o.articleId)));
  return {
    coverage: CATS.map((c) => ({ category: c, stated: stated[c] ?? 0, actual: totalInches ? (game.publishedInches[c] ?? 0) / totalInches : 0 })),
    statedLean: stanceLean(game.setup.stance),
    perceivedLean: game.perceivedLean,
    angles: {
      puff: published.filter((a) => a.angle === 'puff').length / n,
      straight: published.filter((a) => a.angle === 'straight').length / n,
      hard: published.filter((a) => a.angle === 'hard').length / n,
    },
    sensational: published.filter((a) => sensationalIds.has(a.id)).length / n,
    local: published.filter((a) => a.onPatch).length / n,
    published: published.length,
  };
}

/** Plain-language lean label. Symmetric wording on both sides. */
export function leanLabel(v: number): string {
  const a = Math.abs(v);
  const side = v < 0 ? 'left' : 'right';
  if (a < 0.1) return 'Center';
  if (a < 0.35) return `Center-${side}`;
  if (a < 0.7) return side === 'left' ? 'Left' : 'Right';
  return side === 'left' ? 'Far left' : 'Far right';
}

// ---------------------------------------------------------------------------
// District actions
// ---------------------------------------------------------------------------

export type DistrictEdit = { ok: true; game: GameState } | { ok: false; reason: string };

export function addNewsstand(game: GameState, world: CityWorld, districtId: string): DistrictEdit {
  const st = game.districts[districtId];
  if (!st) return { ok: false, reason: 'Unknown district' };
  if (st.newsstands >= CIRCULATION.maxNewsstands) return { ok: false, reason: `At most ${CIRCULATION.maxNewsstands} newsstands per district` };
  const cost = world.pricing.newsstand_cost;
  if (game.cash < cost) return { ok: false, reason: `A newsstand costs $${cost}` };
  return { ok: true, game: { ...game, cash: game.cash - cost, districts: { ...game.districts, [districtId]: { ...st, newsstands: st.newsstands + 1 } } } };
}

export function openBureau(game: GameState, world: CityWorld, districtId: string): DistrictEdit {
  const st = game.districts[districtId];
  if (!st) return { ok: false, reason: 'Unknown district' };
  if (st.bureau) return { ok: false, reason: 'You already have a bureau there' };
  const cost = world.pricing.bureau_cost;
  if (game.cash < cost) return { ok: false, reason: `A bureau costs $${cost}` };
  return { ok: true, game: { ...game, cash: game.cash - cost, districts: { ...game.districts, [districtId]: { ...st, bureau: true } } } };
}
