// Automatic fact check (spec 7.6): every number and capitalized name in a
// generated article must appear in the story's facts or wire text, or be a name
// from the game's own data. Pure, so tests and the tech demo share it.
import type { CityWorld, Story } from '../data/schemas.ts';
import { TIERS } from '../sim/balance.ts';
import type { Tier } from '../sim/types.ts';
import { BODY_LENGTH_HARD_MAX, BODY_LENGTH_RANGE, HEADLINE_MAX_WORDS, HEADLINE_SLACK } from './config.ts';
import type { ArticleText } from './types.ts';

export type Field = 'headline' | 'deck' | 'body';

export interface Flag {
  kind: 'number' | 'name';
  field: Field;
  /** The offending text exactly as written in the article. */
  text: string;
  /** Character range inside that field, for highlighting. */
  start: number;
  end: number;
}

export interface FactCheckResult {
  flags: Flag[];
  /** Problems that fail the article: bad facts_used, empty or too-short text, lengths far over target. */
  problems: string[];
  /**
   * Style notes that don't fail it: a headline a word or two long, a body somewhat
   * over target. The layout already shrinks headlines and fits bodies.
   */
  warnings: string[];
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALE: Record<string, number> = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 };
const WORD = Object.keys(SMALL).concat(Object.keys(SCALE), 'dozen').join('|');
const NUMBER_WORDS = new RegExp(`\\b(?:${WORD})(?:(?:[\\s-]+|[\\s-]+and[\\s-]+)(?:${WORD}))*\\b`, 'gi');
const DIGITS = /\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(million|billion|thousand)\b)?/gi;

/** "Four", "Fourteen", "twenty-one": made only of number words. */
function isNumberWord(word: string): boolean {
  const parts = word.toLowerCase().split('-').filter(Boolean);
  return parts.length > 0 && parts.every((p) => p in SMALL || p in SCALE || p === 'dozen');
}

function wordsToNumber(phrase: string): number | undefined {
  const tokens = phrase.toLowerCase().split(/[\s-]+/).filter((t) => t && t !== 'and');
  // A lone "one" is a pronoun far more often than a count ("one of the", "no one").
  if (tokens.length === 1 && tokens[0] === 'one') return undefined;
  let total = 0;
  let current = 0;
  for (const t of tokens) {
    if (t === 'dozen') current = (current || 1) * 12;
    else if (t in SMALL) current += SMALL[t]!;
    else if (t === 'hundred') current = (current || 1) * 100;
    else {
      total += (current || 1) * SCALE[t]!;
      current = 0;
    }
  }
  return total + current;
}

export interface NumberMention {
  value: number;
  start: number;
  end: number;
  text: string;
}

