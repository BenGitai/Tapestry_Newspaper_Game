// Hiring day: pick your starting reporters within the payroll budget and give
// each one an assignment before the first issue.
import { useState } from 'react';
import type { Reporter } from '../data/schemas.ts';
import { loadGameData } from '../data/worldData.ts';
import { STARTING_STAFF } from '../sim/balance.ts';
import { suggestStartingStaff, type Hire } from '../sim/newGame.ts';
import { checkStartingStaff, defaultAssignment, payroll, startingPayrollCap } from '../sim/staff.ts';
import type { StaffAssignment } from '../sim/types.ts';
import { useStore } from '../state/store.ts';
import { DeskSurface } from '../components/desk/DeskSurface.tsx';
import { AssignmentEditor, AttributeTable, ReporterHeader, StrengthsLine } from '../components/staff/StaffParts.tsx';
import styles from './HiringScreen.module.css';

export function HiringScreen() {
  const setup = useStore((s) => s.pendingSetup);
  const startGame = useStore((s) => s.startGame);
  const goto = useStore((s) => s.goto);
  const { world } = loadGameData();
  const [hires, setHires] = useState<Hire[]>(() =>
    setup ? suggestStartingStaff(world, setup).map((r) => ({ reporterId: r.id, assignment: defaultAssignment(world, r) })) : [],
  );
  if (!setup) return null;

  const cap = startingPayrollCap(setup.origin);
  const pay = payroll(world, hires);
  const check = checkStartingStaff(world, setup.origin, hires.map((h) => h.reporterId));
  const hired = (id: string) => hires.some((h) => h.reporterId === id);

  const toggle = (r: Reporter) =>
    setHires((hs) => (hired(r.id) ? hs.filter((h) => h.reporterId !== r.id) : [...hs, { reporterId: r.id, assignment: defaultAssignment(world, r) }]));
  const setAssignment = (id: string, assignment: StaffAssignment) => setHires((hs) => hs.map((h) => (h.reporterId === id ? { ...h, assignment } : h)));

  return (
    <DeskSurface>
      <div className={styles.board}>
        <div className={styles.boardHead}>
          <div>
            <div className={styles.kicker}>{setup.paperName} · hiring day</div>
            <h1 className={styles.title}>Pick your newsroom</h1>
          </div>
          <p className={styles.lede}>
            Résumés on the desk. Hire {STARTING_STAFF.min} to {STARTING_STAFF.max} reporters within your budget. Who you hire decides what your paper can cover:
            each reporter files stories from their assignment every issue.
          </p>
        </div>
        <div className={styles.resumes}>
          {world.staff_pool.map((r, i) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              aria-pressed={hired(r.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(r);
                }
              }}
              className={`${styles.resume} ${hired(r.id) ? styles.hired : ''}`}
              style={{ transform: `rotate(${(i % 3) - 1 === 0 ? 0.3 : (i % 3) - 1 > 0 ? 0.6 : -0.5}deg)` }}
              onClick={() => toggle(r)}
            >
              {hired(r.id) ? <span className={styles.hiredStamp}>Hired</span> : null}
              <ReporterHeader reporter={r} />
              <AttributeTable reporter={r} attrs={r.attributes} scouted oneColumn />
              <StrengthsLine attrs={r.attributes} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.memo}>
        <div className={styles.kicker}>Payroll memo</div>
        <div className={styles.payroll}>
          <span>
            ${pay} <i>/ ${cap} per issue</i>
          </span>
          <span className={styles.meter}>
            <span className={pay > cap ? styles.over : styles.fill} style={{ width: `${Math.min(100, (pay / cap) * 100)}%` }} />
          </span>
        </div>
        <div className={styles.assignments}>
          {hires.length === 0 ? <p className={styles.empty}>Click a résumé to hire.</p> : null}
          {hires.map((h) => {
            const r = world.staff_pool.find((x) => x.id === h.reporterId);
            if (!r) return null;
            return (
              <div key={h.reporterId} className={styles.assign}>
                <div className={styles.assignHead}>
                  <b>{r.name}</b>
                  <button onClick={() => toggle(r)}>Let go</button>
                </div>
                <AssignmentEditor reporter={r} value={h.assignment} onChange={(a) => setAssignment(r.id, a)} compact frequency={setup.frequency} />
              </div>
            );
          })}
        </div>
        {!check.ok ? <div className={styles.warn}>{check.reason}</div> : null}
        <button className={styles.start} disabled={!check.ok} onClick={() => startGame(setup, hires)}>
          Open the newsroom
        </button>
        <button className={styles.back} onClick={() => goto('setup')}>
          ◂ Back to Form 1-A
        </button>
      </div>
    </DeskSurface>
  );
}
