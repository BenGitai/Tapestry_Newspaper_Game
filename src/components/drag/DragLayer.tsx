// The paper you're holding: follows the pointer above everything else while dragging.
import { displayName, loadGameData } from '../../data/worldData.ts';
import { CELL_H, CELL_W } from '../paper/geometry.ts';
import { useDrag } from './drag.ts';
import styles from './DragLayer.module.css';

export function DragLayer() {
  const active = useDrag((s) => s.active);
  if (!active?.started || active.payload.kind === 'resize' || active.target) return null;
  const { stories, world } = loadGameData();
  const w = Math.min(230, active.shape.cols * CELL_W);
  const left = active.pointer.x - Math.min(active.grab.dc * CELL_W, w / 2);
  const top = active.pointer.y - Math.min(active.grab.dr * CELL_H, 18);
  const p = active.payload;
  const title =
    p.kind === 'story'
      ? (stories.storyById(p.storyId)?.wire_headline ?? '')
      : displayName(world.entities.find((e) => e.id === p.adId)?.name ?? '');

  return (
    <div className={styles.layer} aria-hidden="true">
      <div
        className={`${styles.ghost} ${p.kind === 'ad' ? styles.ad : ''} ${active.overWire ? styles.toWire : ''}`}
        style={{ left, top, width: w }}
      >
        <div className={styles.kicker}>
          {p.kind === 'story' ? `${p.tier} · ${active.shape.cols}×${active.shape.rows}` : 'Advertisement'}
        </div>
        <div className={styles.title}>{title}</div>
        {p.kind === 'story' && !p.fromBlock ? <div className={styles.hint}>1 lead · 2 secondary · 3 brief · Esc cancel</div> : null}
        {active.overWire ? <div className={styles.hint}>Release to take it off the page</div> : null}
      </div>
    </div>
  );
}
