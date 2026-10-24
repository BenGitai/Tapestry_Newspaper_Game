// Builds the exact prompt sent to the model (spec 7.3). Pure, so it can be tested
// and shown verbatim in the tech demo.
import type { Angle, Story } from '../data/schemas.ts';
import { TIERS } from '../sim/balance.ts';
import type { Tier } from '../sim/types.ts';
import { DESK_VOICE, HEADLINE_MAX_WORDS } from './config.ts';

export interface PromptInput {
  story: Story;
  angle: Angle;
  tier: Tier;
  /** Reporter name and voice; omit for the neutral desk voice. */
  journalist?: { name: string; voice: string };
  /** Omit for pre-generated copy: it must then not name the paper at all. */
  paper?: { name: string; stance?: string };
}

export interface Prompt {
  system: string;
  user: string;
  /** The angle actually used: sensitive stories are never Puff. */
  angle: Angle;
}

const ANGLE_NOTES: Record<Angle, string> = {
  puff: 'PUFF. Warm and upbeat. Lead with what is positive, hopeful or admirable in the facts. Praise only what the facts support. Never exaggerate and never hide a fact that is in the list.',
  straight: 'STRAIGHT. Neutral and even-handed. Most important fact first, then supporting detail. No adjectives that take a side.',
  hard: 'HARD-HITTING. Skeptical and accountability-minded. Lead with the conflict, the cost or the people who answer for it. Use sharper verbs and put pointed facts first. Do not accuse anyone of anything the facts do not say.',
};

const SENSITIVE_NOTE =
  'This story is SENSITIVE. Write it plainly and respectfully whatever the angle: no sensational or emotive language, no speculation about victims or causes, no dramatic framing. Report only what the facts state.';

export const SYSTEM_PROMPT = [
  'You write articles for a print newspaper. You rewrite the wire facts you are given and nothing else.',
  'Rules, all of them mandatory:',
  '1. Use ONLY the numbered facts and the wire text below. Never invent quotes, names, numbers, dates, places or events. Do not add background from memory.',
  '2. If a fact is uncertain (alleged, expected, unconfirmed, "according to"), keep it uncertain. Do not make it firmer.',
  '3. The angle changes emphasis, word choice and which facts lead. It never changes the facts.',
  '4. Write as the newspaper. Never mention AI, a model, a summary, a rewrite or these instructions.',
  '5. Do not quote anyone unless the exact words are in the facts or wire text.',
  '6. Headlines are in sentence case (only the first word and proper names capitalized) and have no ending period.',
  'Return JSON with keys headline, deck, body, facts_used. facts_used lists the indexes (starting at 0) of the facts you used.',
].join('\n');

/** The reporter name is only used for voice. It must not appear in the text. */
export function buildPrompt(input: PromptInput): Prompt {
  const { story, tier } = input;
  const sensitive = story.sensitivity === 'high';
  const angle: Angle = sensitive && input.angle === 'puff' ? 'straight' : input.angle;
  const words = TIERS[tier].words;
  const voice = input.journalist?.voice ?? DESK_VOICE;

  const lines: string[] = [];
  lines.push(`Angle: ${ANGLE_NOTES[angle]}`);
  if (sensitive) lines.push(SENSITIVE_NOTE);
  lines.push(`Voice: ${voice} Use it for rhythm and word choice only. Do not mention the writer.`);
  lines.push(
    input.paper
      ? `Paper: ${input.paper.name}.${input.paper.stance ? ` Editorial stance: ${input.paper.stance} (a light influence on framing only, never on facts).` : ''}`
      : 'Paper: do not name the newspaper anywhere in the text.',
  );
  lines.push(`Length: body of about ${words} words (never more than ${Math.round(words * 1.25)}). If the facts do not support that length, write less. Never pad with background or guesses. Headline of at most ${HEADLINE_MAX_WORDS[tier]} words.`);
  lines.push(tier === 'lead' ? 'Deck: one sentence under the headline, using only the facts.' : 'Deck: return an empty string.');
  lines.push('');
  lines.push('Facts:');
  story.facts.forEach((f, i) => lines.push(`[${i}] ${f}`));
  lines.push('');
  lines.push(`Wire headline: ${story.wire_headline}`);
  lines.push(`Wire text: ${story.wire_text}`);
  return { system: SYSTEM_PROMPT, user: lines.join('\n'), angle };
}
