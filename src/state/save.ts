// Local save games. Kept behind an interface so the desktop build can move
// saves to files (or Steam Cloud) later without touching the game.
import type { GameState } from '../sim/types.ts';

export type SlotId = 'autosave' | 'slot1' | 'slot2' | 'slot3';

export interface SaveMeta {
  slot: SlotId;
  paperName: string;
  issueNumber: number;
  cash: number;
  savedAt: string;
}

export interface SaveStore {
  save(slot: SlotId, game: GameState): boolean;
  load(slot: SlotId): GameState | null;
  list(): SaveMeta[];
}

const VERSION = 3;
const KEY = (slot: SlotId) => `above-the-fold.save.v${VERSION}.${slot}`;
const SLOTS: SlotId[] = ['autosave', 'slot1', 'slot2', 'slot3'];

/** Browser storage (in the desktop app it lives in the app's user-data folder). */
export class LocalSaveStore implements SaveStore {
  save(slot: SlotId, game: GameState): boolean {
    try {
      const meta: SaveMeta = { slot, paperName: game.setup.paperName, issueNumber: game.issueNumber, cash: game.cash, savedAt: new Date().toISOString() };
      localStorage.setItem(KEY(slot), JSON.stringify({ version: VERSION, meta, game }));
      return true;
    } catch {
      return false;
    }
  }

  load(slot: SlotId): GameState | null {
    try {
      const raw = localStorage.getItem(KEY(slot));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { version: number; game: GameState };
      return parsed.version === VERSION ? parsed.game : null;
    } catch {
      return null;
    }
  }

  list(): SaveMeta[] {
    const out: SaveMeta[] = [];
    for (const slot of SLOTS) {
      try {
        const raw = localStorage.getItem(KEY(slot));
        if (raw) out.push((JSON.parse(raw) as { meta: SaveMeta }).meta);
      } catch {
        // unreadable slot: skip it
      }
    }
    return out;
  }
}

export const saves: SaveStore = new LocalSaveStore();
