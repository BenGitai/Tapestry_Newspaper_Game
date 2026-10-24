import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import { TIERS } from '../sim/balance.ts';
import { DESK_VOICE, HEADLINE_MAX_WORDS } from './config.ts';
import { buildPrompt, SYSTEM_PROMPT } from './prompt.ts';

const { world, stories } = loadGameData();
const normal = stories.storyById('d1-phillies')!;
const sensitive = stories.allStories().find((s) => s.sensitivity === 'high')!;
const reporter = world.staff_pool[0]!;

describe('buildPrompt', () => {
  it('lists every fact with its index, plus the wire text', () => {
    const p = buildPrompt({ story: normal, angle: 'straight', tier: 'lead' });
    normal.facts.forEach((f, i) => expect(p.user).toContain(`[${i}] ${f}`));
    expect(p.user).toContain(normal.wire_text);
    expect(p.user).toContain(normal.wire_headline);
  });

  it('carries the no-invention rules and never mentions AI to the reader', () => {
    expect(SYSTEM_PROMPT).toMatch(/ONLY the numbered facts/);
    expect(SYSTEM_PROMPT).toMatch(/Never invent quotes, names, numbers, dates/);
    expect(SYSTEM_PROMPT).toMatch(/keep it uncertain/);
    expect(SYSTEM_PROMPT).toMatch(/Never mention AI/);
    expect(SYSTEM_PROMPT).toMatch(/facts_used/);
  });

  it('gives each angle its own instruction and keeps the facts the same', () => {
    const [puff, straight, hard] = (['puff', 'straight', 'hard'] as const).map((angle) => buildPrompt({ story: normal, angle, tier: 'secondary' }));
    expect(puff?.user).toMatch(/PUFF/);
    expect(straight?.user).toMatch(/STRAIGHT/);
    expect(hard?.user).toMatch(/HARD-HITTING/);
    const factBlock = (s: string) => s.slice(s.indexOf('Facts:'));
    expect(factBlock(puff!.user)).toBe(factBlock(hard!.user));
  });

  it('forces sensitive stories to a plain angle and adds the respectful note', () => {
    const p = buildPrompt({ story: sensitive, angle: 'puff', tier: 'secondary' });
    expect(p.angle).toBe('straight');
    expect(p.user).not.toMatch(/PUFF/);
    expect(p.user).toMatch(/SENSITIVE/);
    const h = buildPrompt({ story: sensitive, angle: 'hard', tier: 'secondary' });
    expect(h.angle).toBe('hard');
    expect(h.user).toMatch(/SENSITIVE/);
    expect(h.user).toMatch(/no sensational/);
    expect(buildPrompt({ story: normal, angle: 'straight', tier: 'brief' }).user).not.toMatch(/SENSITIVE/);
  });

  it('sets length and headline limits from the tier', () => {
    for (const tier of ['lead', 'secondary', 'brief'] as const) {
      const p = buildPrompt({ story: normal, angle: 'straight', tier });
      expect(p.user).toContain(`about ${TIERS[tier].words} words`);
      expect(p.user).toContain(`at most ${HEADLINE_MAX_WORDS[tier]} words`);
    }
    expect(buildPrompt({ story: normal, angle: 'straight', tier: 'lead' }).user).toMatch(/Deck: one sentence/);
    expect(buildPrompt({ story: normal, angle: 'straight', tier: 'brief' }).user).toMatch(/Deck: return an empty string/);
  });

  it('uses the reporter voice or the neutral desk voice, never the reporter name', () => {
    const j = buildPrompt({ story: normal, angle: 'straight', tier: 'lead', journalist: { name: reporter.name, voice: reporter.voice } });
    expect(j.user).toContain(reporter.voice);
    expect(j.user).not.toContain(reporter.name);
    expect(buildPrompt({ story: normal, angle: 'straight', tier: 'lead' }).user).toContain(DESK_VOICE);
  });

  it('names the paper only when given one', () => {
    expect(buildPrompt({ story: normal, angle: 'straight', tier: 'lead' }).user).toMatch(/do not name the newspaper/);
    const p = buildPrompt({ story: normal, angle: 'straight', tier: 'lead', paper: { name: 'The Ledger', stance: 'left' } });
    expect(p.user).toContain('Paper: The Ledger.');
    expect(p.user).toContain('left');
  });

  it('is deterministic', () => {
    const a = buildPrompt({ story: normal, angle: 'hard', tier: 'lead' });
    expect(buildPrompt({ story: normal, angle: 'hard', tier: 'lead' })).toEqual(a);
  });
});
