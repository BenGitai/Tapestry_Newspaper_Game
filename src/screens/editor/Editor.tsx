// Front page editor: wire on the left, paste-up board in the middle, notes on the right.
import { useEffect, useState } from 'react';
import { loadGameData } from '../../data/worldData.ts';
import { EXTRA_PAGE_COST_PER_COPY } from '../../sim/balance.ts';
import { activePages, adRevenue, ALL_PAGES, findBlock, pageLabel, putBlock, removeBlock, resizeBlock, setExtraPage, setTier } from '../../sim/layout.ts';
import { formatIssueDate, issueCount, issueDate } from '../../sim/newGame.ts';
import type { Tier } from '../../sim/types.ts';
import { useStore } from '../../state/store.ts';
import { DeskSurface } from '../../components/desk/DeskSurface.tsx';
import { useDrag } from '../../components/drag/drag.ts';
import { PageSheet } from '../../components/paper/PageSheet.tsx';
import { Inspector } from './Inspector.tsx';
import { WirePanel } from './WirePanel.tsx';
import styles from './Editor.module.css';

export function Editor() {
  const game = useStore((s) => s.game);
  const page = useStore((s) => s.currentPage);
  const selectedId = useStore((s) => s.selectedBlockId);
  const select = useStore((s) => s.select);
  const setPage = useStore((s) => s.setPage);
  const edit = useStore((s) => s.edit);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const goto = useStore((s) => s.goto);

  useEditorKeys();

  if (!game) return null;
  const { world, stories } = loadGameData();
  const dayCount = stories.dayCount();
  const dateLabel = formatIssueDate(issueDate(game.setup.frequency, game.issueNumber, dayCount));
  const origin = world.origins[game.setup.origin];
  const pages = activePages(game.draft);

  return (
    <DeskSurface>
      <header className={styles.header}>
        <div className={styles.paperName}>{game.setup.paperName}</div>
        <div className={styles.edition}>
          Issue {game.issueNumber} of {issueCount(game.setup.frequency, dayCount)} · {dateLabel}
        </div>
        <div className={styles.stats}>
          <Stat label="Treasury" value={`$${game.cash.toLocaleString()}`} />
          <Stat label="Circulation" value={origin.starting_readers.toLocaleString()} />
          <Stat label="Public trust" value={`${origin.trust} / 100`} />
          <Stat label="Ads this issue" value={`+$${adRevenue(game.draft, world.entities)}`} good />
        </div>
        <div className={styles.headerButtons}>
          <button onClick={undo} disabled={!canUndo} title="Ctrl+Z">Undo</button>
          <button onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">Redo</button>
          <button onClick={() => goto('lab')} title="Dev tool">Lab</button>
        </div>
      </header>

      <WirePanel />

      <main className={styles.board}>
        <div className={styles.boardLabel}>
          Paste-up board · page {pages.indexOf(page) + 1} of {pages.length}
        </div>
        <div className={styles.pageTabs}>
          {ALL_PAGES.map((p) =>
            pages.includes(p) ? (
              <button key={p} className={p === page ? styles.pageTabOn : ''} onClick={() => setPage(p)}>
                {pageLabel(p)}
                {p !== 'front' && p !== 'a2' ? (
                  <span
                    className={styles.tabClose}
                    title="Stop running this page"
                    onClick={(e) => {
                      e.stopPropagation();
                      edit((d) => setExtraPage(d, p, false));
                      setPage('a2');
                    }}
                  >
                    ×
                  </span>
                ) : null}
              </button>
            ) : (
              <button
                key={p}
                className={styles.pageTabAdd}
                onClick={() => {
                  edit((d) => setExtraPage(d, p, true));
                  setPage(p);
                }}
                title={`Adds $${EXTRA_PAGE_COST_PER_COPY.toFixed(2)} to the print cost of every copy`}
              >
                + {pageLabel(p)} <span>+${EXTRA_PAGE_COST_PER_COPY.toFixed(2)}/copy</span>
              </button>
            ),
          )}
        </div>
        <div className={styles.sheetWrap}>
          <PageSheet
            draft={game.draft}
            page={page}
            mode="edit"
            paperName={game.setup.paperName}
            dateLabel={dateLabel}
            issueNumber={game.issueNumber}
            coverPrice={world.pricing.cover_price}
            selectedId={selectedId}
            onSelect={select}
          />
        </div>
      </main>

      <Inspector />
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
    const t = window.setTimeout(() => setShown(false), 2600);
    return () => window.clearTimeout(t);
  }, []);
  if (!shown) return null;
  return (
    <div className={styles.notice} role="status" onClick={() => setShown(false)}>
      {text}
    </div>
  );
}

const TIER_KEYS: Record<string, Tier> = { '1': 'lead', '2': 'secondary', '3': 'brief' };

function useEditorKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const game = s.game;
      if (!game || s.screen !== 'editor' || useDrag.getState().active) return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      const found = s.selectedBlockId ? findBlock(game.draft, s.selectedBlockId) : undefined;
      if (!found) return;
      const b = found.block;
      if (e.key === 'Escape') {
        s.select(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.edit((d) => removeBlock(d, b.id), { select: null });
        return;
      }
      const tier = TIER_KEYS[e.key];
      if (tier && b.kind === 'story') {
        const story = loadGameData().stories.storyById(b.storyId);
        if (story) s.edit((d) => setTier(d, b.id, tier, story));
        return;
      }
      const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const dv = delta[e.key];
      if (!dv) return;
      e.preventDefault();
      if (e.shiftKey) s.edit((d) => resizeBlock(d, b.id, b.cols + dv[0], b.rows + dv[1]));
      else s.edit((d) => putBlock(d, found.page, { ...b, col: b.col + dv[0], row: b.row + dv[1] }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
