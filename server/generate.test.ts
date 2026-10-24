import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../src/data/worldData.ts';
import { generateArticle } from './generate.ts';

const { world, stories } = loadGameData();
const story = stories.storyById('d1-phillies')!;
const good = {
  headline: 'Phillies take Game 1 of NLCS, 5-3',
  deck: '',
  body: 'The Phillies won Game 1 of the National League Championship Series 5-3 at home. Rookie shortstop Danny Ocasio drove in three runs, including a two-run double in the sixth inning. The announced crowd was 44,812.',
  facts_used: [0, 1, 2],
};

interface Reply {
  stop_reason?: string;
  parsed_output?: unknown;
}

function fakeClient(replies: Reply[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    messages: {
      parse: async (params: Record<string, unknown>) => {
        calls.push(params);
        const r = replies[Math.min(calls.length - 1, replies.length - 1)]!;
        return { usage: { input_tokens: 600, output_tokens: 150 }, stop_reason: 'end_turn', parsed_output: null, ...r };
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const input = { story, angle: 'straight' as const, tier: 'secondary' as const };

describe('generateArticle', () => {
  it('returns a passing article, usage and cost, with safe request parameters', async () => {
    const { client, calls } = fakeClient([{ parsed_output: good }]);
    const r = await generateArticle(client, 'claude-haiku-5-5', input, world);
    expect(r.article).toEqual(good);
    expect(r.check?.passed).toBe(true);
    expect(r.attempts).toBe(1);
    expect(r.usage).toEqual({ inputTokens: 600, outputTokens: 150 });
    expect(r.cost).toBeCloseTo((600 * 0.1 + 150 * 0.5) / 1e6, 12);
    const p = calls[0]!;
    expect(p).not.toHaveProperty('temperature');
    expect(p).not.toHaveProperty('top_p');
    expect(p['thinking']).toEqual({ type: 'disabled' });
    expect((p['output_config'] as { effort: string }).effort).toBe('low');
    const messages = p['messages'] as { role: string }[];
    expect(messages.at(-1)?.role).toBe('user');
  });

  it('writes again once when the fact check fails, and adds up both calls', async () => {
    const bad = { ...good, body: good.body.replace('44,812', '50,000') };
    const { client, calls } = fakeClient([{ parsed_output: bad }, { parsed_output: good }]);
    const r = await generateArticle(client, 'claude-haiku-5-5', input, world);
    expect(calls).toHaveLength(2);
    expect(r.attempts).toBe(2);
    expect(r.check?.passed).toBe(true);
    expect(r.usage.inputTokens).toBe(1200);
  });

  it('gives back the failing check when the retry fails too', async () => {
    const bad = { ...good, body: good.body.replace('44,812', '50,000') };
    const { client } = fakeClient([{ parsed_output: bad }]);
    const r = await generateArticle(client, 'claude-haiku-5-5', input, world);
    expect(r.check?.passed).toBe(false);
    expect(r.check?.flags[0]?.text).toBe('50,000');
  });

  it('does not retry a refusal and returns no article (the game then uses the template)', async () => {
    const { client, calls } = fakeClient([{ stop_reason: 'refusal' }]);
    const r = await generateArticle(client, 'claude-haiku-5-5', input, world);
    expect(calls).toHaveLength(1);
    expect(r.article).toBeNull();
    expect(r.failure).toBe('refusal');
  });

  it('reports a truncated answer', async () => {
    const { client } = fakeClient([{ stop_reason: 'max_tokens' }]);
    expect((await generateArticle(client, 'claude-haiku-5-5', input, world, 1)).failure).toBe('max_tokens');
  });
});
