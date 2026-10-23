// After the press run: the printed paper on the left, the results sheet on the right.
import { useState } from 'react';
import { displayName, loadGameData } from '../data/worldData.ts';
import { activePages, pageLabel } from '../sim/layout.ts';
import { issueCount } from '../sim/newGame.ts';
import { leanLabel } from '../sim/paperStats.ts';
import { initials, reporterById } from '../sim/staff.ts';
import type { IssueResult, PageId } from '../sim/types.ts';
import { useStore } from '../state/store.ts';
import { DeskSurface } from '../components/desk/DeskSurface.tsx';
import { PageSheet } from '../components/paper/PageSheet.tsx';
import styles from './PressRun.module.css';

function signed(n: number, prefix = ''): string {
  const r = Math.round(n);
  return `${r >= 0 ? '+' : '−'}${prefix}${Math.abs(r).toLocaleString()}`;
}

export function PressRun() {
  const game = useStore((s) => s.game);
  const nextIssue = useStore((s) => s.nextIssue);
  const [page, setPage] = useState<PageId>('front');
  const printed = game?.archive[game.archive.length - 1];
  const result = game?.results[game.results.length - 1];
  if (!game || !printed || !result) return null;
  const { world, stories } = loadGameData();
  const last = !!game.endReason || game.issueNumber >= issueCount(game.setup.frequency, stories.dayCount());

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
      <div className={styles.pages}>
        {activePages(printed.draft).map((p) => (
          <button key={p} className={p === page ? styles.on : ''} onClick={() => setPage(p)}>
            {pageLabel(p)}
          </button>
        ))}
      </div>

      <aside className={styles.results}>
        <div className={styles.head}>
          <div>
            <div className={styles.kicker}>Results sheet · issue {result.issueNumber} · {result.dateLabel}</div>
            <h1 className={styles.title}>How the paper did</h1>
          </div>
          <div className={styles.stamp}>Printed</div>
        </div>
        <div className={styles.scroll}>
          <Headline result={result} />
          <Money result={result} />
          <Districts result={result} />
          <Revealed result={result} />
          {result.events.length ? (
            <section>
              <h2>What happened</h2>
              <ul className={styles.events}>
                {result.events.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <Rival result={result} />
          <Letters result={result} />
        </div>
        <button className={styles.next} onClick={nextIssue}>
          {game.endReason ? 'The presses stop' : last ? 'Close the books' : 'Next issue ▸'}
        </button>
      </aside>
    </DeskSurface>
  );
}

function Headline({ result }: { result: IssueResult }) {
  return (
    <div className={styles.bigRow}>
      <Big label="Copies sold" value={result.copies.toLocaleString()} change={signed(result.copiesChange)} good={result.copiesChange >= 0} />
      <Big label="Profit" value={`${result.profit < 0 ? '−' : ''}$${Math.abs(result.profit).toLocaleString()}`} change={`cash $${result.cashAfter.toLocaleString()}`} good={result.profit >= 0} />
      <Big label="Trust" value={`${Math.round(result.trustAfter)}`} change={signed(result.trustAfter - result.trustBefore)} good={result.trustAfter >= result.trustBefore} />
      <Big label="Seen as" value={leanLabel(result.leanAfter)} change={result.leanAfter === result.leanBefore ? 'no change' : `was ${leanLabel(result.leanBefore)}`} />
    </div>
  );
}

function Big({ label, value, change, good }: { label: string; value: string; change: string; good?: boolean }) {
  return (
    <div className={styles.big}>
      <span className={styles.bigLabel}>{label}</span>
      <span className={styles.bigValue}>{value}</span>
      <span className={good === undefined ? styles.bigChange : good ? styles.good : styles.bad}>{change}</span>
    </div>
  );
}

function Money({ result }: { result: IssueResult }) {
  const rows: [string, number][] = [
    ['Copy sales', result.revenue.sales],
    ['Ads', result.revenue.ads],
    ...(result.revenue.prizes ? ([['Prize money', result.revenue.prizes]] as [string, number][]) : []),
    ['Printing', -result.costs.printing],
    ['Distribution & delivery', -result.costs.distribution],
    ['Payroll', -result.costs.payroll],
    ['Overhead', -result.costs.overhead],
    ...(result.costs.wire ? ([['Wire fees', -result.costs.wire]] as [string, number][]) : []),
    ...(result.costs.debt ? ([['Debt payments', -result.costs.debt]] as [string, number][]) : []),
  ];
  return (
    <section>
      <h2>The books</h2>
      <div className={styles.ledger}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <b className={v < 0 ? styles.bad : styles.good}>{signed(v, '$')}</b>
          </div>
        ))}
        <div className={styles.total}>
          <span>Profit</span>
          <b className={result.profit < 0 ? styles.bad : styles.good}>{signed(result.profit, '$')}</b>
        </div>
      </div>
    </section>
  );
}

