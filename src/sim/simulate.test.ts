import { describe, expect, it } from 'vitest';
import type { CityWorld, Story } from '../data/schemas.ts';
import type { StorySource } from '../data/StorySource.ts';
import { loadGameData } from '../data/worldData.ts';
import { ADVERTISERS, GENERATED_PER_DAY, WEEKLY_WIRE_SIZE } from './balance.ts';
import { newStoryBlock, putBlock } from './layout.ts';
import { writeLetters } from './letters.ts';
import { advanceIssue, createGame, defaultSetup, issueCount, type Hire } from './newGame.ts';
import { updateArticle, wireForIssue } from './newsroom.ts';
import { addNewsstand, openBureau, paperReport } from './paperStats.ts';
import { leanFit, totalReaders } from './readers.ts';
import { rivalFrontPage } from './rival.ts';
import { adsAvailable, resolveIssue } from './simulate.ts';
import { defaultAssignment, reporterById } from './staff.ts';
import type { Angle, GameState, PaperSetup, Stance } from './types.ts';

const { world, stories } = loadGameData();

function hires(ids: string[], w: CityWorld = world): Hire[] {
  return ids.map((id) => ({ reporterId: id, assignment: defaultAssignment(w, reporterById(w, id)!) }));
}

/** Put every filed article on the page (front first), with an optional forced angle. */
function printAll(g: GameState, src: StorySource = stories, angle?: Angle): GameState {
  let game = g;
  let row = 3;
  let col = 0;
  for (const a of g.articles.filter((x) => x.status === 'backlog')) {
    const story = src.storyById(a.storyId)!;
    game = updateArticle(game, a.id, { selected: true, ...(angle && !(angle === 'puff' && story.sensitivity === 'high') ? { angle } : {}) });
    const block = newStoryBlock({ ...story, base_column_inches: a.inches }, 'secondary', { col, row });
    const r = putBlock(game.draft, 'front', block);
    if (r.ok) game = { ...game, draft: r.draft };
    col += 2;
    if (col >= 6) {
      col = 0;
      row += 8;
    }
  }
  return game;
}

const MIRROR_STANCE: Record<Stance, Stance> = { left: 'right', center_left: 'center_right', neutral: 'neutral', center_right: 'center_left', right: 'left' };

function mirrorWorld(w: CityWorld): CityWorld {
  return { ...w, districts: w.districts.map((d) => ({ ...d, lean_mix: { left: d.lean_mix.right, center: d.lean_mix.center, right: d.lean_mix.left } })) };
}

/** The demo's whole news feed with every lean flipped. */
function mirrorStories(): StorySource {
  const flip = (s: Story | undefined): Story | undefined => s && { ...s, hard_hitting_lean: -s.hard_hitting_lean };
  return {
    wireSources: () => stories.wireSources(),
    storiesForDay: (d) => stories.storiesForDay(d).map((s) => flip(s)!),
    allStories: () => stories.allStories().map((s) => flip(s)!),
    dayCount: () => stories.dayCount(),
    storyById: (id) => flip(stories.storyById(id)),
  };
}

describe('political symmetry (mirror test)', () => {
  it('mirroring every lean, stance and district mix mirrors the results exactly', () => {
    const mw = mirrorWorld(world);
    const ms = mirrorStories();
    for (const stance of ['left', 'center_left', 'neutral'] as Stance[]) {
      for (const angle of ['hard', 'puff', 'straight'] as Angle[]) {
        const setup: PaperSetup = { ...defaultSetup(), stance };
        const a = printAll(createGame(setup, world, stories, hires(['okafor', 'tran', 'brenner']), 42), stories, angle);
        const b = printAll(createGame({ ...setup, stance: MIRROR_STANCE[stance] }, mw, ms, hires(['okafor', 'tran', 'brenner'], mw), 42), ms, angle);
        const ra = resolveIssue(a, world, stories);
        const rb = resolveIssue(b, mw, ms);
        expect(rb.game.perceivedLean).toBeCloseTo(-ra.game.perceivedLean, 10);
        expect(rb.result.copies).toBe(ra.result.copies);
        expect(rb.result.profit).toBe(ra.result.profit);
        for (const d of world.districts) {
          expect(rb.game.districts[d.id]!.trust).toBeCloseTo(ra.game.districts[d.id]!.trust, 10);
          expect(rb.game.districts[d.id]!.readers).toBe(ra.game.districts[d.id]!.readers);
        }
      }
    }
  });

  it('lean fit is mirror-symmetric', () => {
    for (const d of world.districts) {
      const mirrored = { lean_mix: { left: d.lean_mix.right, center: d.lean_mix.center, right: d.lean_mix.left } };
      for (const lean of [-1, -0.4, 0, 0.3, 1]) expect(leanFit(mirrored, -lean)).toBeCloseTo(leanFit(d, lean), 10);
    }
  });
});

