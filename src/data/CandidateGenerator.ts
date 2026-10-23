// AI-CONTENT-REVIEW: extra job candidates for the demo's hiring market. The name
// lists and voice lines below were written by an AI model as placeholders
// (approved for the demo only). All people are invented.
//
// The hand-written staff pool has 18 reporters; these fill the market so a
// late-game newsroom can grow past 20. Deterministic: same candidates every game.
import type { Attributes, CityWorld, Desk, Reporter, SubtopicMap } from './schemas.ts';

const FIRST = ['Abigail', 'Bashir', 'Celeste', 'Dmitri', 'Esperanza', 'Farid', 'Georgia', 'Hollis', 'Imani', 'Joaquin', 'Keiko', 'Lorenzo', 'Maeve', 'Nikolai', 'Odessa', 'Percy', 'Rafaela', 'Silas', 'Tamsin', 'Umberto', 'Vivian', 'Wesley', 'Yara', 'Zora'];
const LAST = ['Ashworth', 'Brennan', 'Cavanaugh', 'Delacroix', 'Esposito', 'Fenwick', 'Gutierrez', 'Halloran', 'Iwasaki', 'Jablonski', 'Kowalski', 'Lindgren', 'Mbatha', 'Novak', 'Okonjo', 'Petrakis', 'Quinlan', 'Rosario', 'Sorensen', 'Thibodeaux', 'Ulrich', 'Vasquez', 'Whitaker', 'Yilmaz'];

const VOICES = [
  'Steady and reliable. Gets the facts in the right order.',
  'Restless and curious. Always has three more questions.',
  'Plain-spoken. Writes the way people talk on the stoop.',
  'Careful and methodical. Never rushes a number.',
  'Punchy. Short paragraphs, strong verbs.',
  'Warm and observant. Good with small human details.',
  'Wry. Finds the absurd in the official.',
  'Earnest. Believes every story matters to someone.',
  'Fast and scrappy. First to the scene, last to leave.',
  'Quietly skeptical. Reads the fine print twice.',
];

const DESK_CATEGORY: Record<Desk, keyof SubtopicMap> = {
  city_hall: 'politics',
  business: 'economy',
  neighborhoods: 'social',
  sports: 'sports',
  culture: 'culture',
  science_tech: 'science',
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Salary per issue by skill tier, matching the hand-written pool ($60-210). */
const SALARY_BY_SKILL = [0, 45, 65, 100, 135, 195];

export function generateCandidates(world: CityWorld, subtopics: SubtopicMap, count: number): Reporter[] {
  const r = rng(0xc0ffee);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const desks = Object.keys(DESK_CATEGORY) as Desk[];
  const takenNames = new Set(world.staff_pool.map((p) => p.name));
  const out: Reporter[] = [];
  for (let i = 0; out.length < count && i < count * 10; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    if (takenNames.has(name)) continue;
    takenNames.add(name);
    const desk = desks[out.length % desks.length]!;
    // Mostly average reporters, with a few rookies and a few standouts.
    const tier = [2, 2, 3, 3, 3, 3, 4, 4, 5][Math.floor(r() * 9)]!;
    const mean = 4 + tier * 2.4;
    const attr = (): number => Math.max(1, Math.min(20, Math.round(mean + (r() - 0.5) * 9)));
    const attributes: Attributes = { speed: attr(), accuracy: attr(), impact: attr(), charge: Math.max(1, Math.min(20, Math.round(4 + r() * 12))), flair: attr(), tact: attr() };
    out.push({
      id: `cand-${out.length + 1}`,
      name,
      desk,
      interest: pick(subtopics[DESK_CATEGORY[desk]]).id,
      skill: tier,
      salary_per_issue: SALARY_BY_SKILL[tier]! + Math.round((r() - 0.5) * 20),
      attributes,
      voice: pick(VOICES),
      starting_candidate: false,
    });
  }
  return out;
}
