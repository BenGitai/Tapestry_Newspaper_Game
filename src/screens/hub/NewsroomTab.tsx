// Newsroom: who's on staff and what they filed. Review articles, star the good
// ones, pick what goes to print, and commission extra stories off the wire.
import { useState } from 'react';
import { articleSource } from '../../data/ArticleSource.ts';
import { ANGLES, type Angle, type Reporter, type Story } from '../../data/schemas.ts';
import { loadGameData, subtopicName } from '../../data/worldData.ts';
import { articleInches, backlog, hasRoomFor, isCovered, isLocalPatch, localLeads, remainingCapacity, selectedForPrint, wireForIssue } from '../../sim/newsroom.ts';
import { activeStaff, CATEGORY_LABEL, currentAttributes, filingCapacity, reporterById, shownAssignment } from '../../sim/staff.ts';
import type { Article, GameState, StaffMember } from '../../sim/types.ts';
import { useStore } from '../../state/store.ts';
import { ANGLE_LABEL, articleScorecard, bylineOf, OriginalStoryLink, ScoreChips, ScoutingReport, STYLE_SHORT } from '../../components/newsroom/ArticleParts.tsx';
import { assignmentSummary, AttributeTable, ReporterHeader, StrengthsLine } from '../../components/staff/StaffParts.tsx';
import { PhotoBox } from '../../components/paper/Halftone.tsx';
import { SubNav } from './SubNav.tsx';
import styles from './Hub.module.css';
import n from './Newsroom.module.css';

type Pile = 'issue' | 'backlog' | 'favorites' | 'print';

