// Dev-only jump menu. Toggle with the backtick key (`).
import { useEffect, useState } from 'react';
import { defaultSetup } from '../sim/newGame.ts';
import { useStore, type Screen } from '../state/store.ts';
import styles from './Dev.module.css';

const SCREENS: Screen[] = ['title', 'editor', 'press', 'end', 'lab'];

export function DevMenu() {
  const [open, setOpen] = useState(false);
  const goto = useStore((s) => s.goto);
  const startGame = useStore((s) => s.startGame);
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
      <button onClick={() => startGame(defaultSetup())}>Quick start</button>
      {SCREENS.map((s) => (
        <button key={s} disabled={(s === 'editor' || s === 'end') && !hasGame ? true : s === 'press' && !printed} onClick={() => goto(s)}>
          {s}
        </button>
      ))}
      <button onClick={() => setOpen(false)}>Close (`)</button>
    </div>
  );
}
