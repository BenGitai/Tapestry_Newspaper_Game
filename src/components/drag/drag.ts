// Pointer-driven drag and drop for the paste-up board.
// Hand-rolled instead of a library because the stage is CSS-scaled and every
// drop has to snap to the page grid, check rules and support resizing.
import { create } from 'zustand';
import { loadGameData } from '../../data/worldData.ts';
import {
  adBlockId,
  checkPlacement,
  clampToTier,
  defaultShape,
  findBlock,
  newAdBlock,
  newStoryBlock,
  putBlock,
  removeBlock,
  resizeBlock,
  storyBlockId,
} from '../../sim/layout.ts';
import { articleForStory } from '../../sim/newsroom.ts';
import type { PageId, Tier } from '../../sim/types.ts';
import { useStore } from '../../state/store.ts';
import { clientToStage } from '../desk/Stage.tsx';
import { CELL_H, CELL_W } from '../paper/geometry.ts';

export type DragPayload =
  | { kind: 'story'; storyId: string; tier: Tier; fromBlock: boolean }
  | { kind: 'ad'; adId: string; fromBlock: boolean }
  | { kind: 'resize'; blockId: string };

export interface DropTarget {
  page: PageId;
  col: number;
  row: number;
  cols: number;
  rows: number;
  ok: boolean;
  reason?: string;
}

export interface ActiveDrag {
  payload: DragPayload;
  shape: { cols: number; rows: number };
  /** Where the pointer holds the item, in cells from its top-left corner. */
  grab: { dc: number; dr: number };
  /** Pointer in stage coordinates. */
  pointer: { x: number; y: number };
  started: boolean;
  overWire: boolean;
  target: DropTarget | null;
}

interface DragStore {
  active: ActiveDrag | null;
}

export const useDrag = create<DragStore>(() => ({ active: null }));

// Elements the drag system hit-tests against. Registered by the board and the wire panel.
const gridEls = new Map<PageId, HTMLElement>();
let wireEl: HTMLElement | null = null;

export function registerGrid(page: PageId, el: HTMLElement | null): void {
  if (el) gridEls.set(page, el);
  else gridEls.delete(page);
}

export function registerWirePanel(el: HTMLElement | null): void {
  wireEl = el;
}

const START_DISTANCE = 4;

function blockIdOf(p: DragPayload): string | undefined {
  if (p.kind === 'resize') return p.blockId;
  if (!p.fromBlock) return undefined;
  return p.kind === 'story' ? storyBlockId(p.storyId) : adBlockId(p.adId);
}

function computeTarget(a: ActiveDrag, clientX: number, clientY: number): Pick<ActiveDrag, 'target' | 'overWire'> {
  const draft = useStore.getState().game?.draft;
  if (!draft) return { target: null, overWire: false };

  const wr = wireEl?.getBoundingClientRect();
  const overWire = !!wr && clientX >= wr.left && clientX <= wr.right && clientY >= wr.top && clientY <= wr.bottom;
  if (overWire) return { target: null, overWire: true };

  for (const [page, el] of gridEls) {
    const r = el.getBoundingClientRect();
    const cw = r.width / (el.offsetWidth / CELL_W);
    const ch = r.height / (el.offsetHeight / CELL_H);
    const cx = (clientX - r.left) / cw;
    const cy = (clientY - r.top) / ch;

    if (a.payload.kind === 'resize') {
      const found = findBlock(draft, a.payload.blockId);
      if (!found || found.block.kind !== 'story') return { target: null, overWire: false };
      const b = found.block;
      const shape = clampToTier(b.tier, Math.ceil(cx - b.col), Math.ceil(cy - b.row));
      const check = checkPlacement(draft, found.page, { ...b, ...shape }, b.id);
      return { target: { page: found.page, col: b.col, row: b.row, ...shape, ok: check.ok, reason: check.ok ? undefined : check.reason }, overWire: false };
    }

    // Only count the grid if the pointer is near it (one cell of slack).
    if (cx < -1 || cy < -1 || cx > el.offsetWidth / CELL_W + 1 || cy > el.offsetHeight / CELL_H + 1) continue;
    const col = Math.round(cx - a.grab.dc);
    const row = Math.round(cy - a.grab.dr);
    const rect = { col, row, ...a.shape };
    const check = checkPlacement(draft, page, rect, blockIdOf(a.payload));
    return { target: { page, ...rect, ok: check.ok, reason: check.ok ? undefined : check.reason }, overWire: false };
  }
  return { target: null, overWire: false };
}

