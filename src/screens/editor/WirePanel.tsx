// Left side: the news wire (stories) and the ad desk (ads), as paper slips on the desk.
import { useCallback } from 'react';
import type { Story } from '../../data/schemas.ts';
import { displayName, loadGameData } from '../../data/worldData.ts';
import { adPay, adSize, defaultShape, findAdBlock, findStoryBlock, pageLabel, placementLabel } from '../../sim/layout.ts';
import { wireStories, useStore, type WireFilter } from '../../state/store.ts';
import { beginDrag, registerWirePanel } from '../../components/drag/drag.ts';
import styles from './Editor.module.css';

const FILTERS: { id: WireFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'local', label: 'Local' },
  { id: 'world', label: 'World' },
  { id: 'politics', label: 'Politics' },
  { id: 'economy', label: 'Economy' },
  { id: 'social', label: 'Social' },
  { id: 'sports', label: 'Sports' },
  { id: 'culture', label: 'Culture' },
];

function matches(s: Story, f: WireFilter): boolean {
  if (f === 'all') return true;
  if (f === 'local') return s.scope === 'local';
  if (f === 'world') return s.scope !== 'local';
  return s.category === f;
}

export function WirePanel() {
  const game = useStore((s) => s.game);
  const filter = useStore((s) => s.wireFilter);
  const tab = useStore((s) => s.wireTab);
  const setFilter = useStore((s) => s.setWireFilter);
  const setTab = useStore((s) => s.setWireTab);
  const select = useStore((s) => s.select);
  const setPage = useStore((s) => s.setPage);
  const ref = useCallback((el: HTMLDivElement | null) => registerWirePanel(el), []);
  if (!game) return null;
  const { stories, world } = loadGameData();
  const all = wireStories(game);
  const list = all.filter((s) => matches(s, filter));
  const placedCount = all.filter((s) => findStoryBlock(game.draft, s.id)).length;
  const ads = world.entities;

  return (
    <div ref={ref} className={styles.wire}>
      <div className={styles.wireTabs}>
        <button className={tab === 'wire' ? styles.tabOn : ''} onClick={() => setTab('wire')}>
          The wire <span className="mono">{all.length - placedCount} left</span>
        </button>
        <button className={tab === 'ads' ? styles.tabOn : ''} onClick={() => setTab('ads')}>
          Ad desk <span className="mono">{ads.filter((a) => !findAdBlock(game.draft, a.id)).length} open</span>
        </button>
      </div>

      {tab === 'wire' ? (
        <>
          <div className={styles.filters}>
            {FILTERS.map((f) => (
              <button key={f.id} className={filter === f.id ? styles.filterOn : ''} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className={styles.slips}>
            {list.map((s, i) => {
              const placed = findStoryBlock(game.draft, s.id);
              const src = stories.wireSources().find((w) => w.id === s.wire_source);
              const shape = defaultShape('secondary', s);
              return (
                <div
                  key={s.id}
                  className={`${styles.slip} ${placed ? styles.slipPlaced : ''}`}
                  style={{ transform: `rotate(${i % 2 ? 0.35 : -0.3}deg)` }}
                  onPointerDown={(e) =>
                    placed
                      ? beginDrag(e, { kind: 'story', storyId: s.id, tier: placed.block.tier, fromBlock: true }, { cols: placed.block.cols, rows: placed.block.rows }, { dc: placed.block.cols / 2, dr: 0.5 }, () => {
                          setPage(placed.page);
                          select(placed.block.id);
                        })
                      : beginDrag(e, { kind: 'story', storyId: s.id, tier: 'secondary', fromBlock: false }, shape, { dc: shape.cols / 2, dr: 0.5 })
                  }
                >
                  <div className={styles.slipMeta}>
                    <span>Via {src?.name ?? s.wire_source} · {s.filed_at}</span>
                    <span>{s.category}</span>
                  </div>
                  <div className={styles.slipHead}>{s.wire_headline}</div>
                  <div className={styles.slipFoot}>
                    <span title={`Importance ${s.importance} of 5`}>{'■'.repeat(s.importance)}{'□'.repeat(5 - s.importance)}</span>
                    <span>{s.base_column_inches} col. in.</span>
                    {s.sensitivity === 'high' ? <span className={styles.sensitive}>Sensitive</span> : null}
                  </div>
                  <div className={styles.slipStatus}>
                    {placed ? <span className={styles.onPage}>On your page · {placementLabel(placed.page, placed.block)}</span> : <span>Drag to the page</span>}
                    <a href={s.real_story_url} onClick={(e) => e.preventDefault()} onPointerDown={(e) => e.stopPropagation()} title="Placeholder link in the demo">
                      Read the real story ↗
                    </a>
                  </div>
                </div>
              );
            })}
            {list.length === 0 ? <div className={styles.empty}>Nothing on the wire for this filter.</div> : null}
          </div>
        </>
      ) : (
        <div className={styles.slips}>
          <p className={styles.adNote}>Ads pay when they run. Front-page ads pay more. Every inch you sell is an inch of news you don't run.</p>
          {ads.map((a, i) => {
            const placed = findAdBlock(game.draft, a.id);
            const size = adSize(a.id);
            return (
              <div
                key={a.id}
                className={`${styles.slip} ${styles.adSlip} ${placed ? styles.slipPlaced : ''}`}
                style={{ transform: `rotate(${i % 2 ? 0.3 : -0.25}deg)` }}
                onPointerDown={(e) =>
                  beginDrag(e, { kind: 'ad', adId: a.id, fromBlock: !!placed }, size, { dc: size.cols / 2, dr: 0.5 }, placed ? () => { setPage(placed.page); select(placed.block.id); } : undefined)
                }
              >
                <div className={styles.slipMeta}>
                  <span>{a.type === 'government' ? 'Public notice' : (a.sector ?? '').replace(/_/g, ' ')}</span>
                  <span>{size.cols}×{size.rows} · {size.cols * size.rows} in</span>
                </div>
                <div className={styles.slipHead}>{displayName(a.name)}</div>
                <div className={styles.slipStatus}>
                  {placed ? <span className={styles.onPage}>Running on {pageLabel(placed.page)}</span> : <span>Drag to the page</span>}
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
