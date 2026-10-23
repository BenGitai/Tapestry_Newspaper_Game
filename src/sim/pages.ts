// Growing the paper: extra inside pages unlock as readership and distribution grow.
import { PAGE_UNLOCKS } from './balance.ts';
import { totalReaders } from './readers.ts';
import type { GameState, PageId } from './types.ts';

export function totalNewsstands(game: Pick<GameState, 'districts'>): number {
  return Object.values(game.districts).reduce((a, d) => a + d.newsstands, 0);
}

/** Extra pages the paper qualifies for right now. */
export function qualifiedPages(game: Pick<GameState, 'districts'>): PageId[] {
  const readers = totalReaders(game.districts);
  const stands = totalNewsstands(game);
  return PAGE_UNLOCKS.filter((u) => readers >= u.readers && stands >= u.newsstands).map((u) => u.page);
}

/** Unlocks are permanent: add any newly qualified pages. Returns the new ones too. */
export function unlockPages(game: GameState): { game: GameState; unlocked: PageId[] } {
  const have = new Set(game.unlockedPages);
  const fresh = qualifiedPages(game).filter((p) => !have.has(p));
  if (!fresh.length) return { game, unlocked: [] };
  return { game: { ...game, unlockedPages: [...game.unlockedPages, ...fresh] }, unlocked: fresh };
}

/** The next page to unlock and what it takes, for the UI. */
export function nextUnlock(game: GameState): { page: PageId; readers: number; newsstands: number } | undefined {
  return PAGE_UNLOCKS.find((u) => !game.unlockedPages.includes(u.page));
}

export function isUnlocked(game: Pick<GameState, 'unlockedPages'>, page: PageId): boolean {
  return page === 'front' || page === 'a2' || game.unlockedPages.includes(page);
}