describe('resolving an issue', () => {
  const base = () => createGame(defaultSetup(), world, stories, hires(['okafor', 'kowalczyk', 'tran']), 7);

  it('is deterministic for a seed', () => {
    const g = printAll(base());
    expect(resolveIssue(g, world, stories).result).toEqual(resolveIssue(g, world, stories).result);
  });

  it('the books balance: cash moves by exactly the profit', () => {
    const g = printAll(base());
    const { game, result } = resolveIssue(g, world, stories);
    const { revenue, costs } = result;
    expect(result.profit).toBe(revenue.sales + revenue.ads + revenue.prizes - costs.printing - costs.distribution - costs.payroll - costs.overhead - costs.wire - costs.debt);
    expect(game.cash).toBe(g.cash + result.profit);
    expect(result.copies).toBe(totalReaders(game.districts));
  });

  it('a full paper sells better than an empty one', () => {
    const full = resolveIssue(printAll(base()), world, stories).result;
    const empty = resolveIssue(base(), world, stories).result;
    expect(full.copies).toBeGreaterThan(empty.copies);
    expect(empty.copiesChange).toBeLessThan(0);
  });

  it('missing the big story the rival led with is noticed', () => {
    const g = base();
    const { result } = resolveIssue(g, world, stories);
    expect(result.rivalFront[0]).toBe(rivalFrontPage(stories.storiesForDay(1))[0]);
    expect(result.missed.length).toBeGreaterThan(0);
    expect(result.events.some((e) => e.includes('The Herald led with'))).toBe(true);
  });

  it('hammering an advertiser makes them pull their ads', () => {
    let g = printAll(base(), stories, 'hard');
    let pulled = false;
    for (let i = 0; i < 3 && !pulled; i++) {
      g = resolveIssue({ ...g, issueNumber: 1 + i }, world, stories).game;
      pulled = !adsAvailable({ ...g, issueNumber: 2 + i }, 'city_hall');
    }
    expect(pulled).toBe(true);
    expect(g.advertisers.city_hall!.relationship).toBeLessThan(ADVERTISERS.start);
  });

  it('tracks what was published for stated-vs-actual', () => {
    const { game } = resolveIssue(printAll(base()), world, stories);
    expect(game.publishedInches.politics).toBeGreaterThan(0);
    const rep = paperReport(game);
    expect(rep.coverage.reduce((a, c) => a + c.actual, 0)).toBeCloseTo(1, 5);
  });

  it('running out of money ends the game', () => {
    const broke = { ...base(), cash: -5000 };
    expect(resolveIssue(broke, world, stories).game.endReason).toBe('bankrupt');
  });
});

describe('the rival', () => {
  it('leads with the most important politics or economy story and keeps routine sports off the front', () => {
    const day3 = stories.storiesForDay(3);
    const front = rivalFrontPage(day3);
    expect(front[0]).toBe('d3-farevote');
    expect(front).not.toContain('d3-phillies'); // a loss, not a playoff win
  });
});

describe('district actions', () => {
  it('newsstands and bureaus cost money and have limits', () => {
    let g = createGame(defaultSetup(), world, stories, hires(['okafor', 'tran']), 1);
    const r = openBureau(g, world, 'north_philly');
    if (!r.ok) throw new Error(r.reason);
    expect(r.game.cash).toBe(g.cash - world.pricing.bureau_cost);
    expect(openBureau(r.game, world, 'north_philly').ok).toBe(false);
    g = r.game;
    for (let i = 0; i < 4; i++) {
      const n = addNewsstand(g, world, 'north_philly');
      if (!n.ok) throw new Error(n.reason);
      g = n.game;
    }
    expect(addNewsstand(g, world, 'north_philly').ok).toBe(false);
  });
});

describe('letters', () => {
  it('are deterministic and drawn from the cues', () => {
    const cues = [
      { kind: 'missed' as const, headline: 'Transit board approves fare increase', district: 'northeast' },
      { kind: 'great_issue' as const, district: 'south_philly' },
    ];
    const a = writeLetters(world, cues, 99);
    expect(a).toEqual(writeLetters(world, cues, 99));
    expect(a).toHaveLength(2);
    expect(a.map((l) => l.tone).sort()).toEqual(['complaint', 'praise']);
    expect(a.find((l) => l.tone === 'complaint')!.text).toContain('Transit board approves fare increase');
  });
});

describe('a full game', () => {
  for (const frequency of ['daily', 'weekly'] as const) {
    it(`a ${frequency} paper plays all 10 issues`, () => {
      const setup: PaperSetup = { ...defaultSetup(), frequency, origin: 'inherited' };
      let g = createGame(setup, world, stories, hires(['okafor', 'kowalczyk', 'tran', 'hale']), 5);
      const seen = new Set<string>();
      for (let i = 1; i <= 10; i++) {
        expect(g.issueNumber).toBe(i);
        const wire = wireForIssue(g, stories);
        expect(wire.length).toBe(frequency === 'daily' ? GENERATED_PER_DAY : WEEKLY_WIRE_SIZE);
        for (const s of wire) {
          expect(seen.has(s.id)).toBe(false); // every issue brings new news
          seen.add(s.id);
        }
        g = resolveIssue(printAll(g), world, stories).game;
        expect(g.endReason).toBeUndefined();
        if (i < 10) g = advanceIssue(g, world, stories);
      }
      expect(g.results).toHaveLength(10);
      expect(issueCount(frequency, stories.dayCount())).toBe(10);
    });
  }

  it('there is more news than space: four reporters file more than fits on two pages', () => {
    for (const frequency of ['daily', 'weekly'] as const) {
      const g = createGame({ ...defaultSetup(), frequency }, world, stories, hires(['okafor', 'kowalczyk', 'tran', 'hale']), 5);
      const filedArea = g.articles.reduce((a, x) => a + x.inches * 1.4, 0); // text plus headline and gutter
      const twoPages = 6 * 17 + 6 * 19;
      if (frequency === 'weekly') expect(filedArea).toBeGreaterThan(twoPages);
      expect(wireForIssue(g, stories).reduce((a, s) => a + s.base_column_inches * 1.4, 0)).toBeGreaterThan(twoPages);
      expect(g.articles.length).toBeGreaterThanOrEqual(frequency === 'daily' ? 8 : 18);
    }
  });
});