/** Every number in the text, as a value: "$1,200", "1.2 thousand" and "twelve hundred" all become 1200. */
export function extractNumbers(text: string): NumberMention[] {
  const out: NumberMention[] = [];
  for (const m of text.matchAll(DIGITS)) {
    const [raw, mult] = m;
    const base = Number(raw.replace(/,/g, '').replace(/\s*(million|billion|thousand)$/i, ''));
    const scale = mult ? SCALE[mult.toLowerCase()]! : 1;
    out.push({ value: Math.round(base * scale * 1e6) / 1e6, start: m.index, end: m.index + raw.length, text: raw });
  }
  for (const m of text.matchAll(NUMBER_WORDS)) {
    const v = wordsToNumber(m[0]);
    // "2.5 million" was already read as one number; don't read its scale word again.
    if (out.some((d) => m.index < d.end && m.index + m[0].length > d.start)) continue;
    if (v !== undefined) out.push({ value: v, start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Capitalized words that are never names. They only start sentences or headlines. */
const COMMON = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'with', 'from', 'after', 'before',
  'this', 'that', 'these', 'those', 'it', 'its', 'he', 'she', 'they', 'we', 'i', 'his', 'her', 'their', 'our', 'no', 'not', 'is', 'are', 'was', 'were',
  'new', 'more', 'most', 'all', 'some', 'many', 'one', 'two', 'three', 'when', 'while', 'where', 'who', 'what', 'why', 'how', 'if', 'than', 'then', 'now', 'here',
]);

const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'’-]*/g;

/** Lowercased word parts: "Kensington-area" gives kensington and area; possessives are stripped. */
function wordParts(token: string): string[] {
  return token
    .replace(/['’]s$/i, '')
    .replace(/['’]$/, '')
    .split(/[-'’]/)
    .map((p) => p.toLowerCase())
    .filter(Boolean);
}

/** All word parts in some text, as a set. */
export function wordSet(...texts: string[]): Set<string> {
  const set = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(WORD_RE)) for (const p of wordParts(m[0])) set.add(p);
  return set;
}

const isCapital = (s: string) => /^[A-Z]/.test(s);

interface Token {
  text: string;
  start: number;
  end: number;
  sentenceStart: boolean;
}

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const before = text.slice(0, m.index).replace(/[\s"“‘'(]+$/, '');
    const sentenceStart = before === '' || /[.!?:]$/.test(before);
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length, sentenceStart });
  }
  return out;
}

/**
 * Capitalized words that are not in the allowed set. A capitalized word passes if
 * any lowercase form of it appears in the source, so title-case headlines and
 * common words are not flagged, and an invented name like "Hargrove" is.
 * A sentence's first word is only checked when a capitalized word follows it
 * (a name like "Councilmember Reyes"), since "Residents" or "Officials" at the
 * start of a sentence cannot be told from a name.
 */
export function unknownNames(text: string, allowed: Set<string>): { text: string; start: number; end: number }[] {
  const tokens = tokenize(text);
  const out: { text: string; start: number; end: number }[] = [];
  tokens.forEach((t, i) => {
    if (!isCapital(t.text) || t.text.length === 1) return;
    // "Four" at the start of a sentence is a number (checked as one), not a name.
    if (isNumberWord(t.text)) return;
    if (t.sentenceStart) {
      const next = tokens[i + 1];
      const nextIsCapital = next !== undefined && isCapital(next.text) && !/[.!?]\s*$/.test(text.slice(t.end, next.start));
      if (!nextIsCapital) return;
    }
    // In "Mets-friendly" only the capitalized part is a name candidate.
    const parts = t.text.split('-').filter(isCapital).flatMap(wordParts);
    if (parts.every((p) => COMMON.has(p) || allowed.has(p))) return;
    out.push({ text: t.text, start: t.start, end: t.end });
  });
  return out;
}

/** Names that come from the game's own data and so may appear in any article. */
export function gameNames(world: CityWorld, paperName?: string): string[] {
  return [
    ...(paperName ? [paperName] : []),
    ...world.staff_pool.map((r) => r.name),
    world.city.name,
    world.city.nickname,
    ...world.districts.flatMap((d) => [d.name, ...d.example_neighborhoods]),
  ];
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function factCheck(article: ArticleText, story: Story, tier: Tier, extraNames: string[] = []): FactCheckResult {
  const source = [story.wire_headline, story.wire_text, ...story.facts].join('\n');
  const sourceNumbers = new Set(extractNumbers(source).map((n) => n.value));
  const allowed = wordSet(source, ...extraNames);
  const flags: Flag[] = [];

  for (const field of ['headline', 'deck', 'body'] as const) {
    const text = article[field];
    for (const n of extractNumbers(text)) {
      if (!sourceNumbers.has(n.value)) flags.push({ kind: 'number', field, text: n.text, start: n.start, end: n.end });
    }
    for (const n of unknownNames(text, allowed)) flags.push({ kind: 'name', field, ...n });
  }

  const problems: string[] = [];
  const warnings: string[] = [];
  if (!article.headline.trim()) problems.push('Empty headline');
  if (!article.body.trim()) problems.push('Empty body');
  const max = HEADLINE_MAX_WORDS[tier];
  const headWords = wc(article.headline);
  if (headWords > max + HEADLINE_SLACK) problems.push(`Headline has ${headWords} words (limit ${max} for ${tier})`);
  else if (headWords > max) warnings.push(`Headline has ${headWords} words (limit ${max} for ${tier})`);
  const target = TIERS[tier].words;
  const bodyWords = wc(article.body);
  if (bodyWords > target * BODY_LENGTH_HARD_MAX) problems.push(`Body has ${bodyWords} words (target ${target})`);
  else if (bodyWords > target * BODY_LENGTH_RANGE.max) warnings.push(`Body has ${bodyWords} words (target ${target})`);
  // A story with few facts cannot fill a long slot without padding, so the minimum shrinks with the facts.
  const factWords = story.facts.reduce((a, f) => a + wc(f), 0);
  if (bodyWords < Math.min(target * BODY_LENGTH_RANGE.min, factWords * 0.5)) problems.push(`Body has only ${bodyWords} words (target ${target})`);
  for (const i of article.facts_used) {
    if (!Number.isInteger(i) || i < 0 || i >= story.facts.length) problems.push(`facts_used index ${i} is not a fact of this story`);
  }
  return { flags, problems, warnings, passed: flags.length === 0 && problems.length === 0 };
}