/** Start tracking a possible drag from a pointerdown. A click (no movement) calls onClick instead. */
export function beginDrag(
  e: React.PointerEvent,
  payload: DragPayload,
  shape: { cols: number; rows: number },
  grab: { dc: number; dr: number },
  onClick?: () => void,
): void {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  useDrag.setState({
    active: { payload, shape, grab, pointer: clientToStage(startX, startY), started: false, overWire: false, target: null },
  });

  const move = (ev: PointerEvent) => {
    const a = useDrag.getState().active;
    if (!a) return;
    const started = a.started || Math.hypot(ev.clientX - startX, ev.clientY - startY) > START_DISTANCE;
    if (!started) return;
    const next = { ...a, started, pointer: clientToStage(ev.clientX, ev.clientY) };
    useDrag.setState({ active: { ...next, ...computeTarget(next, ev.clientX, ev.clientY) } });
  };

  const key = (ev: KeyboardEvent) => {
    const a = useDrag.getState().active;
    if (!a) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      cleanup();
      return;
    }
    // While dragging a story off the wire, 1/2/3 switch it between lead, secondary and brief.
    const tier: Tier | undefined = ({ '1': 'lead', '2': 'secondary', '3': 'brief' } as const)[ev.key as '1' | '2' | '3'];
    if (tier && a.payload.kind === 'story' && !a.payload.fromBlock) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const story = loadGameData().stories.storyById(a.payload.storyId);
      if (!story) return;
      const article = useStore.getState().game && articleForStory(useStore.getState().game!, story.id);
      const shape = defaultShape(tier, { base_column_inches: article?.inches ?? story.base_column_inches });
      useDrag.setState({ active: { ...a, payload: { ...a.payload, tier }, shape, grab: { dc: Math.min(a.grab.dc, shape.cols / 2), dr: 0.5 } } });
    }
  };

  const up = (ev: PointerEvent) => {
    const a = useDrag.getState().active;
    cleanup();
    if (!a) return;
    if (!a.started) {
      onClick?.();
      return;
    }
    commit({ ...a, ...computeTarget(a, ev.clientX, ev.clientY) });
  };

  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cleanup);
    window.removeEventListener('keydown', key, true);
    useDrag.setState({ active: null });
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cleanup);
  window.addEventListener('keydown', key, true);
}

function commit(a: ActiveDrag): void {
  const store = useStore.getState();
  const { stories } = loadGameData();
  const p = a.payload;

  if (a.overWire) {
    const id = blockIdOf(p);
    if (id && p.kind !== 'resize') store.edit((d) => removeBlock(d, id), { select: null });
    return;
  }
  const t = a.target;
  if (!t) return;
  if (!t.ok) {
    store.notify(t.reason ?? 'Does not fit there');
    return;
  }

  if (p.kind === 'resize') {
    store.edit((d) => resizeBlock(d, p.blockId, t.cols, t.rows));
    return;
  }

  if (p.kind === 'ad') {
    const id = adBlockId(p.adId);
    store.edit((d) => putBlock(d, t.page, { ...newAdBlock(p.adId, t), ...(findBlock(d, id)?.block ?? {}), col: t.col, row: t.row }), { select: id });
    return;
  }

  const story = stories.storyById(p.storyId);
  const article = store.game && articleForStory(store.game, p.storyId);
  if (!story || !article) return;
  const id = storyBlockId(story.id);
  store.edit(
    (d) => {
      const existing = findBlock(d, id)?.block;
      const block = existing && existing.kind === 'story' ? { ...existing, col: t.col, row: t.row } : { ...newStoryBlock(story, p.tier, t), ...a.shape };
      return putBlock(d, t.page, block);
    },
    { select: id },
  );
}
