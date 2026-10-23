// The newsroom: reporters file articles from their assignments, the editor
// commissions extra pieces, and unpublished work waits in the backlog.
import type { Angle, CityWorld, Story } from '../data/schemas.ts';
import type { StorySource } from '../data/StorySource.ts';
import { STALENESS_FLOOR, STALENESS_PER_ISSUE, STYLE, SUPERSEDED_VALUE } from './balance.ts';
import { findStoryBlock } from './layout.ts';
import { issueDays } from './calendar.ts';
import { activeStaff, filingCapacity, reporterById } from './staff.ts';
import type { Article, GameState, StaffMember, WritingStyle } from './types.ts';

export function wireForIssue(game: Pick<GameState, 'setup' | 'issueNumber'>, stories: StorySource): Story[] {
  return issueDays(game.setup.frequency, game.issueNumber, stories.dayCount()).flatMap((d) => stories.storiesForDay(d));
}

export function articleId(storyId: string, issue: number): string {
  return `${storyId}@${issue}`;
}

/** Sensitive stories never run Puff: a feature writer covers them straight. */
export function angleFor(style: WritingStyle, story: Pick<Story, 'sensitivity'>): Angle {
  const a = STYLE[style].angle as Angle;
  return a === 'puff' && story.sensitivity === 'high' ? 'straight' : a;
}

export function articleInches(story: Pick<Story, 'base_column_inches'>, style: WritingStyle): number {
  return Math.round(story.base_column_inches * STYLE[style].length);
}

/** Is this story inside the reporter's assignment? */
export function onAssignment(member: StaffMember, story: Story): { beat: boolean; patch: boolean } {
  const a = member.assignment;
  const beat = story.category === a.beat;
  const patch = a.patch === 'citywide' || story.districts.includes(a.patch);
  return { beat, patch };
}

export function inchesFiled(game: Pick<GameState, 'articles' | 'issueNumber'>, reporterId: string): number {
  return game.articles.filter((a) => a.reporterId === reporterId && a.issueFiled === game.issueNumber).reduce((s, a) => s + a.inches, 0);
}

/**
 * Can this reporter take on a piece of this length now? Capacity limits extra
 * pieces, but everyone can file their first piece of the issue, however long.
 */
export function hasRoomFor(game: Pick<GameState, 'articles' | 'issueNumber'>, world: CityWorld, member: StaffMember, inches: number): boolean {
  return inchesFiled(game, member.reporterId) === 0 || inches <= remainingCapacity(game, world, member);
}

export function remainingCapacity(game: Pick<GameState, 'articles' | 'issueNumber'>, world: CityWorld, member: StaffMember): number {
  const r = reporterById(world, member.reporterId);
  return r ? filingCapacity(r, member) - inchesFiled(game, member.reporterId) : 0;
}

/** A story is covered once any non-spiked article of it exists. */
export function isCovered(game: Pick<GameState, 'articles'>, storyId: string): boolean {
  return game.articles.some((a) => a.storyId === storyId && a.status !== 'spiked');
}

/**
 * Start-of-issue filing: each working reporter files the most important wire
 * stories on their beat and patch, until their capacity runs out. Faster
 * reporters pick first. Deterministic, so the same choices give the same paper.
 */
export function fileBeatArticles(game: GameState, world: CityWorld, stories: StorySource): GameState {
  const wire = wireForIssue(game, stories);
  let state = game;
  const order = [...activeStaff(game)].sort((a, b) => {
    const ra = reporterById(world, a.reporterId);
    const rb = reporterById(world, b.reporterId);
    return (rb?.attributes.speed ?? 0) - (ra?.attributes.speed ?? 0) || a.reporterId.localeCompare(b.reporterId);
  });
  for (const member of order) {
    const candidates = wire
      .filter((s) => !isCovered(state, s.id))
      .map((s) => ({ s, fit: onAssignment(member, s) }))
      .filter(({ fit }) => fit.beat && fit.patch)
      .sort((a, b) => b.s.importance - a.s.importance || Number(b.s.districts.includes(member.assignment.patch)) - Number(a.s.districts.includes(member.assignment.patch)) || a.s.filed_at.localeCompare(b.s.filed_at));
    for (const { s } of candidates) {
      const inches = articleInches(s, member.assignment.style);
      if (!hasRoomFor(state, world, member, inches)) continue;
      state = { ...state, articles: [...state.articles, makeArticle(state, member, s, false)] };
    }
  }
  return state;
}

