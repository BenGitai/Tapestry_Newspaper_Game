// Fixed 1440x900 logical stage, scaled to fit the window and centered on the desk.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { stage } from '../../theme/tokens.ts';
import styles from './Stage.module.css';

let currentScale = 1;
let stageEl: HTMLDivElement | null = null;

/** Converts a pointer position (client px) to stage coordinates. */
export function clientToStage(x: number, y: number): { x: number; y: number } {
  const r = stageEl?.getBoundingClientRect();
  if (!r) return { x, y };
  return { x: (x - r.left) / currentScale, y: (y - r.top) / currentScale };
}

export function Stage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    stageEl = ref.current;
    const fit = () => {
      const s = Math.min(window.innerWidth / stage.width, window.innerHeight / stage.height);
      currentScale = s;
      setScale(s);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className={styles.viewport}>
      <div
        ref={ref}
        className={styles.stage}
        style={{ width: stage.width, height: stage.height, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
