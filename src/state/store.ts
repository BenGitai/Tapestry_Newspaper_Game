// Zustand store: holds state and wires UI events to the pure rules in src/sim.
import { create } from 'zustand';
import type { Angle } from '../data/schemas.ts';
import { loadGameData } from '../data/worldData.ts';
import { activePages, findStoryBlock, removeBlock, storyBlockId, type EditResult } from '../sim/layout.ts';
import { advanceIssue, createGame, formatIssueDate, issueCount, issueDate, type Hire } from '../sim/newGame.ts';
import { articleForStory, commission as commissionStory, updateArticle, type NewsroomEdit } from '../sim/newsroom.ts';
import { checkReferences, hire as hireReporter, release as releaseReporter, setAssignment as queueAssignment, type StaffEdit } from '../sim/staff.ts';
import type { Article, DeskDuties, GameState, IssueDraft, PageId, PaperSetup, StaffAssignment } from '../sim/types.ts';
import { promote as promoteToHead, setDuties as setHeadDuties, stepDown as stepDownHead, type DeskEdit } from '../sim/desks.ts';
import { addNewsstand as buyNewsstand, openBureau as buyBureau, type DistrictEdit } from '../sim/paperStats.ts';
import { resolveIssue } from '../sim/simulate.ts';
import { saves, type SlotId } from './save.ts';

export type Screen = 'title' | 'setup' | 'hiring' | 'hub' | 'press' | 'end' | 'lab';
export type HubTab = 'newsroom' | 'layout' | 'staff' | 'map';

const HISTORY_LIMIT = 100;

interface Store {
  screen: Screen;
  hubTab: HubTab;
  /** Setup form result, waiting for the hiring screen. */
  pendingSetup: PaperSetup | null;
  game: GameState | null;
  past: IssueDraft[];
  future: IssueDraft[];
  selectedBlockId: string | null;
  selectedArticleId: string | null;
  focusReporterId: string | null;
  currentPage: PageId;
  layoutTab: 'print' | 'ads';
  notice: { text: string; at: number } | null;

  goto(screen: Screen): void;
  setHubTab(tab: HubTab): void;
  submitSetup(setup: PaperSetup): void;
  startGame(setup: PaperSetup, hires: Hire[]): void;
  notify(text: string): void;

  // layout
  edit(fn: (d: IssueDraft) => EditResult | IssueDraft, opts?: { select?: string | null }): boolean;
  undo(): void;
  redo(): void;
  selectBlock(blockId: string | null): void;
  setPage(page: PageId): void;
  setLayoutTab(t: 'print' | 'ads'): void;

  // newsroom
  selectArticle(id: string | null): void;
  focusReporter(id: string | null): void;
  toggleFavorite(id: string): void;
  toggleForPrint(id: string): void;
  setArticleAngle(id: string, angle: Angle): void;
  spike(id: string): void;
  commission(storyId: string, reporterId: string | null, angle?: Angle): boolean;

  // staff
  setAssignment(reporterId: string, asg: StaffAssignment): void;
  hire(reporterId: string): void;
  release(reporterId: string): void;
  checkReferences(reporterId: string): void;
  promote(reporterId: string): void;
  stepDown(reporterId: string): void;
  setDuties(reporterId: string, duties: DeskDuties): void;

  // city
  addNewsstand(districtId: string): void;
  openBureau(districtId: string): void;

  // turn
  sendToPress(): void;
  nextIssue(): void;

  // saves
  saveGame(slot: SlotId): void;
  loadGame(slot: SlotId): boolean;
}

