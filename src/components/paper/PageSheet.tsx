// A newspaper page on the paste-up board (mode "edit") or as printed (mode "print").
import { useCallback } from 'react';
import { articleSource } from '../../data/ArticleSource.ts';
import { displayName, loadGameData } from '../../data/worldData.ts';
import { PAGE } from '../../sim/balance.ts';
import { adPay, FIT_LABEL, fitOf, pageLabel, textInches, usableRows } from '../../sim/layout.ts';
import { initials, reporterById } from '../../sim/staff.ts';
import type { AdBlock, Article, IssueDraft, PageId, StoryBlock } from '../../sim/types.ts';
import { beginDrag, registerGrid, useDrag, type ActiveDrag } from '../drag/drag.ts';
import { ArticleView } from './ArticleView.tsx';
import { CELL_H, CELL_W, GRID_H, GRID_W, PAGE_H, PAGE_PAD_X, PAGE_PAD_Y, PAGE_W, rectPx } from './geometry.ts';
import styles from './PageSheet.module.css';

interface Props {
  draft: IssueDraft;
  /** The article running for each story id (bylines, angle, length). */
  articles: Record<string, Article>;
  page: PageId;
  mode: 'edit' | 'print';
  paperName: string;
  dateLabel: string;
  issueNumber: number;
  coverPrice: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

export function bylineFor(articles: Record<string, Article>, storyId: string): string {
  const { world, stories } = loadGameData();
  const a = articles[storyId];
  const reporter = a?.reporterId ? reporterById(world, a.reporterId) : undefined;
  if (reporter) return `By ${initials(reporter.name)}`;
  const story = stories.storyById(storyId);
  const src = stories.wireSources().find((w) => w.id === story?.wire_source);
  return src ? src.name : 'Wire report';
}

export function PageSheet({ draft, articles, page, mode, paperName, dateLabel, issueNumber, coverPrice, selectedId, onSelect }: Props) {
  const { stories, world } = loadGameData();
  const edit = mode === 'edit';
  const active = useDrag((s) => (edit ? s.active : null));
  const gridRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (edit) registerGrid(page, el);
    },
    [edit, page],
  );
  const draggingId = active?.started && active.payload.kind !== 'resize'
    ? active.payload.kind === 'story' ? `story:${active.payload.storyId}` : `ad:${active.payload.adId}`
    : null;
  const resizing = active?.started && active.payload.kind === 'resize' ? active.payload.blockId : null;
  const target = active?.started && active.target?.page === page ? active.target : null;
  const { top } = usableRows(page);

  const renderStory = (b: StoryBlock) => {
    const story = stories.storyById(b.storyId);
    if (!story) return null;
    const a = articles[b.storyId];
    const sized = { base_column_inches: a?.inches ?? story.base_column_inches };
    const article = articleSource().get({ storyId: story.id, journalistId: a?.reporterId ?? null, angle: a?.angle ?? 'straight', tier: b.tier }, story);
    const fit = fitOf(sized, b);
    const shown = resizing === b.id && target ? { ...b, cols: target.cols, rows: target.rows } : b;
    const px = rectPx(shown);
    const selected = edit && selectedId === b.id;
    return (
      <div
        key={b.id}
        className={`${styles.block} ${edit ? styles.editable : ''} ${selected ? styles.selected : ''} ${draggingId === b.id ? styles.lifted : ''}`}
        style={px}
        onPointerDown={edit ? (e) => beginDrag(e, { kind: 'story', storyId: b.storyId, tier: b.tier, fromBlock: true }, { cols: b.cols, rows: b.rows }, grabFrom(e, b), () => onSelect?.(b.id)) : undefined}
        aria-label={`${story.wire_headline}, ${b.tier}`}
      >
        <ArticleView story={story} block={shown} article={article} byline={bylineFor(articles, story.id)} />
        {edit ? (
          <div className={`${styles.fitTag} ${styles['fit_' + fit.status]}`}>
            {Math.round(textInches(shown))} in · {FIT_LABEL[fitOf(sized, shown).status]}
          </div>
        ) : null}
        {selected ? (
          <div
            className={styles.resizeHandle}
            title="Drag to resize"
            onPointerDown={(e) => beginDrag(e, { kind: 'resize', blockId: b.id }, { cols: b.cols, rows: b.rows }, { dc: 0, dr: 0 })}
          />
        ) : null}
      </div>
    );
  };

  const renderAd = (b: AdBlock) => {
    const entity = world.entities.find((e) => e.id === b.adId);
    if (!entity) return null;
    const selected = edit && selectedId === b.id;
    return (
      <div
        key={b.id}
        className={`${styles.block} ${styles.ad} ${edit ? styles.editable : ''} ${selected ? styles.selected : ''} ${draggingId === b.id ? styles.lifted : ''}`}
        style={rectPx(b)}
        onPointerDown={edit ? (e) => beginDrag(e, { kind: 'ad', adId: b.adId, fromBlock: true }, { cols: b.cols, rows: b.rows }, grabFrom(e, b), () => onSelect?.(b.id)) : undefined}
      >
        <div className={styles.adLabel}>Advertisement</div>
        <div className={styles.adName} style={{ fontSize: b.cols >= 3 ? 19 : 15 }}>{displayName(entity.name)}</div>
        <div className={styles.adSector}>{entity.type === 'government' ? 'Public notices' : (entity.sector ?? '').replace(/_/g, ' ')}</div>
        {edit ? <div className={styles.adPay}>+${adPay(entity, page)}</div> : null}
      </div>
    );
  };

  return (
    <div className={`${styles.sheet} ${edit ? '' : styles.print}`} style={{ width: PAGE_W, height: PAGE_H }}>
      <div
        ref={gridRef}
        className={styles.grid}
        style={{ left: PAGE_PAD_X, top: PAGE_PAD_Y, width: GRID_W, height: GRID_H }}
        onPointerDown={edit ? () => onSelect?.(null) : undefined}
      >
        {edit ? <GridLines top={top} /> : null}
        {page === 'front' ? (
          <Masthead paperName={paperName} dateLabel={dateLabel} issueNumber={issueNumber} coverPrice={coverPrice} />
        ) : (
          <InsideHeader paperName={paperName} dateLabel={dateLabel} page={page} />
        )}
        {page === 'front' ? (
          <div className={`${styles.fold} ${edit ? '' : styles.foldPrint}`} style={{ top: PAGE.foldRow * CELL_H }}>
            {edit ? <span>Fold · above it sells papers</span> : null}
          </div>
        ) : null}
        {draft.pages[page].map((b) => (b.kind === 'story' ? renderStory(b) : renderAd(b)))}
        {target && !resizing ? (
          <div className={`${styles.preview} ${target.ok ? styles.previewOk : styles.previewBad}`} style={rectPx(target)}>
            <div className={styles.previewBody}>
              <div className={styles.previewKicker}>{previewKicker(active)}</div>
              <div className={styles.previewTitle}>{previewTitle(active)}</div>
            </div>
            {!target.ok && target.reason ? <span>{target.reason}</span> : null}
          </div>
        ) : null}
        {target && resizing && !target.ok ? (
          <div className={`${styles.preview} ${styles.previewBad}`} style={rectPx(target)}>
            <span>{target.reason}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function previewKicker(a: ActiveDrag | null): string {
  if (!a || a.payload.kind === 'resize') return '';
  if (a.payload.kind === 'ad') return `Ad · ${a.shape.cols}×${a.shape.rows}`;
  return `${a.payload.tier} · ${a.shape.cols}×${a.shape.rows}${a.payload.fromBlock ? '' : ' · 1/2/3 to change'}`;
}

function previewTitle(a: ActiveDrag | null): string {
  if (!a || a.payload.kind === 'resize') return '';
  const { stories, world } = loadGameData();
  if (a.payload.kind === 'ad') {
    const adId = a.payload.adId;
    return displayName(world.entities.find((e) => e.id === adId)?.name ?? '');
  }
  return stories.storyById(a.payload.storyId)?.wire_headline ?? '';
}

function grabFrom(e: React.PointerEvent, b: { cols: number; rows: number }): { dc: number; dr: number } {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return {
    dc: Math.min(b.cols, Math.max(0, ((e.clientX - r.left) / r.width) * b.cols)),
    dr: Math.min(b.rows, Math.max(0, ((e.clientY - r.top) / r.height) * b.rows)),
  };
}

function GridLines({ top }: { top: number }) {
  const lines = [];
  for (let c = 1; c < PAGE.cols; c++) lines.push(<line key={`c${c}`} x1={c * CELL_W} x2={c * CELL_W} y1={top * CELL_H} y2={GRID_H} />);
  for (let r = top; r <= PAGE.rows; r++) lines.push(<line key={`r${r}`} x1={0} x2={GRID_W} y1={r * CELL_H} y2={r * CELL_H} />);
  return (
    <svg className={styles.gridLines} width={GRID_W} height={GRID_H} aria-hidden="true">
      {lines}
    </svg>
  );
}

function Masthead({ paperName, dateLabel, issueNumber, coverPrice }: { paperName: string; dateLabel: string; issueNumber: number; coverPrice: number }) {
  return (
    <div className={styles.masthead} style={{ height: PAGE.frontMastheadRows * CELL_H }}>
      <div className={styles.mastName} style={{ fontSize: paperName.length > 24 ? 38 : 48 }}>{paperName}</div>
      <div className={styles.mastMeta}>
        <span>Vol. I · No. {issueNumber}</span>
        <span>{dateLabel}</span>
        <span>${coverPrice.toFixed(2)}</span>
      </div>
    </div>
  );
}

function InsideHeader({ paperName, dateLabel, page }: { paperName: string; dateLabel: string; page: PageId }) {
  return (
    <div className={styles.insideHeader} style={{ height: PAGE.insideHeaderRows * CELL_H }}>
      <span>{pageLabel(page)}</span>
      <span className={styles.insideName}>{paperName}</span>
      <span>{dateLabel}</span>
    </div>
  );
}
