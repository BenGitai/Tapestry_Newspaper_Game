import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data/worldData.ts';
import type { Story } from '../data/schemas.ts';
import { extractNumbers, factCheck, gameNames, unknownNames, wordSet } from './factcheck.ts';
import type { ArticleText } from './types.ts';

const { world, stories } = loadGameData();
const story = stories.storyById('d1-phillies') as Story;

const vals = (t: string) => extractNumbers(t).map((n) => n.value);

describe('extractNumbers', () => {
  it('normalizes commas, dollar signs and scale words', () => {
    expect(vals('The crowd was 44,812.')).toEqual([44812]);
    expect(vals('$1,200 a month')).toEqual([1200]);
    expect(vals('a $2.5 million fund')).toEqual([2_500_000]);
    expect(vals('2,500,000 dollars')).toEqual([2_500_000]);
    expect(vals('3 billion and 4 thousand')).toEqual([3e9, 4000]);
  });

  it('reads number words, including compounds', () => {
    expect(vals('twelve people')).toEqual([12]);
    expect(vals('twenty-five cents')).toEqual([25]);
    expect(vals('two hundred and fifty riders')).toEqual([250]);
    expect(vals('three million visitors')).toEqual([3_000_000]);
    expect(vals('a dozen stalls')).toEqual([12]);
  });

  it('treats a lone "one" as a pronoun, not a count', () => {
    expect(vals('No one was hurt. One of them left.')).toEqual([]);
    expect(vals('twenty-one tickets')).toEqual([21]);
  });

  it('splits scores and times into their numbers', () => {
    expect(vals('won 5-3')).toEqual([5, 3]);
    expect(vals('at 6:30')).toEqual([6, 30]);
  });

  it('does not read number words inside other words', () => {
    expect(vals('someone phoned a tenant about the stone wall')).toEqual([]);
  });

  it('reports positions for highlighting', () => {
    const [n] = extractNumbers('Crowd of 44,812 fans');
    expect(n && 'Crowd of 44,812 fans'.slice(n.start, n.end)).toBe('44,812');
  });
});

describe('unknownNames', () => {
  const allowed = wordSet('The Phillies beat the Mets in South Philadelphia', 'Danny Ocasio');
  const names = (t: string) => unknownNames(t, allowed).map((n) => n.text);

  it('passes names that appear in the source', () => {
    expect(names('Danny Ocasio drove in three runs. The Phillies won in South Philadelphia.')).toEqual([]);
  });

  it('flags an invented name', () => {
    expect(names('Manager Hargrove said the team was ready.')).toEqual(['Manager', 'Hargrove']);
  });

  it('flags an invented name at the start of a sentence when a capital follows', () => {
    expect(names('Councilmember Reyes spoke.')).toEqual(['Councilmember', 'Reyes']);
  });

  it('skips a lone sentence-initial word', () => {
    expect(names('Residents were told to wait.')).toEqual([]);
  });

  it('ignores possessives and hyphen parts', () => {
    expect(names("The Phillies' win and Ocasio's double beat the Mets-friendly crowd.")).toEqual([]);
  });

  it('does not flag common capitalized words or title-case words found in the source', () => {
    expect(names('The Phillies Beat The Mets')).toEqual([]);
  });

  it('flags a capitalized word that is nowhere in the source, even in a headline', () => {
    expect(names('Phillies Stun Yankees')).toEqual(['Stun', 'Yankees']);
  });
});

