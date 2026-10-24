// Calls the model to write one article. This is the only place the Anthropic SDK
// is used besides scripts/ (both are server-side; the SDK is never imported from src/).
// The API key comes from the environment (ANTHROPIC_API_KEY, read by the SDK); it is
// never sent to the renderer.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { CityWorld } from '../src/data/schemas.ts';
import { MAX_OUTPUT_TOKENS, SUMMARIZER_EFFORT } from '../src/summarizer/config.ts';
import { callCost, type Usage } from '../src/summarizer/cost.ts';
import { factCheck, gameNames, type FactCheckResult } from '../src/summarizer/factcheck.ts';
import { buildPrompt, type Prompt, type PromptInput } from '../src/summarizer/prompt.ts';
import type { ArticleText } from '../src/summarizer/types.ts';

export const articleSchema = z.object({
  headline: z.string(),
  deck: z.string(),
  body: z.string(),
  facts_used: z.array(z.number().int()),
});

export interface GenerateResult {
  prompt: Prompt;
  model: string;
  /** null when the model declined, ran out of room or returned nothing usable. */
  article: ArticleText | null;
  /** Why there is no article, when there is none. */
  failure?: 'refusal' | 'max_tokens' | 'unparseable';
  stopReason: string | null;
  usage: Usage;
  cost: number;
  check: FactCheckResult | null;
  /** 1 = first try; 2 = the check failed and it was written again. */
  attempts: number;
}

export function makeClient(): Anthropic {
  if (!process.env['ANTHROPIC_API_KEY']) throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env (it is gitignored).');
  return new Anthropic();
}

async function callOnce(client: Anthropic, model: string, prompt: Prompt): Promise<Pick<GenerateResult, 'article' | 'failure' | 'stopReason' | 'usage'>> {
  // No temperature/top_p (rejected), no prefill. Thinking off and effort low:
  // these are short rewrites of facts we hand over.
  const response = await client.messages.parse({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    thinking: { type: 'disabled' },
    output_config: { effort: SUMMARIZER_EFFORT, format: zodOutputFormat(articleSchema) },
  });
  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  const stopReason = response.stop_reason;
  if (stopReason === 'refusal') return { article: null, failure: 'refusal', stopReason, usage };
  if (stopReason === 'max_tokens') return { article: null, failure: 'max_tokens', stopReason, usage };
  const parsed = response.parsed_output;
  if (!parsed) return { article: null, failure: 'unparseable', stopReason, usage };
  return { article: parsed, stopReason, usage };
}

/**
 * Write one article and fact check it. A failed check (or a model refusal's
 * absence of text) is retried once; the caller decides what to do with a result
 * that still fails (the script leaves it out of the cache so the game uses the template).
 */
export async function generateArticle(
  client: Anthropic,
  model: string,
  input: PromptInput,
  world: CityWorld,
  maxAttempts = 2,
): Promise<GenerateResult> {
  const prompt = buildPrompt(input);
  const names = gameNames(world, input.paper?.name);
  const total: Usage = { inputTokens: 0, outputTokens: 0 };
  let last: Awaited<ReturnType<typeof callOnce>> | undefined;
  let check: FactCheckResult | null = null;
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    last = await callOnce(client, model, prompt);
    total.inputTokens += last.usage.inputTokens;
    total.outputTokens += last.usage.outputTokens;
    // A refusal is not retried: it would decline again.
    if (last.failure === 'refusal') break;
    if (last.article) {
      check = factCheck(last.article, input.story, input.tier, names);
      if (check.passed) break;
    }
  }
  return {
    prompt,
    model,
    article: last?.article ?? null,
    ...(last?.failure ? { failure: last.failure } : {}),
    stopReason: last?.stopReason ?? null,
    usage: total,
    cost: callCost(model, total),
    check,
    attempts,
  };
}
