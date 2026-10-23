// End of the demo: every front page you printed, pinned to the desk, and a thank-you note.
import { loadGameData } from '../data/worldData.ts';
import { useStore } from '../state/store.ts';
import { DeskSurface } from '../components/desk/DeskSurface.tsx';
import { PageSheet } from '../components/paper/PageSheet.tsx';
import styles from './EndScreen.module.css';

export function EndScreen() {
  const game = useStore((s) => s.game);
  const goto = useStore((s) => s.goto);
  if (!game) return null;
  const { world } = loadGameData();
  const n = game.archive.length;
  const scale = n <= 1 ? 0.62 : n <= 2 ? 0.55 : 0.4;

  return (
    <DeskSurface>
      <div className={styles.issues}>
        {game.archive.map((iss, i) => (
          <div key={iss.issueNumber} className={styles.thumb} style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (0.8 + i * 0.3)}deg)`, width: 620 * scale, height: 756 * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <PageSheet draft={iss.draft} page="front" mode="print" paperName={game.setup.paperName} dateLabel={iss.dateLabel} issueNumber={iss.issueNumber} coverPrice={world.pricing.cover_price} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.letter}>
        <div className={styles.kicker}>Memo · from the publisher</div>
        <h1 className={styles.head}>That's the demo. Thanks for playing.</h1>
        <p>
          You put out {n} issue{n === 1 ? '' : 's'} of <i>{game.setup.paperName}</i>. The full results, letters and the rival's front pages join this
          screen as the simulation comes online.
        </p>
        <p>Tell the team what felt good about laying out the page and what didn't. That's the main question this demo exists to answer.</p>
        <button className={styles.back} onClick={() => goto('title')}>
          Back to the title page
        </button>
      </div>
    </DeskSurface>
  );
}
