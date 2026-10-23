// Seeded random numbers, so a game (or a bug report) can be replayed exactly.

/** mulberry32: small, fast, good enough for game rolls. Returns numbers in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix a seed with labels (issue number, article id...) into a new seed. */
export function seedFor(seed: number, ...parts: (string | number)[]): number {
  let h = (seed ^ 2166136261) >>> 0;
  for (const p of parts.join('|')) h = Math.imul(h ^ p.charCodeAt(0), 16777619) >>> 0;
  return h;
}
