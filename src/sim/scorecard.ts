// The article scorecard: a scouting report on what a piece is likely to do.
// Half of it is shown (readership, heat, trust, sensational), half is hidden
// until the paper is printed (correction risk, award chance). Built from the
// story's content and the reporter's attributes.
import type { CityWorld, Story } from '../data/schemas.ts';
import { FOCUS, SCORECARD, WORKLOAD } from './balance.ts';
import { currentAttributes, isOnDesk, reporterById } from './staff.ts';
import type { Article, Attributes, StaffMember } from './types.ts';

/** Stand-in attributes for wire copy (no reporter). */
const WIRE_COPY: Attributes = { speed: 10, accuracy: 13, impact: 7, charge: 5, flair: 8, tact: 12 };

export interface Scorecard {
  shown: {
    /** 0..1 */
    readership: number;
    /** 0..1, magnitude only: heat is symmetric, it never says which side. */
    heat: number;
    /** -1..1 */
    trust: number;
    sensational: boolean;
    /** Institutions a Hard-hitting piece will annoy. */
    upsets: string[];
  };
  hidden: {
    /** 0..1 */
    correctionRisk: number;
    /** 0..1 */
    awardChance: number;
  };
  /** Plain-language reasons, for the scouting report. */
  notes: string[];
}

function clamp(n: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, n));
}

export function isSensational(article: Pick<Article, 'angle'>, story: Pick<Story, 'sensitivity'>, attrs: Attributes): boolean {
  const s = SCORECARD;
  if (article.angle === 'hard' && (attrs.charge >= s.sensationalCharge || attrs.tact <= s.sensationalTact)) return true;
  return story.sensitivity === 'high' && attrs.tact <= s.sensationalTact;
}

export function scorecard(article: Article, story: Story, world: CityWorld, member: StaffMember | undefined, freshness = 1): Scorecard {
  const s = SCORECARD;
  const reporter = article.reporterId ? reporterById(world, article.reporterId) : undefined;
  const base = reporter ? currentAttributes(reporter, member) : WIRE_COPY;
  // Writing on their focus sharpens accuracy and impact; on their interest, flair.
  const attrs: Attributes = {
    ...base,
    accuracy: Math.min(20, base.accuracy + (article.onFocus ? FOCUS.attributeBonus : 0)),
    impact: Math.min(20, base.impact + (article.onFocus ? FOCUS.attributeBonus : 0)),
    flair: Math.min(20, base.flair + (article.onInterest ? FOCUS.interestFlair : 0)),
  };
  const notes: string[] = [];
  const offBeat = reporter ? !isOnDesk(reporter, story, world) : false;
  if (offBeat) notes.push('Written off their usual desk.');
  if (!reporter) notes.push('Wire copy: no byline, no local reporting.');
  if (article.onPatch) notes.push('Written from their own patch: local knowledge shows.');
  if (article.onFocus) notes.push('On their assigned focus: sharper and more accurate.');
  if (article.onInterest) notes.push('Their favorite subject: it shows in the writing.');
  if (freshness < 1) notes.push(`Getting stale: worth ${Math.round(freshness * 100)}% of a fresh piece.`);

  const light = story.importance <= 2;
  const styleMatch =
    (article.style === 'feature' && light) || (article.style === 'investigative' && story.importance >= 4) || (article.style === 'news' && !light);
  const r = s.readership;
  const readership = clamp(
    ((story.importance / 5) * r.importance +
      (attrs.flair / 20) * r.flair +
      (article.onPatch ? r.onPatch : 0) +
      (styleMatch ? r.styleMatch : 0) +
      (offBeat ? r.offBeat : 0) +
      (article.onFocus ? FOCUS.readershipFocus : 0) +
      (article.onInterest ? FOCUS.readershipInterest : 0)) *
      freshness,
  );

  const sensational = isSensational(article, story, attrs);
  if (sensational) notes.push(story.sensitivity === 'high' ? 'Sensational treatment of a sensitive story. Expect anger.' : 'Sensational: big reactions either way.');

  const upsets =
    article.angle === 'hard' ? story.targets.map((t) => world.entities.find((e) => e.id === t)?.name ?? t) : [];
  const heat = clamp(
    Math.abs(story.hard_hitting_lean) * s.heatAngle[article.angle] * (s.heatChargeBase + attrs.charge / 20) + upsets.length * s.heatPerTarget,
  );

  let trust = 0;
  if (article.angle === 'hard' && story.importance >= 4) trust += 0.3 * (attrs.accuracy / 20);
  if (article.angle === 'straight') trust += 0.1;
  if (article.angle === 'puff' && story.importance >= 4) {
    trust -= 0.3;
    notes.push('Puff on a serious story reads as soft.');
  }
  if (sensational) trust -= story.sensitivity === 'high' ? 0.6 : 0.15;
  if (offBeat) trust -= 0.05;

  const workloadRisk = member ? WORKLOAD[member.assignment.workload].correctionRisk : 1;
  const correctionRisk = clamp(((20 - attrs.accuracy) / 20) * s.correctionBase * workloadRisk * (offBeat ? 1.3 : 1));
  const awardChance = clamp(
    (attrs.impact / 20) *
      (story.importance / 5) *
      s.awardBase *
      (article.style === 'investigative' ? s.awardInvestigative : 1) *
      (sensational ? s.sensationalSwing : 1) *
      (article.onFocus ? FOCUS.awardFocus : 1) *
      freshness,
  );

  return { shown: { readership, heat, trust: clamp(trust, -1, 1), sensational, upsets }, hidden: { correctionRisk, awardChance }, notes };
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export function grade(v: number): Grade {
  if (v >= 0.75) return 'A';
  if (v >= 0.55) return 'B';
  if (v >= 0.35) return 'C';
  if (v >= 0.18) return 'D';
  return 'E';
}

export function heatLabel(v: number): string {
  if (v < 0.05) return 'None';
  if (v < 0.2) return 'Low';
  if (v < 0.4) return 'Medium';
  if (v < 0.6) return 'High';
  return 'Explosive';
}

export function trustLabel(v: number): string {
  if (v >= 0.2) return 'Builds trust';
  if (v > 0.02) return 'Slight gain';
  if (v > -0.02) return 'Neutral';
  if (v > -0.3) return 'Slight loss';
  return 'Costs trust';
}
