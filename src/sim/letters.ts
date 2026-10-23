// AI-CONTENT-REVIEW: letters to the editor. The sentence templates and names
// below were written by an AI model as placeholders (approved for the demo
// only). The team should review or replace them before release.
// Letters are filled from what happened this issue; they never quote real people.
import type { CityWorld } from '../data/schemas.ts';
import { rng, seedFor } from './rng.ts';
import type { Letter } from './types.ts';

const FIRST = ['Dolores', 'Marcus', 'Theresa', 'Andre', 'Bernadette', 'Luis', 'Pat', 'Keisha', 'Walt', 'Mei', 'Frank', 'Yolanda', 'Sam', 'Irene', 'Dev', 'Rosa'];
const LAST = ['M.', 'K.', 'T.', 'R.', 'D.', 'S.', 'B.', 'L.', 'P.', 'W.', 'H.', 'G.'];

export type LetterCue =
  | { kind: 'loved_story'; headline: string; district: string }
  | { kind: 'local_ignored'; district: string }
  | { kind: 'too_soft'; headline: string; district: string }
  | { kind: 'sensational'; headline: string; district: string }
  | { kind: 'correction'; headline: string; district: string }
  | { kind: 'missed'; headline: string; district: string }
  | { kind: 'lean_drift'; direction: 'left' | 'right'; district: string }
  | { kind: 'great_issue'; district: string }
  | { kind: 'thin_issue'; district: string };

const TEMPLATES: Record<LetterCue['kind'], { tone: Letter['tone']; texts: string[] }> = {
  loved_story: {
    tone: 'praise',
    texts: ['Finally, someone covered “{h}” properly. Clipped it for the fridge.', 'Read “{h}” twice. This is why I still buy a paper.'],
  },
  local_ignored: {
    tone: 'complaint',
    texts: ['Not one word about our neighborhood again. We read too, you know.', 'Do your reporters know {d} exists? Nothing for us this issue.'],
  },
  too_soft: {
    tone: 'complaint',
    texts: ['“{h}” read like a press release. Ask harder questions.', 'Since when is “{h}” a feel-good story? People are worried.'],
  },
  sensational: {
    tone: 'complaint',
    texts: ['The way you handled “{h}” was cheap. Real people are hurting.', '“{h}” was written to sell papers, not to inform. Shameful.'],
  },
  correction: {
    tone: 'complaint',
    texts: ['Your story “{h}” got it wrong. Check your facts before you print.', 'I noticed the correction on “{h}”. It happens, but it shouldn’t keep happening.'],
  },
  missed: {
    tone: 'complaint',
    texts: ['The Herald had “{h}” on the front. Where was it in yours?', 'How do you skip “{h}”? I had to read the Herald to find out.'],
  },
  lean_drift: {
    tone: 'complaint',
    texts: ['Your paper is drifting {dir}. I liked you better when you just reported.', 'Every week a little more to the {dir}. Pick facts, not sides.'],
  },
  great_issue: {
    tone: 'praise',
    texts: ['Best issue yet. Every page had something for me.', 'Passed my copy around the whole block. Keep it up.'],
  },
  thin_issue: {
    tone: 'complaint',
    texts: ['Paid full price for a lot of empty pages.', 'Thin issue. I was done before my coffee was.'],
  },
};

/** Turn this issue's cues into a few letters. Deterministic for a given seed. */
export function writeLetters(world: CityWorld, cues: LetterCue[], seed: number, max = 3): Letter[] {
  const rand = rng(seed);
  // Prefer a mix: at most `max` letters, complaints and praise both represented if available.
  const praise = cues.filter((c) => TEMPLATES[c.kind].tone === 'praise');
  const complaints = cues.filter((c) => TEMPLATES[c.kind].tone === 'complaint');
  const picked: LetterCue[] = [];
  while (picked.length < max && (praise.length || complaints.length)) {
    const pool = picked.length % 2 === 0 ? (complaints.length ? complaints : praise) : praise.length ? praise : complaints;
    picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]!);
  }
  return picked.map((cue, i) => {
    const t = TEMPLATES[cue.kind];
    const district = world.districts.find((d) => d.id === cue.district);
    const places = district?.example_neighborhoods ?? ['Philadelphia'];
    const r = rng(seedFor(seed, i, cue.kind));
    const text = (t.texts[Math.floor(r() * t.texts.length)] ?? '')
      .replace('{h}', 'headline' in cue ? cue.headline : '')
      .replace('{d}', district?.name ?? 'our neighborhood')
      .replace('{dir}', 'direction' in cue ? cue.direction : '');
    return {
      name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
      place: places[Math.floor(r() * places.length)] ?? 'Philadelphia',
      text,
      tone: t.tone,
    };
  });
}