describe('factCheck', () => {
  const good: ArticleText = {
    headline: 'Phillies take Game 1 of NLCS, 5-3',
    deck: '',
    body: 'The Phillies won Game 1 of the National League Championship Series 5-3 at home. Rookie shortstop Danny Ocasio drove in three runs, including a two-run double in the sixth inning. The announced crowd was 44,812.',
    facts_used: [0, 1, 2],
  };

  it('passes text that sticks to the facts', () => {
    const r = factCheck(good, story, 'secondary');
    expect(r.flags).toEqual([]);
    expect(r.problems).toEqual([]);
    expect(r.passed).toBe(true);
  });

  it('accepts equivalent number forms', () => {
    const r = factCheck({ ...good, body: good.body.replace('44,812', '44812').replace('three runs', 'three runs') }, story, 'secondary');
    expect(r.flags).toEqual([]);
  });

  it('flags an invented number with its position', () => {
    const body = good.body.replace('44,812', '45,000');
    const r = factCheck({ ...good, body }, story, 'secondary');
    expect(r.passed).toBe(false);
    const f = r.flags.find((x) => x.kind === 'number');
    expect(f?.text).toBe('45,000');
    expect(f && body.slice(f.start, f.end)).toBe('45,000');
    expect(f?.field).toBe('body');
  });

  it('flags a number spelled out that is not in the source', () => {
    const r = factCheck({ ...good, body: good.body + ' Seven fans were removed.' }, story, 'secondary');
    expect(r.flags.map((f) => f.text)).toContain('Seven');
  });

  it('flags an invented name and an invented quote speaker', () => {
    const r = factCheck({ ...good, body: good.body + ' Manager Dusty Baker said "we were ready."' }, story, 'secondary');
    expect(r.flags.filter((f) => f.kind === 'name').map((f) => f.text)).toEqual(expect.arrayContaining(['Dusty', 'Baker']));
  });

  it('checks the headline and the deck too', () => {
    const r = factCheck({ ...good, headline: 'Phillies win 9-3', deck: 'Mayor Cherelle Parker cheers' }, story, 'lead');
    expect(r.flags.filter((f) => f.field === 'headline').map((f) => f.text)).toEqual(['9']);
    expect(r.flags.filter((f) => f.field === 'deck').length).toBeGreaterThan(0);
  });

  it('allows names from game data and extra names', () => {
    const w = { ...good, body: good.body + ' The Kensington crowd stayed. Reporter Rosa Okafor filed this.' };
    expect(factCheck(w, story, 'secondary').passed).toBe(false);
    const names = gameNames(world, 'Tapestry Ledger');
    expect(names).toContain('Tapestry Ledger');
    const staff = world.staff_pool[0]!.name;
    const hood = world.districts.flatMap((d) => d.example_neighborhoods)[0]!;
    const r = factCheck({ ...good, body: `${good.body} ${hood} fans cheered, as ${staff} noted.` }, story, 'secondary', names);
    expect(r.flags).toEqual([]);
  });

  it('reports structural problems', () => {
    const long = factCheck({ ...good, headline: 'The Phillies took the first game of the series five to three at home' }, story, 'brief');
    expect(long.problems.some((p) => p.startsWith('Headline has'))).toBe(true);
    const empty = factCheck({ ...good, body: '' }, story, 'secondary');
    expect(empty.problems).toContain('Empty body');
    const idx = factCheck({ ...good, facts_used: [0, 9] }, story, 'secondary');
    expect(idx.problems.some((p) => p.includes('index 9'))).toBe(true);
    const wordy = factCheck({ ...good, body: Array(200).fill('won').join(' ') }, story, 'secondary');
    expect(wordy.problems.some((p) => p.startsWith('Body has 200'))).toBe(true);
  });
});

describe('every story passes its own template', () => {
  it('the template fallback uses only facts, so the check passes on the hand-written stories', () => {
    for (let d = 1; d <= 4; d++) {
      for (const s of stories.storiesForDay(d)) {
        const text: ArticleText = { headline: s.wire_headline, deck: '', body: s.facts.join(' '), facts_used: s.facts.map((_, i) => i) };
        const r = factCheck(text, s, 'lead', gameNames(world));
        expect(r.flags, s.id).toEqual([]);
      }
    }
  });
});

describe('body length', () => {
  it('does not ask a thin story to fill a long slot', () => {
    // d1-phillies has about 45 words of facts; a lead target of 120 words must not demand padding.
    const short: ArticleText = { headline: 'Phillies win Game 1', deck: '', body: story.facts.slice(0, 3).join(' '), facts_used: [0, 1, 2] };
    expect(factCheck(short, story, 'lead').problems).toEqual([]);
    expect(factCheck({ ...short, body: 'Won.' }, story, 'lead').problems.some((p) => p.startsWith('Body has only'))).toBe(true);
  });
});

describe('number words at the start of a sentence', () => {
  it('are checked as numbers, not flagged as names', () => {
    const story = loadGameData().stories.storyById('d1-robotics')!;
    const ok = factCheck({ headline: 'Robotics team heads to finals', deck: '', body: 'Fourteen Kensington students built the robot.', facts_used: [1] }, story, 'brief');
    expect(ok.flags).toEqual([]);
    const bad = factCheck({ headline: 'Robotics team heads to finals', deck: '', body: 'Fifteen Kensington students built the robot.', facts_used: [1] }, story, 'brief');
    expect(bad.flags.map((x) => x.kind)).toEqual(['number']);
  });

  it('length overruns are warnings unless far off target', () => {
    const story = loadGameData().stories.storyById('d1-robotics')!;
    const r = factCheck({ headline: 'Kensington robotics team of students heads to the finals', deck: '', body: 'A Kensington public high school robotics team qualified for a national championship in Houston next month. The team has 14 students.', facts_used: [0, 1] }, story, 'brief');
    expect(r.passed).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