export const useStore = create<Store>((set, get) => {
  /** Apply a whole-game change from the sim; show the reason if it was refused. */
  const apply = (fn: (g: GameState) => StaffEdit | NewsroomEdit | DistrictEdit | DeskEdit | GameState): boolean => {
    const game = get().game;
    if (!game) return false;
    const r = fn(game);
    if ('ok' in r) {
      if (!r.ok) {
        get().notify(r.reason);
        return false;
      }
      set({ game: r.game });
      return true;
    }
    set({ game: r });
    return true;
  };

  /** Take a story off the page if it's there (used when an article leaves the print pile). */
  const unplace = (game: GameState, storyId: string): GameState => {
    const found = findStoryBlock(game.draft, storyId);
    return found ? { ...game, draft: removeBlock(game.draft, storyBlockId(storyId)) } : game;
  };

  return {
    screen: 'title',
    hubTab: 'newsroom',
    pendingSetup: null,
    game: null,
    past: [],
    future: [],
    selectedBlockId: null,
    selectedArticleId: null,
    focusReporterId: null,
    currentPage: 'front',
    layoutTab: 'print',
    notice: null,

    goto: (screen) => set({ screen }),
    setHubTab: (hubTab) => set({ hubTab }),
    submitSetup: (pendingSetup) => set({ pendingSetup, screen: 'hiring' }),
    startGame: (setup, hires) => {
      const { world, stories } = loadGameData();
      const game = createGame(setup, world, stories, hires);
      saves.save('autosave', game);
      set({
        game,
        screen: 'hub',
        hubTab: 'newsroom',
        past: [],
        future: [],
        selectedBlockId: null,
        selectedArticleId: null,
        focusReporterId: null,
        currentPage: 'front',
      });
    },
    notify: (text) => set({ notice: { text, at: Date.now() } }),

    edit: (fn, opts) => {
      const game = get().game;
      if (!game) return false;
      const result = fn(game.draft);
      const next = 'ok' in result ? result : ({ ok: true, draft: result } as const);
      if (!next.ok) {
        get().notify(next.reason);
        return false;
      }
      if (next.draft === game.draft) return true;
      set((s) => ({
        game: { ...game, draft: next.draft },
        past: [...s.past.slice(-HISTORY_LIMIT + 1), game.draft],
        future: [],
        ...(opts && 'select' in opts ? { selectedBlockId: opts.select ?? null } : {}),
      }));
      return true;
    },
    undo: () => {
      const { game, past, future } = get();
      const prev = past[past.length - 1];
      if (!game || !prev) return;
      set({ game: { ...game, draft: prev }, past: past.slice(0, -1), future: [game.draft, ...future] });
    },
    redo: () => {
      const { game, past, future } = get();
      const next = future[0];
      if (!game || !next) return;
      set({ game: { ...game, draft: next }, past: [...past, game.draft], future: future.slice(1) });
    },
    selectBlock: (selectedBlockId) => set({ selectedBlockId }),
    setPage: (currentPage) => set({ currentPage }),
    setLayoutTab: (layoutTab) => set({ layoutTab }),

    selectArticle: (selectedArticleId) => set({ selectedArticleId }),
    focusReporter: (focusReporterId) => set({ focusReporterId }),
    toggleFavorite: (id) => apply((g) => updateArticle(g, id, { favorite: !g.articles.find((a) => a.id === id)?.favorite })),
    toggleForPrint: (id) =>
      apply((g) => {
        const a = g.articles.find((x) => x.id === id);
        if (!a) return g;
        const next = updateArticle(g, id, { selected: !a.selected });
        return a.selected ? unplace(next, a.storyId) : next;
      }),
    setArticleAngle: (id, angle) =>
      apply((g) => {
        const a = g.articles.find((x) => x.id === id);
        const story = a && loadGameData().stories.storyById(a.storyId);
        if (!a || !story) return g;
        if (a.reporterId === null && angle !== 'straight') return { ok: false, reason: 'Wire copy runs straight.' };
        if (story.sensitivity === 'high' && angle === 'puff') return { ok: false, reason: 'Sensitive stories cannot take the Puff angle.' };
        return updateArticle(g, id, { angle });
      }),
    spike: (id) =>
      apply((g) => {
        const a = g.articles.find((x) => x.id === id);
        if (!a) return g;
        return unplace(updateArticle(g, id, { status: 'spiked', selected: false, favorite: false }), a.storyId);
      }),
    commission: (storyId, reporterId, angle) => {
      const { world, stories } = loadGameData();
      return apply((g) => commissionStory(g, world, stories, storyId, reporterId, angle));
    },

    setAssignment: (reporterId, asg) => apply((g) => queueAssignment(g, reporterId, asg)),
    hire: (reporterId) => {
      const { world } = loadGameData();
      const morale = get().game ? world.origins[get().game!.setup.origin].morale : 50;
      apply((g) => hireReporter(g, world, reporterId, morale));
    },
    release: (reporterId) =>
      apply((g) => {
        const r = releaseReporter(g, loadGameData().world, reporterId);
        if (!r.ok) return r;
        // Their unpublished work leaves with them.
        let next = r.game;
        for (const a of next.articles.filter((x) => x.reporterId === reporterId && x.status === 'backlog')) {
          next = unplace(updateArticle(next, a.id, { status: 'spiked', selected: false }), a.storyId);
        }
        return next;
      }),
    checkReferences: (reporterId) => apply((g) => checkReferences(g, reporterId)),
    promote: (reporterId) => apply((g) => promoteToHead(g, loadGameData().world, reporterId)),
    stepDown: (reporterId) => apply((g) => stepDownHead(g, reporterId)),
    setDuties: (reporterId, duties) => apply((g) => setHeadDuties(g, reporterId, duties)),

    addNewsstand: (districtId) => apply((g) => buyNewsstand(g, loadGameData().world, districtId)),
    openBureau: (districtId) => apply((g) => buyBureau(g, loadGameData().world, districtId)),

    saveGame: (slot) => {
      const game = get().game;
      if (!game) return;
      get().notify(saves.save(slot, game) ? 'Saved.' : 'Could not save.');
    },
    loadGame: (slot) => {
      const game = saves.load(slot);
      if (!game) {
        get().notify('That save could not be loaded.');
        return false;
      }
      const lastPrinted = game.archive[game.archive.length - 1];
      const screen: Screen = game.finished ? 'end' : lastPrinted && lastPrinted.issueNumber === game.issueNumber ? 'press' : 'hub';
      set({ game, screen, hubTab: 'newsroom', past: [], future: [], selectedBlockId: null, selectedArticleId: null, focusReporterId: null, currentPage: 'front' });
      return true;
    },

    sendToPress: () => {
      const game = get().game;
      if (!game) return;
      const { stories } = loadGameData();
      const dateLabel = formatIssueDate(issueDate(game.setup.frequency, game.issueNumber));
      const articles: Record<string, Article> = {};
      for (const page of activePages(game.draft)) {
        for (const b of game.draft.pages[page]) {
          if (b.kind !== 'story') continue;
          const a = articleForStory(game, b.storyId);
          if (a) articles[b.storyId] = a;
        }
      }
      const archive = [...game.archive, { issueNumber: game.issueNumber, dateLabel, draft: game.draft, articles }];
      const { game: resolved } = resolveIssue({ ...game, archive }, loadGameData().world, stories);
      saves.save('autosave', resolved);
      set({ game: resolved, screen: 'press', selectedBlockId: null });
    },

    nextIssue: () => {
      const game = get().game;
      if (!game) return;
      const { world, stories } = loadGameData();
      if (game.endReason || game.issueNumber >= issueCount(game.setup.frequency, stories.dayCount())) {
        const done = { ...game, finished: true };
        saves.save('autosave', done);
        set({ game: done, screen: 'end' });
        return;
      }
      const next = advanceIssue(game, world, stories);
      saves.save('autosave', next);
      set({
        game: next,
        screen: 'hub',
        hubTab: 'newsroom',
        past: [],
        future: [],
        selectedBlockId: null,
        selectedArticleId: null,
        currentPage: 'front',
        layoutTab: 'print',
      });
    },
  };
});