function Districts({ result }: { result: IssueResult }) {
  const { world } = loadGameData();
  return (
    <section>
      <h2>Sales by district</h2>
      <div className={styles.table}>
        <div className={styles.th}>
          <span>District</span>
          <span>Readers</span>
          <span>Trust</span>
          <span>Mood</span>
        </div>
        {world.districts.map((d) => {
          const r = result.districts[d.id];
          if (!r) return null;
          const mood = r.satisfaction >= 1.4 ? 'Delighted' : r.satisfaction >= 0.9 ? 'Happy' : r.satisfaction >= 0.5 ? 'Lukewarm' : 'Ignored';
          return (
            <div key={d.id} className={styles.tr}>
              <span>{d.name}</span>
              <span>
                {r.readers.toLocaleString()} <em className={r.readersChange >= 0 ? styles.good : styles.bad}>{signed(r.readersChange)}</em>
              </span>
              <span>
                {Math.round(r.trust)} <em className={r.trustChange >= 0 ? styles.good : styles.bad}>{signed(r.trustChange)}</em>
              </span>
              <span className={r.satisfaction < 0.5 ? styles.bad : ''}>{mood}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Revealed({ result }: { result: IssueResult }) {
  const { world, stories } = loadGameData();
  if (!result.revealed.length) return null;
  return (
    <section>
      <h2>The hidden half, revealed</h2>
      <div className={styles.table}>
        {result.revealed.map((o) => {
          const r = o.reporterId ? reporterById(world, o.reporterId) : undefined;
          return (
            <div key={o.articleId} className={styles.revealRow}>
              <span>
                {stories.storyById(o.storyId)?.wire_headline} <em>{r ? initials(r.name) : 'wire'}</em>
              </span>
              <span className={o.correction ? styles.bad : styles.quiet}>{o.correction ? 'Correction' : 'Accurate'}</span>
              <span className={o.award ? styles.good : styles.quiet}>{o.award ? 'Award' : '—'}</span>
              {o.sensationalSwing ? <span className={o.sensationalSwing === 'up' ? styles.good : styles.bad}>{o.sensationalSwing === 'up' ? 'Sold big' : 'Backfired'}</span> : <span />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Rival({ result }: { result: IssueResult }) {
  const { world, stories } = loadGameData();
  const [lead, ...rest] = result.rivalFront;
  if (!lead) return null;
  return (
    <section>
      <h2>What the rival ran</h2>
      <div className={styles.rival}>
        <div className={styles.rivalMast}>{displayName(world.rival.name)}</div>
        <div className={styles.rivalLead}>{stories.storyById(lead)?.wire_headline}</div>
        <ul>
          {rest.map((id) => (
            <li key={id}>{stories.storyById(id)?.wire_headline}</li>
          ))}
        </ul>
      </div>
      {result.scoops.length ? <p className={styles.good}>You scooped them on {result.scoops.length} front-page {result.scoops.length === 1 ? 'story' : 'stories'}.</p> : null}
    </section>
  );
}

function Letters({ result }: { result: IssueResult }) {
  if (!result.letters.length) return null;
  return (
    <section>
      <h2>Letters to the editor</h2>
      {result.letters.map((l, i) => (
        <div key={i} className={styles.letter}>
          <p>“{l.text}”</p>
          <span>
            — {l.name}, {l.place}
          </span>
        </div>
      ))}
    </section>
  );
}
