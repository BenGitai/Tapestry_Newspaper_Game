// Staff: manage your reporters (assignment, workload, training) and recruit new ones.
import { useState } from 'react';
import { DESKS, type Desk, type Reporter } from '../../data/schemas.ts';
import { loadGameData } from '../../data/worldData.ts';
import { HEAD, MAX_STAFF, REFERENCE_CHECK_COST } from '../../sim/balance.ts';
import { canPromote, DEFAULT_DUTIES, deskMembers, DUTY_HELP, DUTY_LABEL, editingSkill, headActive, headOf, leadershipSkill, memberDesk } from '../../sim/desks.ts';
import {
  currentAttributes,
  DESK_LABEL,
  filingCapacity,
  isScouted,
  payroll,
  reporterById,
  salaryOf,
  severance,
  shownAssignment,
  signingFee,
} from '../../sim/staff.ts';
import type { DeskDuties, GameState, StaffMember } from '../../sim/types.ts';
import { useStore } from '../../state/store.ts';
import { assignmentSummary, AssignmentEditor, AttributeTable, ReporterHeader, StrengthsLine } from '../../components/staff/StaffParts.tsx';
import styles from './Hub.module.css';
import { SubNav } from './SubNav.tsx';
import s from './Staff.module.css';

export function StaffTab() {
  const game = useStore((st) => st.game)!;
  const { world } = loadGameData();
  const [selected, setSelected] = useState<string>(game.staff[0]?.reporterId ?? '');
  const [candidate, setCandidate] = useState<string | null>(null);
  const member = game.staff.find((m) => m.reporterId === selected);
  const market = world.staff_pool.filter((r) => !game.staff.some((m) => m.reporterId === r.id));
  const [view, setView] = useState<'staff' | 'market'>('staff');
  const col = `${styles.col} ${styles.belowNav}`;
  const picked = candidate ? reporterById(world, candidate) : undefined;

  return (
    <>
      <SubNav
        items={[
          { id: 'staff', label: `Your staff (${game.staff.length})` },
          { id: 'market', label: `Help wanted (${market.length})` },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'staff' ? (
        <>
          {/* ---------- your staff ---------- */}
          <section className={col} style={{ left: 14, width: 340 }}>
            <div className={`${styles.paper} ${s.listPaper}`}>
              <div className={styles.colHead}>
                <span className={styles.colTitle}>Newsroom</span>
                <span className={styles.colSub}>
                  {game.staff.length}/{MAX_STAFF} · ${payroll(world, game.staff)}/issue
                </span>
              </div>
              <div className={styles.scroll}>
                {deskGroups(game).map((group) => (
                  <div key={group.key} className={s.deskGroup}>
                    <div className={s.deskHead}>
                      <b>{group.label}</b>
                      <span>
                        {group.members.length} on desk
                        {group.desk ? (headOf(game, group.desk) ? (headActive(game, world, group.desk) ? ' · has a head' : ' · head inactive') : group.members.length >= HEAD.minDesk ? ' · can promote a head' : '') : ''}
                      </span>
                    </div>
                    {group.members.map((m) => {
                      const r = reporterById(world, m.reporterId);
                      if (!r) return null;
                      return (
                        <button key={m.reporterId} className={`${s.staffRow} ${selected === m.reporterId ? s.on : ''}`} onClick={() => setSelected(m.reporterId)}>
                          <b>
                            {r.name}
                            {m.role === 'head' ? <em className={s.headTag}>Desk head</em> : null}
                          </b>
                          <span>{m.role === 'head' ? 'Edits and runs the desk' : assignmentSummary(shownAssignment(m))}</span>
                          <span className={s.rowMeta}>
                            {filingCapacity(r, m, game.setup.frequency)} in/issue · morale {Math.round(m.morale)} · ${salaryOf(world, m)}
                            {m.pendingAssignment ? ' · changes next issue' : ''}
                            {m.hiredIssue > game.issueNumber ? ' · starts next issue' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- manage selected ---------- */}
          <section className={col} style={{ left: 364, right: 14 }}>
            <div className={`${styles.paper} ${s.managePaper}`}>
              {member ? <ManageReporter game={game} member={member} /> : <p className={styles.note}>Pick a reporter, or hire one under Help wanted.</p>}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* ---------- recruitment market ---------- */}
          <section className={col} style={{ left: 14, width: 860 }}>
            <div className={`${styles.paper} ${s.marketPaper}`}>
              <div className={styles.colHead}>
                <span className={styles.colTitle}>Help wanted</span>
                <span className={styles.colSub}>{market.length} available</span>
              </div>
              <p className={styles.note}>
                Reporters on the market. Until you check references (${REFERENCE_CHECK_COST}), you only have a rough idea of their abilities.
              </p>
              <div className={`${styles.scroll} ${s.marketGrid}`}>
                {market.map((r) => {
                  const scouted = isScouted(game, r.id);
                  return (
                    <button key={r.id} className={`${s.candidate} ${candidate === r.id ? s.on : ''}`} onClick={() => setCandidate(r.id)}>
                      <div className={s.candHead}>
                        <b>{r.name}</b>
                        <span>
                          {DESK_LABEL[r.desk]} · ${r.salary_per_issue}/issue
                        </span>
                      </div>
                      <AttributeTable reporter={r} attrs={r.attributes} scouted={scouted} />
                      {!scouted ? <span className={s.rough}>Rough estimate</span> : null}
                    </button>
                  );
                })}
                {market.length === 0 ? <p className={styles.note}>Nobody else is looking for work.</p> : null}
              </div>
            </div>
          </section>
          <section className={col} style={{ left: 884, right: 14 }}>
            <div className={`${styles.paper} ${s.managePaper}`}>
              {picked ? (
                <CandidateFile
                  game={game}
                  reporter={picked}
                  onHired={(id) => {
                    setSelected(id);
                    setCandidate(null);
                    setView('staff');
                  }}
                />
          ) : (
                <p className={styles.note}>Click a candidate to see their file, check references or hire them.</p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function ManageReporter({ game, member }: { game: GameState; member: StaffMember }) {
  const setAssignment = useStore((st) => st.setAssignment);
  const release = useStore((st) => st.release);
  const [confirm, setConfirm] = useState(false);
  const { world } = loadGameData();
  const r = reporterById(world, member.reporterId) as Reporter;
  const attrs = currentAttributes(r, member);
  const published = game.articles.filter((a) => a.reporterId === r.id && a.status === 'published').length;
  const unpublished = game.articles.filter((a) => a.reporterId === r.id && a.status === 'backlog').length;
  const startsLater = member.hiredIssue > game.issueNumber;

  return (
    <div className={s.manage}>
      <ReporterHeader reporter={r} sub={startsLater ? 'starts next issue' : `with you since issue ${member.hiredIssue}`} />

      <div className={s.twoCol}>
        <div>
          <div className={styles.label}>Attributes</div>
          <AttributeTable reporter={r} attrs={attrs} scouted training={shownAssignment(member).training} />
          <div style={{ marginTop: 6 }}>
            <StrengthsLine attrs={attrs} />
          </div>
        </div>
        <div>
          <div className={styles.label}>Condition</div>
          <div className={s.stat}>
            <span>Morale</span>
            <b className={member.morale < 35 ? s.bad : member.morale > 70 ? s.good : ''}>{Math.round(member.morale)}/100</b>
          </div>
          <div className={s.stat}>
            <span>Published</span>
            <b>{published}</b>
          </div>
          <div className={s.stat}>
            <span>Unpublished</span>
            <b>{unpublished}</b>
          </div>
          <div className={s.stat}>
            <span>Salary</span>
            <b>${salaryOf(world, member)}/issue</b>
          </div>
        </div>
      </div>

      <DeskPanel game={game} member={member} reporter={r} />

      <div className={styles.label}>Assignment {startsLater ? '' : '· changes apply from next issue'}</div>
      <AssignmentEditor reporter={r} member={member} value={shownAssignment(member)} onChange={(a) => setAssignment(r.id, a)} frequency={game.setup.frequency} />
      {member.pendingAssignment ? (
        <p className={s.pending}>
          Now: {assignmentSummary(member.assignment)}. Next issue: {assignmentSummary(member.pendingAssignment)}.
          <button className={styles.linkBtn} onClick={() => setAssignment(r.id, member.assignment)}>
            Undo change
          </button>
        </p>
      ) : null}

      <div className={styles.label}>Contract</div>
      {confirm ? (
        <div className={s.confirm}>
          Release {r.name}? Severance is ${severance(r)}, and their unpublished work goes with them.
          <button className={styles.btn} onClick={() => release(r.id)}>
            Yes, release
          </button>
          <button className={styles.linkBtn} onClick={() => setConfirm(false)}>
            Keep
          </button>
        </div>
      ) : (
        <button className={styles.linkBtn} onClick={() => setConfirm(true)}>
          Release from contract (${severance(r)} severance)
        </button>
      )}
    </div>
  );
}

function CandidateFile({ game, reporter, onHired }: { game: GameState; reporter: Reporter; onHired: (id: string) => void }) {
  const hire = useStore((st) => st.hire);
  const checkReferences = useStore((st) => st.checkReferences);
  const scouted = isScouted(game, reporter.id);
  const full = game.staff.length >= MAX_STAFF;
  return (
    <div className={s.manage}>
      <div className={styles.kicker}>Candidate file</div>
      <ReporterHeader reporter={reporter} />
      <div className={styles.label}>{scouted ? 'Attributes (references checked)' : 'Attributes (rough estimate)'}</div>
      <AttributeTable reporter={reporter} attrs={reporter.attributes} scouted={scouted} />
      {scouted ? (
        <div style={{ marginTop: 6 }}>
          <StrengthsLine attrs={reporter.attributes} />
        </div>
      ) : (
        <p className={styles.note}>
          Their clips suggest the ranges above. A reference check (${REFERENCE_CHECK_COST}) tells you exactly what you'd be getting.
        </p>
      )}
      <div className={styles.label}>Terms</div>
      <p className={styles.note}>
        Salary ${reporter.salary_per_issue} per issue. Signing fee ${signingFee(reporter)}. Starts next issue on their home desk; you can set the assignment
        before then.
      </p>
      <div className={s.actions}>
        {!scouted ? (
          <button className={styles.btn} onClick={() => checkReferences(reporter.id)}>
            Check references (${REFERENCE_CHECK_COST})
          </button>
        ) : null}
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={full}
          onClick={() => {
            const before = useStore.getState().game?.staff.length ?? 0;
            hire(reporter.id);
            if ((useStore.getState().game?.staff.length ?? 0) > before) onHired(reporter.id);
          }}
          title={full ? `The newsroom holds ${MAX_STAFF}` : undefined}
        >
          Hire (${signingFee(reporter)})
        </button>
      </div>
    </div>
  );
}

/** Staff grouped by the desk they work, heads first; World & national last. */
function deskGroups(game: GameState): { key: string; label: string; desk?: Desk; members: StaffMember[] }[] {
  const { world } = loadGameData();
  const groups = new Map<string, { key: string; label: string; desk?: Desk; members: StaffMember[] }>();
  for (const m of game.staff) {
    const desk = memberDesk(world, m);
    const key = desk ?? 'world';
    if (!groups.has(key)) groups.set(key, { key, label: desk ? `${DESK_LABEL[desk]} desk` : 'World & national', desk, members: [] });
    groups.get(key)!.members.push(m);
  }
  const order = [...DESKS, 'world'];
  return [...groups.values()]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((g) => ({ ...g, members: [...g.members].sort((a, b) => Number(b.role === 'head') - Number(a.role === 'head')) }));
}

function DeskPanel({ game, member, reporter }: { game: GameState; member: StaffMember; reporter: Reporter }) {
  const promote = useStore((st) => st.promote);
  const stepDown = useStore((st) => st.stepDown);
  const setDuties = useStore((st) => st.setDuties);
  const { world } = loadGameData();
  const editing = editingSkill(reporter, member);
  const leadership = leadershipSkill(reporter, member);

  if (member.role === 'head' && member.headOf) {
    const desk = member.headOf;
    const duties = member.duties ?? DEFAULT_DUTIES;
    const active = headActive(game, world, desk);
    const crew = deskMembers(game, world, desk).filter((m) => m.role !== 'head');
    return (
      <>
        <div className={styles.label}>Head of the {DESK_LABEL[desk]} desk</div>
        <div className={s.headStats}>
          <span>
            Editing <b>{editing}</b>
          </span>
          <span>
            Leadership <b>{leadership}</b>
          </span>
          <span>
            Reporters <b>{crew.length}</b>
          </span>
        </div>
        {!active ? <p className={s.warnLine}>The desk has fewer than {HEAD.minDesk} journalists. The head can’t do much until you add reporters to it.</p> : null}
        <p className={styles.note}>Choose what to delegate. Their reporters also train faster and stay happier.</p>
        <div className={s.duties}>
          {(Object.keys(DUTY_LABEL) as (keyof DeskDuties)[]).map((k) => (
            <label key={k} className={s.duty}>
              <input type="checkbox" checked={duties[k]} onChange={(e) => setDuties(reporter.id, { ...duties, [k]: e.target.checked })} />
              <span>
                <b>{DUTY_LABEL[k]}</b> {DUTY_HELP[k]}
              </span>
            </label>
          ))}
        </div>
        <button className={styles.linkBtn} onClick={() => stepDown(reporter.id)}>
          Step down to reporter (morale −{HEAD.demotionMorale})
        </button>
      </>
    );
  }

  const check = canPromote(game, world, reporter.id);
  return (
    <>
      <div className={styles.label}>Desk head</div>
      <div className={s.headStats}>
        <span>
          Editing <b>{editing}</b>
        </span>
        <span>
          Leadership <b>{leadership}</b>
        </span>
      </div>
      {check.ok ? (
        <p className={styles.note}>
          Promote {reporter.name} to head the {DESK_LABEL[check.desk]} desk? They mostly stop writing ({Math.round(HEAD.writingShare * 100)}% of their output)
          and are paid ×{HEAD.salaryMultiplier} (${salaryOf(world, { ...member, role: 'head' })}/issue).{' '}
          <button className={styles.linkBtn} onClick={() => promote(reporter.id)}>
            Promote
          </button>
        </p>
      ) : (
        <p className={s.mutedLine}>{check.reason}.</p>
      )}
    </>
  );
}
