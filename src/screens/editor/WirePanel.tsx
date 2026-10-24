// Left side of the layout tab: the articles you picked for print, and the ad desk.
import { useCallback } from 'react';
import { articleSource } from '../../data/ArticleSource.ts';
import { displayName, loadGameData } from '../../data/worldData.ts';
import { adPay, adSize, defaultShape, findAdBlock, findStoryBlock, pageLabel, placementLabel } from '../../sim/layout.ts';
import { selectedForPrint } from '../../sim/newsroom.ts';
import { adStatus, likesLabel, nextAdvertiser } from '../../sim/ads.ts';
import { ADVERTISERS, FRONT_PAGE_AD_MULTIPLIER } from '../../sim/balance.ts';
import { totalReaders } from '../../sim/readers.ts';
import { CATEGORY_LABEL } from '../../sim/staff.ts';
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
  // Open advertisers first, then those who pulled out, then those waiting for a bigger paper.
  const order = { open: 0, pulled: 1, locked: 2 } as const;
  const sortedAds = ads
    .map((entity) => ({ entity, status: adStatus(game, entity) }))
    .sort((x, y) => order[x.status.state] - order[y.status.state] || x.entity.min_readers - y.entity.min_readers);

  return (
    <div ref={ref} className={styles.wire}>
      <div className={styles.wireTabs}>
        <button className={tab === 'print' ? styles.tabOn : ''} onClick={() => setTab('print')}>
          For print <span className="mono">{pile.length - placedCount} to place</span>
        </button>
        <button className={tab === 'ads' ? styles.tabOn : ''} onClick={() => setTab('ads')}>
          Ad desk <span className="mono">{sortedAds.filter((a) => !findAdBlock(game.draft, a.entity.id) && a.status.state === 'open').length} open</span>
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
          <AdRules />
          {sortedAds.map(({ entity: a, status }, i) => {
            const placed = findAdBlock(game.draft, a.id);
            const size = adSize(a.id);
            const usable = status.state === 'open';
            return (
              <div
                key={a.id}
                className={`${styles.slip} ${styles.adSlip} ${placed ? styles.slipPlaced : ''} ${usable ? '' : styles.adLocked}`}
                style={{ transform: `rotate(${i % 2 ? 0.3 : -0.25}deg)` }}
                onPointerDown={(e) =>
                  usable ? beginDrag(e, { kind: 'ad', adId: a.id, fromBlock: !!placed }, size, { dc: size.cols / 2, dr: 0.5 }, placed ? () => { setPage(placed.page); select(placed.block.id); } : undefined) : undefined
                }
              >
                <div className={styles.slipMeta}>
                  <span>{a.type === 'government' ? 'Public notice' : (a.sector ?? '').replace(/_/g, ' ')}</span>
                  <span>{size.cols}×{size.rows} · {size.cols * size.rows} in</span>
                </div>
                <div className={styles.slipHead}>{displayName(a.name)}</div>
                {status.state !== 'locked' ? <Goodwill value={status.relationship} /> : null}
                <div className={`${styles.adReason} ${status.state === 'pulled' || status.mood === 'angry' ? styles.adBad : status.mood === 'uneasy' ? styles.adWarn : ''}`}>{status.reason}</div>
                <div className={styles.slipStatus}>
                  <span>
                    {placed ? <span className={styles.onPage}>Running on {pageLabel(placed.page)}</span> : usable ? 'Drag to the page' : status.state === 'locked' ? 'Not signed yet' : 'Not buying'}
                    {' · '}likes {likesLabel(a.likes, CATEGORY_LABEL)}
                  </span>
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

/** How the ad desk works, and who signs up next. */
function AdRules() {
  const game = useStore((s) => s.game)!;
  const { world } = loadGameData();
  const next = nextAdvertiser(game, world);
  const readers = totalReaders(game.districts);
  return (
    <div className={styles.adRules}>
      <div className={styles.adRulesHead}>How the ad desk works</div>
      <p>
        <b>Getting more ads.</b> Advertisers pay each issue their ad runs (front page ×{FRONT_PAGE_AD_MULTIPLIER}). Bigger advertisers only sign once you have
        enough readers.{' '}
        {next ? (
          <>
            Next: <b>{displayName(next.name)}</b> at {next.min_readers.toLocaleString('en-US')} readers (you have {readers.toLocaleString('en-US')}).
          </>
        ) : (
          'Every advertiser in town has signed.'
        )}
      </p>
      <p>
        <b>Losing them.</b> A hard-hitting story about an advertiser costs up to {ADVERTISERS.hitPenalty} goodwill (most on the front page). Under{' '}
        {ADVERTISERS.pullBelow} they pull their ads for {ADVERTISERS.pullIssues} issues.
      </p>
      <p>
        <b>Winning them back.</b> Goodwill returns {ADVERTISERS.recovery} an issue, {ADVERTISERS.recovery + ADVERTISERS.likedBonus} when you run (not hard-hitting)
        coverage from a desk they like.
      </p>
    </div>
  );
}

/** Goodwill bar with a mark where they pull out. */
function Goodwill({ value }: { value: number }) {
  return (
    <div className={styles.goodwill} title={`Goodwill ${value}/100; they pull out below ${ADVERTISERS.pullBelow}`}>
      <span>Goodwill</span>
      <div className={styles.goodwillBar}>
        <i style={{ width: `${value}%` }} className={value < ADVERTISERS.pullBelow ? styles.goodwillLow : ''} />
        <b style={{ left: `${ADVERTISERS.pullBelow}%` }} />
      </div>
      <span>{value}</span>
    </div>
  );
}
