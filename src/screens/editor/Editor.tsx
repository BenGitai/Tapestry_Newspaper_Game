// Layout tab: the print pile on the left, paste-up board in the middle, notes on the right.
import { useEffect } from 'react';
import { loadGameData } from '../../data/worldData.ts';
import { EXTRA_PAGE_COST_PER_COPY } from '../../sim/balance.ts';
import { activePages, ALL_PAGES, findBlock, pageLabel, putBlock, removeBlock, resizeBlock, setExtraPage, setTier } from '../../sim/layout.ts';
import { formatIssueDate, issueDate } from '../../sim/newGame.ts';
import { articleForStory, backlog } from '../../sim/newsroom.ts';
import type { Article, Tier } from '../../sim/types.ts';
import { useStore } from '../../state/store.ts';
import { useDrag } from '../../components/drag/drag.ts';
import { PageSheet } from '../../components/paper/PageSheet.tsx';
import { Inspector } from './Inspector.tsx';
import { WirePanel } from './WirePanel.tsx';
import styles from './Editor.module.css';

export function Editor() {
  const game = useStore((s) => s.game);
  const page = useStore((s) => s.currentPage);
  const selectedId = useStore((s) => s.selectedBlockId);
  const select = useStore((s) => s.selectBlock);
  const setPage = useStore((s) => s.setPage);
  const edit = useStore((s) => s.edit);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);

  useEditorKeys();

  if (!game) return null;
  const { world } = loadGameData();
  const dateLabel = formatIssueDate(issueDate(game.setup.frequency, game.issueNumber));
  const pages = activePages(game.draft);
  const articles: Record<string, Article> = {};
  for (const a of backlog(game)) articles[a.storyId] = a;

  return (
    <>
      <WirePanel />

      <main className={styles.board}>
        <div className={styles.boardBar}>
          <span className={styles.boardLabel}>
            Paste-up board · page {pages.indexOf(page) + 1} of {pages.length}
          </span>
          <span className={styles.boardButtons}>
            <button onClick={undo} disabled={!canUndo} title="Ctrl+Z">
              Undo
            </button>
            <button onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">
              Redo
            </button>
          </span>
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
            articles={articles}
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
    </>
  );
}

const TIER_KEYS: Record<string, Tier> = { '1': 'lead', '2': 'secondary', '3': 'brief' };

function useEditorKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const game = s.game;
      if (!game || s.screen !== 'hub' || s.hubTab !== 'layout' || useDrag.getState().active) return;
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
        s.selectBlock(null);
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
        const article = articleForStory(game, b.storyId);
        if (story) s.edit((d) => setTier(d, b.id, tier, { ...story, base_column_inches: article?.inches ?? story.base_column_inches }));
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
