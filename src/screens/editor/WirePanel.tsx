// Left side of the layout tab: the articles you picked for print, and the ad desk.
import { useCallback } from 'react';
import { articleSource } from '../../data/ArticleSource.ts';
import { displayName, loadGameData } from '../../data/worldData.ts';
import { adPay, adSize, defaultShape, findAdBlock, findStoryBlock, pageLabel, placementLabel } from '../../sim/layout.ts';
import { selectedForPrint } from '../../sim/newsroom.ts';
import { adsAvailable } from '../../sim/simulate.ts';
import { useStore } from '../../state/store.ts';
import { beginDrag, registerWirePanel } from '../../components/drag/drag.ts';
import { ANGLE_LABEL, articleScorecard, bylineOf, ScoreChips } from '../../components/newsroom/ArticleParts.tsx';
import styles from './Editor.module.css';

export function WirePanel() {
  const game = useStore((s) => s.game);
  const tab = useStore((s) => s.layoutTab);
  const setTab = useStore((s) => s.setLayoutTab);
  const select = useStore((s) => s.selectBlock);
  const setPage = useStore((s) => s.setPage);
  const setHubTab = useStore((s) => s.setHubTab);
  const ref = useCallback((el: HTMLDivElement | null) => registerWirePanel(el), []);
  if (!game) return null;
  const { world } = loadGameData();
  const pile = selectedForPrint(game);
  const placedCount = pile.filter((a) => findStoryBlock(game.draft, a.storyId)).length;
  const ads = world.entities;

  return (
    <div ref={ref} className={styles.wire}>
      <div className={styles.wireTabs}>
        <button className={tab === 'print' ? styles.tabOn : ''} onClick={() => setTab('print')}>
          For print <span className="mono">{pile.length - placedCount} to place</span>
        </button>
        <button className={tab === 'ads' ? styles.tabOn : ''} onClick={() => setTab('ads')}>
          Ad desk <span className="mono">{ads.filter((a) => !findAdBlock(game.draft, a.id) && adsAvailable(game, a.id)).length} open</span>
        </button>
      </div>

      {tab === 'print' ? (
        <div className={styles.slips}>
          {pile.map((a, i) => {
            const sc = articleScorecard(game, a);
            if (!sc) return null;
            const placed = findStoryBlock(game.draft, a.storyId);
            const shape = defaultShape('secondary', { base_column_inches: a.inches });
            const headline = articleSource().get({ storyId: a.storyId, journalistId: a.reporterId, angle: a.angle, tier: 'secondary' }, sc.story).headline;
            return (
              <div
                key={a.id}
                className={`${styles.slip} ${placed ? styles.slipPlaced : ''}`}
                style={{ transform: `rotate(${i % 2 ? 0.35 : -0.3}deg)`, borderLeft: `5px solid var(--c-cat-${sc.story.category})` }}
                onPointerDown={(e) =>
                  placed
                    ? beginDrag(e, { kind: 'story', storyId: a.storyId, tier: placed.block.tier, fromBlock: true }, { cols: placed.block.cols, rows: placed.block.rows }, { dc: placed.block.cols / 2, dr: 0.5 }, () => {
                        setPage(placed.page);
                        select(placed.block.id);
                      })
                    : beginDrag(e, { kind: 'story', storyId: a.storyId, tier: 'secondary', fromBlock: false }, shape, { dc: shape.cols / 2, dr: 0.5 })
                }
              >
                <div className={styles.slipMeta}>
                  <span>{bylineOf(a)} · {ANGLE_LABEL[a.angle]}</span>
                  <span>{a.inches} col. in.</span>
                </div>
                <div className={styles.slipHead}>{headline}</div>
                <ScoreChips card={sc.card} compact />
                <div className={styles.slipStatus}>
                  {placed ? <span className={styles.onPage}>On the page · {placementLabel(placed.page, placed.block)}</span> : <span>Drag to the page</span>}
                  {sc.story.sensitivity === 'high' ? <span className={styles.sensitive}>Sensitive</span> : null}
                </div>
              </div>
            );
          })}
          {pile.length === 0 ? (
            <div className={styles.empty}>
              Nothing picked for print yet.{' '}
              <button className={styles.inlineLink} onClick={() => setHubTab('newsroom')}>
                Back to the newsroom
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.slips}>
          <p className={styles.adNote}>Ads pay when they run. Front-page ads pay more. Every inch you sell is an inch of news you don't run.</p>
          {ads.map((a, i) => {
            const placed = findAdBlock(game.draft, a.id);
            const size = adSize(a.id);
            const pulled = !adsAvailable(game, a.id);
            return (
              <div
                key={a.id}
                className={`${styles.slip} ${styles.adSlip} ${placed ? styles.slipPlaced : ''} ${pulled ? styles.slipPulled : ''}`}
                style={{ transform: `rotate(${i % 2 ? 0.3 : -0.25}deg)` }}
                onPointerDown={(e) =>
                  pulled ? undefined : beginDrag(e, { kind: 'ad', adId: a.id, fromBlock: !!placed }, size, { dc: size.cols / 2, dr: 0.5 }, placed ? () => { setPage(placed.page); select(placed.block.id); } : undefined)
                }
              >
                <div className={styles.slipMeta}>
                  <span>{a.type === 'government' ? 'Public notice' : (a.sector ?? '').replace(/_/g, ' ')}</span>
                  <span>{size.cols}×{size.rows} · {size.cols * size.rows} in</span>
                </div>
                <div className={styles.slipHead}>{displayName(a.name)}</div>
                <div className={styles.slipStatus}>
                  {pulled ? (
                    <span className={styles.onPage}>Ads pulled through issue {game.advertisers[a.id]?.pulledThrough}</span>
                  ) : placed ? (
                    <span className={styles.onPage}>Running on {pageLabel(placed.page)}</span>
                  ) : (
                    <span>Drag to the page</span>
                  )}
                  <span className={styles.pay}>${adPay(a, 'a2')} · front ${adPay(a, 'front')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
