// The ad desk's rules in one place: who will buy space, how they feel about the
// paper, and why. Advertisers sign up as readership grows (min_readers), warm
// to coverage on desks they like, and pull their ads after hard-hitting coverage
// of themselves. Pure functions, no UI.
import type { Category, CityWorld, Entity } from '../data/schemas.ts';
import { ADVERTISERS } from './balance.ts';
import { totalReaders } from './readers.ts';
import type { GameState } from './types.ts';

export type AdMood = 'happy' | 'content' | 'uneasy' | 'angry';

export interface AdStatus {
  /** open: can run this issue. locked: the paper is too small for them yet. pulled: they walked out for now. */
  state: 'open' | 'locked' | 'pulled';
  relationship: number;
  mood: AdMood;
  /** Readers still needed before they sign (locked only). */
  readersNeeded: number;
  /** Last issue they sit out (pulled only). */
  pulledThrough: number;
  /** One line on why they're in this state, for the ad desk. */
  reason: string;
}

export function moodOf(relationship: number): AdMood {
  const m = ADVERTISERS.mood;
  return relationship >= m.happy ? 'happy' : relationship >= m.content ? 'content' : relationship >= m.uneasy ? 'uneasy' : 'angry';
}

export function adStatus(game: Pick<GameState, 'advertisers' | 'issueNumber' | 'districts'>, entity: Entity): AdStatus {
  const a = game.advertisers[entity.id] ?? { relationship: ADVERTISERS.start, pulledThrough: 0 };
  const readers = totalReaders(game.districts);
  const mood = moodOf(a.relationship);
  const base = { relationship: Math.round(a.relationship), mood, pulledThrough: a.pulledThrough, readersNeeded: 0 };
  if (a.pulledThrough >= game.issueNumber) {
    return { ...base, state: 'pulled', reason: `Pulled their ads over your coverage. Back after issue ${a.pulledThrough}, if you leave them be.` };
  }
  if (readers < entity.min_readers) {
    const need = entity.min_readers - readers;
    return { ...base, state: 'locked', readersNeeded: need, reason: `Wants a bigger paper: ${entity.min_readers.toLocaleString('en-US')} readers (${need.toLocaleString('en-US')} to go).` };
  }
  const why =
    mood === 'angry'
      ? 'Furious. One more hard-hitting story about them and they pull out.'
      : mood === 'uneasy'
        ? 'Uneasy. A hard-hitting story about them now would make them pull their ads.'
        : mood === 'content'
          ? 'Content. They can take one critical story.'
          : 'Happy with the paper.';
  return { ...base, state: 'open', reason: why };
}

/** The next advertiser who'll sign once the paper grows, or undefined if everyone's signed. */
export function nextAdvertiser(game: Pick<GameState, 'districts'>, world: CityWorld): Entity | undefined {
  const readers = totalReaders(game.districts);
  return [...world.entities].filter((e) => e.min_readers > readers).sort((a, b) => a.min_readers - b.min_readers)[0];
}

/**
 * How hard a front-page hard-hitting story would hit them: relationship lost
 * at full prominence, and whether that would make them pull out.
 */
export function hitPreview(game: Pick<GameState, 'advertisers'>, entityId: string, prominence = 1): { loss: number; wouldPull: boolean } {
  const rel = game.advertisers[entityId]?.relationship ?? ADVERTISERS.start;
  const loss = Math.round(ADVERTISERS.hitPenalty * prominence);
  return { loss, wouldPull: rel - loss < ADVERTISERS.pullBelow };
}

/** Plain-language rules for the ad desk. */
export function likesLabel(likes: readonly Category[], label: Record<Category, string>): string {
  return likes.length ? likes.map((c) => label[c]).join(' & ') : 'nothing in particular';
}
