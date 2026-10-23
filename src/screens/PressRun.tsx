// The printed issue, full size on the desk. The results sheet joins it in milestone 4.
import { useState } from 'react';
import { loadGameData } from '../data/worldData.ts';
import { activePages, pageLabel } from '../sim/layout.ts';
import { issueCount } from '../sim/newGame.ts';
import type { PageId } from '../sim/types.ts';
import { useStore } from '../state/store.ts';
import { DeskSurface } from '../components/desk/DeskSurface.tsx';
import { PageSheet } from '../components/paper/PageSheet.tsx';
import styles from './PressRun.module.css';

export function PressRun() {
  const game = useStore((s) => s.game);
  const nextIssue = useStore((s) => s.nextIssue);
  const [page, setPage] = useState<PageId>('front');
  const printed = game?.archive[game.archive.length - 1];
  if (!game || !printed) return null;
  const { world, stories } = loadGameData();
  const last = game.issueNumber >= issueCount(game.setup.frequency, stories.dayCount());

  return (
    <DeskSurface>
      <div className={styles.sheet}>
        <PageSheet
          draft={printed.draft}
          articles={printed.articles}
          page={page}
          mode="print"
          paperName={game.setup.paperName}
          dateLabel={printed.dateLabel}
          issueNumber={printed.issueNumber}
          coverPrice={world.pricing.cover_price}
        />
      </div>
      <aside className={styles.side}>
        <div className={styles.stamp}>Printed</div>
        <div className={styles.kicker}>Issue {printed.issueNumber} · {printed.dateLabel}</div>
        <div className={styles.pages}>
          {activePages(printed.draft).map((p) => (
            <button key={p} className={p === page ? styles.on : ''} onClick={() => setPage(p)}>
              {pageLabel(p)}
            </button>
          ))}
        </div>
        <p className={styles.note}>
          The results sheet (sales by district, trust, lean, ad money, letters and the rival's front page) arrives with the simulation in milestone 4.
        </p>
        <button className={styles.next} onClick={nextIssue}>
          {last ? 'Close the books' : 'Next issue'}
        </button>
      </aside>
    </DeskSurface>
  );
}
