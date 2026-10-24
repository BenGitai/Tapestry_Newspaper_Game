// Turns one real headline + feed summary into a game story: category, subtopic,
// importance, sensitivity, lean signal and a short list of facts. Server-side
// only (the Anthropic SDK never runs in the game). Facts are restricted to what
// the headline and summary say; anything with a number or a name that isn't in
// the source text is dropped by checkFacts.
import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { CATEGORIES, type Category, type SubtopicMap } from '../src/data/schemas.ts';
import { MAX_OUTPUT_TOKENS, SUMMARIZER_EFFORT } from '../src/summarizer/config.ts';
import { extractNumbers, unknownNames, wordSet } from '../src/summarizer/factcheck.ts';
import type { Usage } from '../src/summarizer/cost.ts';

export const extractionSchema = z.object({
  usable: z.boolean(),
  /** "us" if the story is about the United States, "international" otherwise. */
  scope: z.enum(['us', 'international']),
  category: z.enum(CATEGORIES),
  subtopic: z.string(),
  importance: z.number().int().min(1).max(5),
  sensitive: z.boolean(),
  facts: z.array(z.string()).max(6),
  lean: z.enum(['left', 'right', 'none']),
  lean_strength: z.number().int().min(0).max(3),
});
export type Extraction = z.infer<typeof extractionSchema>;

export interface SourceItem {
  title: string;
  description: string;
  section: string;
  feed: string;
}

export function extractionPrompt(item: SourceItem, subtopics: SubtopicMap): { system: string; user: string } {
  const subs = (Object.keys(subtopics) as Category[]).map((c) => `${c}: ${subtopics[c].map((s) => s.id).join(', ')}`).join('\n');
  const system = `You prepare wire items for a newspaper game set in Philadelphia, USA. You receive a real headline and the news feed's short summary. You return structured data about it.

Rules:
1. Facts: 1 to 5 short, plain sentences that restate ONLY what the headline and summary say. No outside knowledge, no background, no guesses. Keep any uncertainty ("said", "reportedly", "expected"). Every number and every name in a fact must appear in the headline or summary.
2. usable = false for items that are not news stories: podcasts, quizzes, live blogs, "watch"/video-only items, recipes, newsletters, promotions, or anything too vague to state a fact.
3. scope = "us" if the story is about the United States (including US people abroad as the focus); otherwise "international".
4. category: international stories are "world", except sport, which stays "sports". US stories use politics, economy, social, sports, culture or science (never world).
5. subtopic must be one of the ids listed for the chosen category. For world, pick the continent. For US politics never use "council" (that is Philadelphia's city council).
6. importance 1-5: how much a general US newspaper reader would care today (5 = major national or global news).
7. sensitive = true for deaths, disasters, violence, abuse, suicide or serious illness of identifiable people.
8. lean: if a newspaper covered this story in a hard-hitting, critical way, would readers take it as leaning "left" (the criticism lands on conservative or Republican figures, parties or policies), "right" (the criticism lands on progressive or Democratic figures, parties or policies), or "none" (not partisan)? Apply exactly the same test to both sides. lean_strength 0-3: how strongly partisan (0 for none).

Category ids and their subtopics:
${subs}`;
  const user = `Feed: ${item.feed} (section: ${item.section})
Headline: ${item.title}
Summary: ${item.description}`;
  return { system, user };
}

/** Keep only facts whose numbers and capitalized names are all in the source text. */
export function checkFacts(facts: string[], item: SourceItem): string[] {
  const source = `${item.title}\n${item.description}`;
  const numbers = new Set(extractNumbers(source).map((n) => n.value));
  const allowed = wordSet(source);
  return facts
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
    .filter((f) => extractNumbers(f).every((n) => numbers.has(n.value)) && unknownNames(f, allowed).length === 0);
}

export async function extract(client: Anthropic, model: string, item: SourceItem, subtopics: SubtopicMap): Promise<{ data: Extraction | null; usage: Usage; stop: string | null }> {
  const p = extractionPrompt(item, subtopics);
  const r = await client.messages.parse({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: p.system,
    messages: [{ role: 'user', content: p.user }],
    thinking: { type: 'disabled' },
    output_config: { effort: SUMMARIZER_EFFORT, format: zodOutputFormat(extractionSchema) },
  });
  const usage = { inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens };
  if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') return { data: null, usage, stop: r.stop_reason };
  return { data: r.parsed_output ?? null, usage, stop: r.stop_reason };
}