export function NewsroomTab() {
  const game = useStore((s) => s.game)!;
  const focus = useStore((s) => s.focusReporterId);
  const setFocus = useStore((s) => s.focusReporter);
  const selectedId = useStore((s) => s.selectedArticleId);
  const selectArticle = useStore((s) => s.selectArticle);
  const setTab = useStore((s) => s.setHubTab);
  const [pile, setPile] = useState<Pile>('issue');
  const [view, setView] = useState<'articles' | 'wire'>('articles');
  const { world } = loadGameData();

  const all = backlog(game);
  const piles: Record<Pile, Article[]> = {
    issue: all.filter((a) => a.issueFiled === game.issueNumber),
    backlog: all.filter((a) => a.issueFiled < game.issueNumber),
    favorites: all.filter((a) => a.favorite),
    print: selectedForPrint(game),
  };
  const shown = piles[pile].filter((a) => !focus || a.reporterId === focus);
  const selected = game.articles.find((a) => a.id === selectedId);
  const focusMember = game.staff.find((m) => m.reporterId === focus);

  const openArticle = (id: string) => selectArticle(id);
  const wireCount = wireForIssue(game, loadGameData().stories).filter((s) => !isCovered(game, s.id)).length;
  const leadCount = localLeads(game, loadGameData().stories).filter((s) => !isCovered(game, s.id)).length;
  const col = `${styles.col} ${styles.belowNav}`;

  return (
    <>
      <SubNav
        items={[
          { id: 'articles', label: `Filed articles (${piles.issue.length + piles.backlog.length})` },
          { id: 'wire', label: `The wire & local leads (${wireCount + leadCount} open)` },
        ]}
        value={view}
        onChange={setView}
      />
      {/* ---------- roster ---------- */}
      <section className={col} style={{ left: 14, width: 322 }}>
        <div className={`${styles.paper} ${n.rosterPaper}`}>
          <div className={styles.colHead}>
            <span className={styles.colTitle}>Your staff</span>
            <span className={styles.colSub}>{activeStaff(game).length} working</span>
          </div>
          <div className={styles.scroll}>
            <button className={`${n.rosterAll} ${focus === null ? n.rosterOn : ''}`} onClick={() => setFocus(null)}>
              Everyone's work
            </button>
            {game.staff.map((m) => (
              <RosterCard
                key={m.reporterId}
                game={game}
                member={m}
                on={focus === m.reporterId}
                onClick={() => {
                  setFocus(focus === m.reporterId ? null : m.reporterId);
                  setView('articles');
                  selectArticle(null);
                }}
              />
            ))}
          </div>
          <button className={styles.btn} onClick={() => setTab('staff')}>
            Hire &amp; manage staff ▸
          </button>
        </div>
      </section>

      {view === 'wire' ? <WireDesk game={game} /> : null}

      {/* ---------- article pile ---------- */}
      {view === 'articles' ? (
        <>
          <section className={col} style={{ left: 346, width: 616 }}>
            <div className={n.pileHead}>
              <div className={styles.subTabs}>
                {(
                  [
                    ['issue', `Filed this issue (${piles.issue.length})`],
                    ['backlog', `Backlog (${piles.backlog.length})`],
                    ['favorites', `★ Favorites (${piles.favorites.length})`],
                    ['print', `For print (${piles.print.length})`],
                  ] as [Pile, string][]
                ).map(([id, label]) => (
                  <button key={id} className={pile === id ? styles.subOn : ''} onClick={() => setPile(id)}>
                    {label}
                  </button>
                ))}
              </div>
              {focus ? (
                <button className={n.filterChip} onClick={() => setFocus(null)}>
                  Showing {reporterById(world, focus)?.name} ×
                </button>
              ) : null}
            </div>
            <div className={styles.scroll}>
              {shown.map((a, i) => (
                <ArticleSlip key={a.id} game={game} article={a} on={a.id === selectedId} tilt={i % 2 ? 0.25 : -0.2} onOpen={() => openArticle(a.id)} />
              ))}
              {shown.length === 0 ? <EmptyPile pile={pile} issue={game.issueNumber} /> : null}
            </div>
            <button className={styles.big} onClick={() => setTab('layout')}>
              To the layout · {piles.print.length} for print ▸
            </button>
          </section>

          {/* ---------- detail ---------- */}
          <section className={col} style={{ left: 972, right: 14 }}>
            <div className={`${styles.paper} ${n.sidePaper}`}>
              <div className={styles.colHead}>
                <span className={styles.colTitle}>{selected ? 'Article' : focusMember ? 'Reporter' : 'Details'}</span>
              </div>
              <div className={styles.scroll}>
                {selected ? (
                  <ArticleDetail game={game} article={selected} />
                ) : focusMember ? (
                  <ReporterProfile game={game} member={focusMember} />
                ) : (
                  <p className={styles.note}>Click an article to read it and see its scouting report, or a reporter to see their file.</p>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

function EmptyPile({ pile, issue }: { pile: Pile; issue: number }) {
  const text: Record<Pile, string> = {
    issue: 'Nothing filed for this issue. Check assignments on the Staff tab, or commission a story from the wire.',
    backlog: issue === 1 ? 'No backlog yet. Unpublished articles wait here for later issues, going stale as they sit.' : 'The backlog is empty.',
    favorites: 'Star articles you like to keep them handy.',
    print: 'Nothing picked for print. Use “For print” on an article.',
  };
  return <p className={n.empty}>{text[pile]}</p>;
}

function RosterCard({ game, member, on, onClick }: { game: GameState; member: StaffMember; on: boolean; onClick: () => void }) {
  const { world } = loadGameData();
  const r = reporterById(world, member.reporterId);
  if (!r) return null;
  const starts = member.hiredIssue > game.issueNumber;
  const cap = filingCapacity(r, member, game.setup.frequency);
  const used = cap - remainingCapacity(game, world, member);
  const filed = backlog(game).filter((a) => a.reporterId === r.id && a.issueFiled === game.issueNumber).length;
  const waiting = backlog(game).filter((a) => a.reporterId === r.id && a.issueFiled < game.issueNumber).length;
  return (
    <button className={`${n.roster} ${on ? n.rosterOn : ''}`} onClick={onClick}>
      <div className={n.rosterName}>
        <b>
          {r.name}
          {member.role === 'head' ? <em className={n.headBadge}> head</em> : null}
        </b>
        <span>{starts ? 'starts next issue' : `${filed} filed · ${waiting} waiting`}</span>
      </div>
      <div className={n.rosterAssign}>{assignmentSummary(shownAssignment(member))}</div>
      {member.pendingAssignment ? <div className={n.pending}>New assignment from next issue</div> : null}
      <div className={n.meterRow}>
        <span>Copy</span>
        <Meter v={used} max={cap} />
        <span>
          {Math.round(used)}/{cap} in
        </span>
      </div>
      <div className={n.meterRow}>
        <span>Morale</span>
        <Meter v={member.morale} max={100} low={member.morale < 35} />
        <span>{Math.round(member.morale)}</span>
      </div>
    </button>
  );
}

function Meter({ v, max, low }: { v: number; max: number; low?: boolean }) {
  return (
    <span className={styles.meter}>
      <span className={low || v > max ? styles.meterWarn : styles.meterFill} style={{ width: `${Math.min(100, (v / Math.max(1, max)) * 100)}%` }} />
    </span>
  );
}

function ArticleSlip({ game, article, on, tilt, onOpen }: { game: GameState; article: Article; on: boolean; tilt: number; onOpen: () => void }) {
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const toggleForPrint = useStore((s) => s.toggleForPrint);
  const sc = articleScorecard(game, article);
  if (!sc) return null;
  const age = game.issueNumber - article.issueFiled;
  return (
    <div className={`${n.slip} ${on ? n.slipOn : ''} ${article.selected ? n.slipPrint : ''}`} style={{ transform: `rotate(${tilt}deg)`, borderLeft: `5px solid var(--c-cat-${sc.story.category})` }} onClick={onOpen}>
      <div className={n.slipMeta}>
        <span>
          {bylineOf(article)} · {STYLE_SHORT[article.style]} · {ANGLE_LABEL[article.angle]} · {article.inches} in
          {article.onFocus ? <em className={n.focus}> · ★ focus</em> : null}
          {article.deskPick ? <em className={n.focus}> · desk pick</em> : null}
        </span>
        <span>
          {article.commissioned ? <em className={n.commissioned}>Commissioned · </em> : null}
          {sc.superseded ? <em className={n.stale}>Overtaken by events</em> : age > 0 ? <em className={n.stale}>{age} issue{age > 1 ? 's' : ''} old</em> : subtopicName(sc.story.subtopic)}
        </span>
      </div>
      <div className={n.slipHead}>{articleSource().get({ storyId: article.storyId, journalistId: article.reporterId, angle: article.angle, tier: 'secondary' }, sc.story).headline}</div>
      <div className={n.slipFoot}>
        <ScoreChips card={sc.card} />
        <div className={n.slipActions} onClick={(e) => e.stopPropagation()}>
          <button className={`${n.star} ${article.favorite ? n.starOn : ''}`} onClick={() => toggleFavorite(article.id)} title="Favorite">
            {article.favorite ? '★' : '☆'}
          </button>
          <button className={`${n.printBtn} ${article.selected ? n.printOn : ''}`} onClick={() => toggleForPrint(article.id)}>
            {article.selected ? '✓ For print' : 'For print'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ArticleDetail({ game, article }: { game: GameState; article: Article }) {
  const setAngle = useStore((s) => s.setArticleAngle);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const toggleForPrint = useStore((s) => s.toggleForPrint);
  const spike = useStore((s) => s.spike);
  const { stories } = loadGameData();
  const sc = articleScorecard(game, article);
  if (!sc) return null;
  const story = sc.story;
  const src = stories.wireSources().find((w) => w.id === story.wire_source);
  const copy = articleSource().get({ storyId: story.id, journalistId: article.reporterId, angle: article.angle, tier: 'lead' }, story);
  const editable = article.status === 'backlog';
  return (
    <>
      <PhotoBox width={404} height={120} label={story.photo ?? subtopicName(story.subtopic)} category={story.category} seed={story.id} />
      <div className={styles.kicker} style={{ color: `var(--c-cat-${story.category})` }}>
        {CATEGORY_LABEL[story.category]} · {subtopicName(story.subtopic)} · via {src?.name} · importance {story.importance}/5
      </div>
      <div className={n.detailHead}>{copy.headline}</div>
      <div className={n.detailMeta}>
        {bylineOf(article)} · {STYLE_SHORT[article.style]} · {article.inches} column inches · filed issue {article.issueFiled}
      </div>
      <OriginalStoryLink story={story} />

      <div className={styles.label}>Angle</div>
      <div className={n.seg}>
        {ANGLES.map((ang: Angle) => (
          <button
            key={ang}
            disabled={!editable || (ang === 'puff' && story.sensitivity === 'high') || (article.reporterId === null && ang !== 'straight')}
            className={article.angle === ang ? n.segOn : ''}
            onClick={() => setAngle(article.id, ang)}
          >
            {ANGLE_LABEL[ang]}
          </button>
        ))}
      </div>
      {story.sensitivity === 'high' ? <p className={styles.note}>Sensitive story: no Puff. The copy stays plain and respectful whatever the angle.</p> : null}

      <div className={styles.label}>Scouting report</div>
      <ScoutingReport card={sc.card} />

      <div className={styles.label}>Copy · {copy.origin === 'template' ? 'from the wire facts (template)' : copy.origin}</div>
      <div className={n.copy}>
        {copy.deck ? <i>{copy.deck}</i> : null}
        <p>{copy.body}</p>
      </div>

      {editable ? (
        <div className={n.detailActions}>
          <button className={styles.btn} onClick={() => toggleFavorite(article.id)}>
            {article.favorite ? '★ Unfavorite' : '☆ Favorite'}
          </button>
          <button className={`${styles.btn} ${article.selected ? '' : styles.btnPrimary}`} onClick={() => toggleForPrint(article.id)}>
            {article.selected ? 'Remove from print' : 'Pick for print'}
          </button>
          <button className={styles.linkBtn} onClick={() => spike(article.id)} title="Kill the story for good">
            Spike it
          </button>
        </div>
      ) : null}
    </>
  );
}

function ReporterProfile({ game, member }: { game: GameState; member: StaffMember }) {
  const setTab = useStore((s) => s.setHubTab);
  const { world } = loadGameData();
  const r = reporterById(world, member.reporterId) as Reporter;
  const attrs = currentAttributes(r, member);
  const published = game.articles.filter((a) => a.reporterId === r.id && a.status === 'published').length;
  return (
    <>
      <ReporterHeader reporter={r} sub={`morale ${Math.round(member.morale)}`} />
      <div className={styles.label}>Attributes</div>
      <AttributeTable reporter={r} attrs={attrs} scouted training={member.assignment.training} />
      <div style={{ marginTop: 6 }}>
        <StrengthsLine attrs={attrs} />
      </div>
      <div className={styles.label}>Assignment</div>
      <p className={styles.note}>{assignmentSummary(member.assignment)}</p>
      {member.pendingAssignment ? <p className={styles.note}>From next issue: {assignmentSummary(member.pendingAssignment)}</p> : null}
      <div className={styles.label}>Record</div>
      <p className={styles.note}>
        {published} published · {backlog(game).filter((a) => a.reporterId === r.id).length} unpublished · with you since issue {member.hiredIssue}
      </p>
      <button className={styles.btn} onClick={() => setTab('staff')}>
        Change assignment ▸
      </button>
    </>
  );
}

function WireDesk({ game }: { game: GameState }) {
  const commission = useStore((s) => s.commission);
  const { world, stories } = loadGameData();
  const wire = wireForIssue(game, stories);
  const leads = localLeads(game, stories);
  const open = wire.filter((s) => !isCovered(game, s.id));
  const openLeads = leads.filter((s) => !isCovered(game, s.id));
  const coveredWire = wire.filter((s) => isCovered(game, s.id));
  const coveredLocal = leads.filter((s) => isCovered(game, s.id));
  const staff = activeStaff(game);
  const [pick, setPick] = useState<Record<string, string>>({});
  const hasLocal = staff.some((m) => isLocalPatch(m.assignment.patch));

  const slip = (s: Story) => {
    const chosen = pick[s.id] ?? '';
    return (
      <div key={s.id} className={n.wireSlip} style={{ borderLeftColor: `var(--c-cat-${s.category})` }}>
        <div className={n.slipMeta}>
          <span style={{ color: `var(--c-cat-${s.category})` }}>
            {CATEGORY_LABEL[s.category]} · {subtopicName(s.subtopic)} · {s.base_column_inches} in
          </span>
          <span>{'■'.repeat(s.importance)}{'□'.repeat(5 - s.importance)}</span>
        </div>
        <div className={n.wireHead}>{s.wire_headline}</div>
        {s.sensitivity === 'high' ? <div className={n.sensitive}>Sensitive</div> : null}
        <OriginalStoryLink story={s} />
        <div className={n.commissionRow}>
          <select value={chosen} onChange={(e) => setPick({ ...pick, [s.id]: e.target.value })}>
            <option value="">Commission…</option>
            {staff.map((m) => {
              const r = reporterById(world, m.reporterId);
              const room = Math.floor(remainingCapacity(game, world, m));
              const need = articleInches(s, m.assignment.style);
              const ok = hasRoomFor(game, world, m, need);
              return (
                <option key={m.reporterId} value={m.reporterId} disabled={!ok}>
                  {r?.name} ({Math.max(0, room)} in left{!ok ? `, needs ${need}` : ''})
                </option>
              );
            })}
          </select>
          <button className={styles.btn} disabled={!chosen} onClick={() => commission(s.id, chosen)}>
            Assign
          </button>
          <button className={styles.linkBtn} onClick={() => commission(s.id, null)}>
            Wire copy
          </button>
        </div>
      </div>
    );
  };

  const col = `${styles.col} ${styles.belowNav}`;
  return (
    <>
      <section className={col} style={{ left: 346, width: 540 }}>
        <div className={`${styles.paper} ${n.sidePaper}`}>
          <div className={styles.colHead}>
            <span className={styles.colTitle}>National &amp; world wire</span>
            <span className={styles.colSub}>{open.length} uncovered</span>
          </div>
          <p className={styles.note}>
            Real news from NPR, BBC News and PBS NewsHour. Commission a story and the reporter writes it now with their remaining copy, or run the wire copy
            as-is (no byline, straight).
          </p>
          <div className={styles.scroll}>
            {open.map(slip)}
            {open.length === 0 ? <p className={styles.note}>Every story on the wire is covered.</p> : null}
            {coveredWire.length ? (
              <>
                <div className={styles.label}>Already covered</div>
                {coveredWire.map((s) => {
                const a = game.articles.find((x) => x.storyId === s.id && x.status !== 'spiked');
                return (
                  <div key={s.id} className={n.coveredRow}>
                    <span>{s.wire_headline}</span>
                    <em>{a ? bylineOf(a) : ''}</em>
                  </div>
                );
              })}
              </>
            ) : null}
          </div>
        </div>
      </section>
      <section className={col} style={{ left: 896, right: 14 }}>
        <div className={`${styles.paper} ${n.sidePaper}`}>
          <div className={styles.colHead}>
            <span className={styles.colTitle}>Philadelphia leads</span>
            <span className={styles.colSub}>{hasLocal ? `${openLeads.length} uncovered` : 'no local reporters'}</span>
          </div>
          <p className={styles.note}>City stories your reporters on a Philadelphia or district patch dug up. They sell best in their own neighborhood.</p>
          <div className={styles.scroll}>
            {hasLocal ? (
              <>
                {openLeads.map(slip)}
                {openLeads.length === 0 ? <p className={styles.note}>Your local reporters have covered every lead they found.</p> : null}
              </>
            ) : (
              <p className={styles.note}>No city news this issue: nobody works a local patch. Put a reporter on Philadelphia or a district on the Staff tab.</p>
            )}
            {coveredLocal.length ? (
              <>
                <div className={styles.label}>Already covered</div>
                {coveredLocal.map((s) => {
                const a = game.articles.find((x) => x.storyId === s.id && x.status !== 'spiked');
                return (
                  <div key={s.id} className={n.coveredRow}>
                    <span>{s.wire_headline}</span>
                    <em>{a ? bylineOf(a) : ''}</em>
                  </div>
                );
              })}
              </>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
