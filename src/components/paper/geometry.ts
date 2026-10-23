// Pixel size of the page grid on screen. One cell = one column x one inch.
import { PAGE } from '../../sim/balance.ts';
import type { Rect } from '../../sim/types.ts';

export const CELL_W = 96;
export const CELL_H = 36;
export const PAGE_PAD_X = 22;
export const PAGE_PAD_Y = 18;
export const GRID_W = CELL_W * PAGE.cols;
export const GRID_H = CELL_H * PAGE.rows;
export const PAGE_W = GRID_W + PAGE_PAD_X * 2;
export const PAGE_H = GRID_H + PAGE_PAD_Y * 2;
/** Inset of a block inside its cells, so neighbours get a gutter. */
export const GUTTER = 5;

export function rectPx(r: Rect): { left: number; top: number; width: number; height: number } {
  return {
    left: r.col * CELL_W + GUTTER,
    top: r.row * CELL_H + GUTTER,
    width: r.cols * CELL_W - GUTTER * 2,
    height: r.rows * CELL_H - GUTTER * 2,
  };
}
