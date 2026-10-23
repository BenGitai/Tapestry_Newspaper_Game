// Dev-only jump menu. Toggle with the backtick key (`).
import { useEffect, useState } from 'react';
import { defaultAssignment } from '../sim/staff.ts';
import { defaultSetup, suggestStartingStaff } from '../sim/newGame.ts';
import { loadGameData } from '../data/worldData.ts';
import { useStore, type Screen } from '../state/store.ts';
import styles from './Dev.module.css';

const SCREENS: Screen[] = ['title', 'setup', 'hub', 'press', 'end', 'lab'];

/** Skip setup and hiring: default paper, suggested staff on their home desks. */
export function quickStart(): void {
  const { world } = loadGameData();
  const setup = defaultSetup();
  const hires = suggestStartingStaff(world, setup).map((r) => ({ reporterId: r.id, assignment: defaultAssignment(world, r) }));
  useStore.getState().startGame(setup, hires);
}

export function DevMenu() {
  const [open, setOpen] = useState(false);
  const goto = useStore((s) => s.goto);
  const hasGame = useStore((s) => s.game !== null);
  const printed = useStore((s) => (s.game?.archive.length ?? 0) > 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`') setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;
  return (
    <div className={styles.menu}>
      <b>Dev menu</b>
      <button onClick={quickStart}>Quick start</button>
      {SCREENS.map((s) => (
        <button key={s} disabled={(s === 'hub' || s === 'end') && !hasGame ? true : s === 'press' && !printed} onClick={() => goto(s)}>
          {s}
        </button>
      ))}
      <button onClick={() => setOpen(false)}>Close (`)</button>
    </div>
  );
}
