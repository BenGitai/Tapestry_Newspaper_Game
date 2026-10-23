import { describe, expect, it } from 'vitest';
import type { Story } from '../data/schemas.ts';
import { loadGameData } from '../data/worldData.ts';
import { isSensational, scorecard } from './scorecard.ts';
import { defaultAssignment, newStaffMember, reporterById } from './staff.ts';
import type { Angle, Article } from './types.ts';

const { world, stories } = loadGameData();

function article(storyId: string, reporterId: string | null, angle: Angle, extra: Partial<Article> = {}): Article {
  return {
    id: `${storyId}@1`,
    storyId,
    reporterId,
    angle,
    style: 'news',
    inches: 10,
    issueFiled: 1,
    commissioned: false,
    onPatch: false,
    favorite: false,
    selected: false,
    status: 'backlog',
    ...extra,
  };
}

function card(storyId: string, reporterId: string | null, angle: Angle, story?: Story) {
  const s = story ?? stories.storyById(storyId)!;
  const r = reporterId ? reporterById(world, reporterId) : undefined;
  const member = r ? newStaffMember(world, r, 1, 50, defaultAssignment(world, r)) : undefined;
  return scorecard(article(storyId, reporterId, angle), s, world, member);
}

describe('scorecard', () => {
  it('political heat is symmetric: mirroring a story’s lean gives identical heat', () => {
    for (const s of stories.allStories()) {
      const mirrored = { ...s, hard_hitting_lean: -s.hard_hitting_lean };
      for (const angle of ['puff', 'straight', 'hard'] as Angle[]) {
        for (const rep of ['okafor', 'brenner', null]) {
          const a = card(s.id, rep, angle, s);
          const b = card(s.id, rep, angle, mirrored);
          expect(b.shown).toEqual(a.shown);
          expect(b.hidden).toEqual(a.hidden);
        }
      }
    }
  });

  it('hard-hitting a targeted institution makes heat and names who is upset', () => {
    const c = card('d1-library', 'okafor', 'hard');
    expect(c.shown.upsets).toEqual(['City Hall']);
    expect(c.shown.heat).toBeGreaterThan(card('d1-library', 'okafor', 'straight').shown.heat);
  });

  it('a charged, tactless reporter turns hard-hitting into sensational', () => {
    const brenner = reporterById(world, 'brenner')!;
    const tran = reporterById(world, 'tran')!;
    const fire = stories.storyById('d2-fire')!;
    expect(isSensational({ angle: 'hard' }, fire, brenner.attributes)).toBe(true);
    expect(isSensational({ angle: 'hard' }, fire, tran.attributes)).toBe(false);
    expect(card('d2-fire', 'brenner', 'hard').shown.trust).toBeLessThan(card('d2-fire', 'tran', 'hard').shown.trust);
  });

  it('sensational coverage raises the award chance (big swings)', () => {
    const story = stories.storyById('d3-farevote')!;
    const sens = card('d3-farevote', 'brenner', 'hard', story);
    const calm = card('d3-farevote', 'brenner', 'straight', story);
    expect(sens.shown.sensational).toBe(true);
    expect(sens.hidden.awardChance).toBeGreaterThan(calm.hidden.awardChance);
  });

  it('accurate reporters carry less correction risk', () => {
    expect(card('d1-library', 'ferraro', 'straight').hidden.correctionRisk).toBeLessThan(card('d1-library', 'brenner', 'straight').hidden.correctionRisk);
  });

  it('puff on a serious story costs trust', () => {
    expect(card('d1-fares', 'hale', 'puff').shown.trust).toBeLessThan(0);
  });

  it('stale articles are worth less', () => {
    const s = stories.storyById('d1-library')!;
    const fresh = scorecard(article(s.id, null, 'straight'), s, world, undefined, 1);
    const stale = scorecard(article(s.id, null, 'straight'), s, world, undefined, 0.5);
    expect(stale.shown.readership).toBeLessThan(fresh.shown.readership);
  });
});
