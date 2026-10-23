// Zustand store: holds state and wires UI events to the pure rules in src/sim.
import { create } from 'zustand';
import type { Angle, Story } from '../data/schemas.ts';
import { loadGameData } from '../data/worldData.ts';
import { emptyDraft, findStoryBlock, type EditResult } from '../sim/layout.ts';
import { createGame, formatIssueDate, issueCount, issueDate, issueDays } from '../sim/newGame.ts';
import type { GameState, IssueDraft, PageId, PaperSetup } from '../sim/types.ts';

export type Screen = 'title' | 'setup' | 'editor' | 'press' | 'lab' | 'end';
export type WireFilter = 'all' | 'local' | 'world' | 'politics' | 'economy' | 'social' | 'sports' | 'culture';

const HISTORY_LIMIT = 100;

interface Store {
  screen: Screen;
  game: GameState | null;
  past: IssueDraft[];
  future: IssueDraft[];
  selectedBlockId: string | null;
  currentPage: PageId;
  wireFilter: WireFilter;
  wireTab: 'wire' | 'ads';
  notice: { text: string; at: number } | null;

  goto(screen: Screen): void;
  startGame(setup: PaperSetup): void;
  /** Apply a layout edit. Failed edits show their reason and change nothing. */
  edit(fn: (d: IssueDraft) => EditResult | IssueDraft, opts?: { select?: string | null }): boolean;
  undo(): void;
  redo(): void;
  select(blockId: string | null): void;
  setPage(page: PageId): void;
  setWireFilter(f: WireFilter): void;
  setWireTab(t: 'wire' | 'ads'): void;
  notify(text: string): void;
  assignReporter(storyId: string, reporterId: string | null): void;
  setAngle(storyId: string, angle: Angle): void;
  sendToPress(): void;
  nextIssue(): void;
}

function setDraft(game: GameState, draft: IssueDraft): GameState {
  return { ...game, draft };
}

export const useStore = create<Store>((set, get) => ({
  screen: 'title',
  game: null,
  past: [],
  future: [],
  selectedBlockId: null,
  currentPage: 'front',
  wireFilter: 'all',
  wireTab: 'wire',
  notice: null,

  goto: (screen) => set({ screen }),

  startGame: (setup) => {
    const { world } = loadGameData();
    set({ game: createGame(setup, world), screen: 'editor', past: [], future: [], selectedBlockId: null, currentPage: 'front' });
  },

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
      game: setDraft(game, next.draft),
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
    set({ game: setDraft(game, prev), past: past.slice(0, -1), future: [game.draft, ...future] });
  },

  redo: () => {
    const { game, past, future } = get();
    const next = future[0];
    if (!game || !next) return;
    set({ game: setDraft(game, next), past: [...past, game.draft], future: future.slice(1) });
  },

  select: (blockId) => set({ selectedBlockId: blockId }),
  setPage: (page) => set({ currentPage: page }),
  setWireFilter: (wireFilter) => set({ wireFilter }),
  setWireTab: (wireTab) => set({ wireTab }),
  notify: (text) => set({ notice: { text, at: Date.now() } }),

  assignReporter: (storyId, reporterId) =>
    get().edit((d) => {
      const prev = d.assignments[storyId];
      // Wire copy runs straight: there's no reporter to give it an angle.
      const angle = reporterId === null ? 'straight' : (prev?.angle ?? 'straight');
      return { ...d, assignments: { ...d.assignments, [storyId]: { reporterId, angle } } };
    }),

  setAngle: (storyId, angle) =>
    get().edit((d) => {
      const prev = d.assignments[storyId] ?? { reporterId: null, angle: 'straight' as Angle };
      if (prev.reporterId === null && angle !== 'straight') return { ok: false, reason: 'Wire copy runs straight. Assign a reporter to choose an angle.' };
      const story = loadGameData().stories.storyById(storyId);
      if (story?.sensitivity === 'high' && angle === 'puff') return { ok: false, reason: 'Sensitive stories cannot take the Puff angle.' };
      return { ...d, assignments: { ...d.assignments, [storyId]: { ...prev, angle } } };
    }),

  sendToPress: () => {
    const game = get().game;
    if (!game) return;
    const { stories } = loadGameData();
    const dayCount = stories.dayCount();
    const dateLabel = formatIssueDate(issueDate(game.setup.frequency, game.issueNumber, dayCount));
    const archive = [...game.archive, { issueNumber: game.issueNumber, dateLabel, draft: game.draft }];
    set({ game: { ...game, archive }, screen: 'press', selectedBlockId: null });
  },

  nextIssue: () => {
    const game = get().game;
    if (!game) return;
    const dayCount = loadGameData().stories.dayCount();
    if (game.issueNumber >= issueCount(game.setup.frequency, dayCount)) {
      set({ game: { ...game, finished: true }, screen: 'end' });
      return;
    }
    set({
      game: { ...game, issueNumber: game.issueNumber + 1, draft: emptyDraft() },
      screen: 'editor',
      past: [],
      future: [],
      selectedBlockId: null,
      currentPage: 'front',
      wireTab: 'wire',
    });
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function wireStories(game: GameState): Story[] {
  const { stories } = loadGameData();
  const days = issueDays(game.setup.frequency, game.issueNumber, stories.dayCount());
  return days.flatMap((d) => stories.storiesForDay(d));
}

export function isPlaced(game: GameState, storyId: string): boolean {
  return findStoryBlock(game.draft, storyId) !== undefined;
}
