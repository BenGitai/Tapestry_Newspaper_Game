// No-key fallback: builds article text from the story's facts only.
// It never adds words that carry information, so it can't invent anything.
import type { Story } from '../data/schemas.ts';
import { TIERS } from '../sim/balance.ts';
import type { Tier } from '../sim/types.ts';
import type { ArticleText } from './types.ts';

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Facts in order until the tier's word target is reached (always at least one). */
function pickFacts(facts: string[], startAt: number, targetWords: number): number[] {
  const used: number[] = [];
  let words = 0;
  for (let i = startAt; i < facts.length; i++) {
    const fact = facts[i] ?? '';
    if (used.length > 0 && words + wordCount(fact) > targetWords) break;
    used.push(i);
    words += wordCount(fact);
  }
  return used;
}

export function templateArticle(story: Story, tier: Tier): ArticleText {
  const target = TIERS[tier].words;
  if (tier === 'brief') {
    return { headline: story.wire_headline, deck: '', body: story.facts[0] ?? '', facts_used: [0] };
  }
  const used = pickFacts(story.facts, 0, target);
  // The deck repeats the second fact used, if there is one; the body still includes it.
  const deck = tier === 'lead' && used.length > 1 ? (story.facts[used[1] ?? 0] ?? '') : '';
  return {
    headline: story.wire_headline,
    deck,
    body: used.map((i) => story.facts[i]).join(' '),
    facts_used: used,
  };
}
