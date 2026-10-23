// The main game screen: a header strip with the paper's numbers and three tabs.
// Newsroom (review and pick articles) → Layout (make up the paper) → Staff (hire and assign).
import { useEffect, useState } from 'react';
import { loadGameData } from '../../data/worldData.ts';
import { adRevenue } from '../../sim/layout.ts';
import { selectedForPrint } from '../../sim/newsroom.ts';
import { issueCount, issueDate } from '../../sim/newGame.ts';
import { useStore, type HubTab } from '../../state/store.ts';
import { DeskSurface } from '../../components/desk/DeskSurface.tsx';
import { Editor } from '../editor/Editor.tsx';
import { NewsroomTab } from './NewsroomTab.tsx';
import { StaffTab } from './StaffTab.tsx';
import { MapTab } from './MapTab.tsx';
import { leanLabel } from '../../sim/paperStats.ts';
import { averageTrust, totalReaders } from '../../sim/readers.ts';
import styles from './Hub.module.css';

const TABS: { id: HubTab; label: string; key: string }[] = [
  { id: 'newsroom', label: 'Newsroom', key: 'F1' },
  { id: 'layout', label: 'Layout', key: 'F2' },
  { id: 'staff', label: 'Staff', key: 'F3' },
  { id: 'map', label: 'City map', key: 'F4' },
];

export function Hub() {
  const game = useStore((s) => s.game);
  const tab = useStore((s) => s.hubTab);
  const setTab = useStore((s) => s.setHubTab);
  const goto = useStore((s) => s.goto);
  const saveGame = useStore((s) => s.saveGame);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = TABS.find((x) => x.key === e.key);
      if (t) {
        e.preventDefault();
        useStore.getState().setHubTab(t.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!game) return null;
  const { world, stories } = loadGameData();
  const dayCount = stories.dayCount();
  const dateLabel = issueDate(game.setup.frequency, game.issueNumber, dayCount).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const forPrint = selectedForPrint(game).length;

  return (
    <DeskSurface>
      <header className={styles.header}>
        <div className={styles.paperName}>{game.setup.paperName}</div>
        <div className={styles.edition}>
          Issue {game.issueNumber}/{issueCount(game.setup.frequency, dayCount)} · {dateLabel}
        </div>
        <nav className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? styles.tabOn : ''} onClick={() => setTab(t.id)} title={t.key}>
              {t.label}
              {t.id === 'layout' && forPrint ? <span className={styles.badge}>{forPrint}</span> : null}
            </button>
          ))}
        </nav>
        <div className={styles.stats}>
          <Stat label="Treasury" value={`$${game.cash.toLocaleString()}`} />
          <Stat label="Ads" value={`+$${adRevenue(game.draft, world.entities)}`} good />
          <Stat label="Readers" value={totalReaders(game.districts).toLocaleString()} />
          <Stat label="Trust" value={`${Math.round(averageTrust(game.districts))}`} />
          <Stat label="Seen as" value={leanLabel(game.perceivedLean)} />
        </div>
        <button className={styles.lab} onClick={() => saveGame('slot1')} title="Save to slot 1 (the game also autosaves every issue)">
          Save
        </button>
        <button className={styles.lab} onClick={() => goto('title')} title="Back to the title page (autosaved)">
          Menu
        </button>
      </header>

      {tab === 'newsroom' ? <NewsroomTab /> : null}
      {tab === 'layout' ? <Editor /> : null}
      {tab === 'staff' ? <StaffTab /> : null}
      {tab === 'map' ? <MapTab /> : null}
      <Notice />
    </DeskSurface>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={good ? styles.statGood : styles.statValue}>{value}</span>
    </div>
  );
}

function Notice() {
  const notice = useStore((s) => s.notice);
  if (!notice) return null;
  return <NoticeSlip key={notice.at} text={notice.text} />;
}

/** A short note that drops onto the desk and clears itself. Remounts for each new notice. */
function NoticeSlip({ text }: { text: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(false), 2800);
    return () => window.clearTimeout(t);
  }, []);
  if (!shown) return null;
  return (
    <div className={styles.notice} role="status" onClick={() => setShown(false)}>
      {text}
    </div>
  );
}
