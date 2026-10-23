// End of the demo (or of the paper): every front page you printed, and the publisher's final memo.
import { loadGameData } from '../data/worldData.ts';
import { leanLabel, paperReport } from '../sim/paperStats.ts';
import { averageTrust, totalReaders } from '../sim/readers.ts';
import { CATEGORY_LABEL } from '../sim/staff.ts';
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
  const origin = world.origins[game.setup.origin];
  const readers = totalReaders(game.districts);
  const rep = paperReport(game);
  const biggestGap = [...rep.coverage].sort((a, b) => Math.abs(b.stated - b.actual) - Math.abs(a.stated - a.actual))[0];
  const bankrupt = game.endReason === 'bankrupt';

  return (
    <DeskSurface>
      <div className={styles.issues}>
        {game.archive.map((iss, i) => (
          <div key={iss.issueNumber} className={styles.thumb} style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (0.8 + i * 0.3)}deg)`, width: 620 * scale, height: 756 * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <PageSheet draft={iss.draft} articles={iss.articles} page="front" mode="print" paperName={game.setup.paperName} dateLabel={iss.dateLabel} issueNumber={iss.issueNumber} coverPrice={world.pricing.cover_price} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.letter}>
        <div className={styles.kicker}>Memo · from the publisher</div>
        <h1 className={styles.head}>{bankrupt ? 'The presses have stopped.' : "That's the demo. Thanks for playing."}</h1>
        <p>
          {bankrupt
            ? `${game.setup.paperName} ran out of money after ${n} issue${n === 1 ? '' : 's'}.`
            : `You put out ${n} issue${n === 1 ? '' : 's'} of ${game.setup.paperName}.`}
        </p>
        <div className={styles.numbers}>
          <div>
            <span>Readers</span>
            <b>
              {origin.starting_readers.toLocaleString()} → {readers.toLocaleString()}
            </b>
          </div>
          <div>
            <span>Cash</span>
            <b>
              ${origin.cash.toLocaleString()} → ${game.cash.toLocaleString()}
            </b>
          </div>
          <div>
            <span>Trust</span>
            <b>
              {origin.trust} → {Math.round(averageTrust(game.districts))}
            </b>
          </div>
          <div>
            <span>Awards · corrections</span>
            <b>
              {game.awards} · {game.corrections}
            </b>
          </div>
          <div>
            <span>Registered as</span>
            <b>{leanLabel(rep.statedLean)}</b>
          </div>
          <div>
            <span>Seen as</span>
            <b>{leanLabel(rep.perceivedLean)}</b>
          </div>
        </div>
        {biggestGap && rep.published ? (
          <p className={styles.small}>
            Biggest gap between promise and practice: {CATEGORY_LABEL[biggestGap.category]} ({Math.round(biggestGap.stated * 100)}% promised,{' '}
            {Math.round(biggestGap.actual * 100)}% printed).
          </p>
        ) : null}
        <p className={styles.small}>Tell the team what felt good about running the newsroom and laying out the page, and what didn't.</p>
        <button className={styles.back} onClick={() => goto('setup')}>
          Start a new paper
        </button>
        <button className={styles.backQuiet} onClick={() => goto('title')}>
          Back to the title page
        </button>
      </div>
    </DeskSurface>
  );
}