function makeArticle(game: GameState, member: StaffMember, story: Story, commissioned: boolean, angle?: Angle): Article {
  const style = member.assignment.style;
  return {
    id: articleId(story.id, game.issueNumber),
    storyId: story.id,
    reporterId: member.reporterId,
    angle: angle ?? angleFor(style, story),
    style,
    inches: articleInches(story, style),
    issueFiled: game.issueNumber,
    commissioned,
    onPatch: member.assignment.patch !== 'citywide' && story.districts.includes(member.assignment.patch),
    favorite: false,
    selected: false,
    status: 'backlog',
  };
}

export type NewsroomEdit = { ok: true; game: GameState } | { ok: false; reason: string };

/** The editor asks a reporter to write a specific wire story this issue. Uses their capacity. */
export function commission(game: GameState, world: CityWorld, stories: StorySource, storyId: string, reporterId: string | null, angle?: Angle): NewsroomEdit {
  const story = stories.storyById(storyId);
  if (!story) return { ok: false, reason: 'Unknown story' };
  if (!wireForIssue(game, stories).some((s) => s.id === storyId)) return { ok: false, reason: 'That story is not on this issue’s wire' };
  if (isCovered(game, storyId)) return { ok: false, reason: 'Someone has already filed that story' };
  if (angle === 'puff' && story.sensitivity === 'high') return { ok: false, reason: 'Sensitive stories cannot take the Puff angle' };

  if (reporterId === null) {
    // Run the wire copy as-is: no byline, straight, no reporter time.
    const wireCopy: Article = {
      id: articleId(story.id, game.issueNumber),
      storyId,
      reporterId: null,
      angle: 'straight',
      style: 'news',
      inches: story.base_column_inches,
      issueFiled: game.issueNumber,
      commissioned: true,
      onPatch: false,
      favorite: false,
      selected: true,
      status: 'backlog',
    };
    return { ok: true, game: { ...game, articles: [...game.articles, wireCopy] } };
  }

  const member = activeStaff(game).find((m) => m.reporterId === reporterId);
  const r = reporterById(world, reporterId);
  if (!member || !r) return { ok: false, reason: 'That reporter is not working this issue' };
  const inches = articleInches(story, member.assignment.style);
  const room = remainingCapacity(game, world, member);
  if (!hasRoomFor(game, world, member, inches)) return { ok: false, reason: `${r.name} has ${Math.max(0, Math.floor(room))} in left this issue; this piece needs ${inches}` };
  return { ok: true, game: { ...game, articles: [...game.articles, { ...makeArticle(game, member, story, true, angle), selected: true }] } };
}

export function updateArticle(game: GameState, id: string, patch: Partial<Pick<Article, 'favorite' | 'selected' | 'angle' | 'status'>>): GameState {
  return { ...game, articles: game.articles.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
}

/** Articles on the editor's desk: everything unpublished and not spiked. */
export function backlog(game: Pick<GameState, 'articles'>): Article[] {
  return game.articles.filter((a) => a.status === 'backlog');
}

export function selectedForPrint(game: Pick<GameState, 'articles'>): Article[] {
  return backlog(game).filter((a) => a.selected);
}

export function articleForStory(game: Pick<GameState, 'articles'>, storyId: string): Article | undefined {
  return game.articles.find((a) => a.storyId === storyId && a.status === 'backlog');
}

/** How much an article is still worth: fades in the backlog, and drops once its storyline moves on. */
export function freshness(article: Article, game: Pick<GameState, 'setup' | 'issueNumber'>, stories: StorySource): { value: number; superseded: boolean } {
  const age = Math.max(0, game.issueNumber - article.issueFiled);
  let value = Math.max(STALENESS_FLOOR, 1 - age * STALENESS_PER_ISSUE);
  const story = stories.storyById(article.storyId);
  let superseded = false;
  if (story?.storyline && story.storyline_step !== undefined) {
    superseded = wireForIssue(game, stories).some((s) => s.storyline === story.storyline && (s.storyline_step ?? 0) > (story.storyline_step ?? 0));
    if (superseded) value *= SUPERSEDED_VALUE;
  }
  return { value, superseded };
}

/** After printing: articles on the page are published; everything else stays in the backlog, unselected. */
export function settleAfterPrint(game: GameState): { game: GameState; publishedBy: Record<string, number> } {
  const publishedBy: Record<string, number> = {};
  const articles = game.articles.map((a) => {
    if (a.status !== 'backlog') return a;
    const placed = findStoryBlock(game.draft, a.storyId);
    if (placed) {
      if (a.reporterId) publishedBy[a.reporterId] = (publishedBy[a.reporterId] ?? 0) + 1;
      return { ...a, status: 'published' as const, issuePublished: game.issueNumber, selected: false };
    }
    return { ...a, selected: false };
  });
  return { game: { ...game, articles }, publishedBy };
}
