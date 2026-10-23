// Form 1-A: register your newspaper. Name, city, origin, frequency, kind of paper,
// coverage split and stated stance, with a live masthead proof and an APPROVED stamp.
import { useState } from 'react';
import { ORIGIN_IDS } from '../data/schemas.ts';
import { loadGameData } from '../data/worldData.ts';
import { COVERAGE_CATEGORIES, defaultSetup } from '../sim/newGame.ts';
import { CATEGORY_LABEL, startingPayrollCap } from '../sim/staff.ts';
import type { CoverageCategory, Frequency, PaperSetup, PaperStyle, Stance } from '../sim/types.ts';
import { useStore } from '../state/store.ts';
import { DeskSurface } from '../components/desk/DeskSurface.tsx';
import styles from './SetupScreen.module.css';

const ORIGIN_DESC: Record<string, string> = {
  founded: 'Small budget, no readers, no baggage.',
  inherited: 'Loyal but aging readers. Old habits.',
  bought: 'A known name, a big debt, a bitter newsroom.',
};

const FREQ: { id: Frequency; label: string; note: string; enabled: boolean }[] = [
  { id: 'daily', label: 'Daily', note: 'An issue every day: one day of news each time. Fast, reactive, exhausting. Ten issues in the demo.', enabled: true },
  { id: 'weekly', label: 'Weekly', note: 'One issue per week: the week’s biggest stories, a week of reporting, one shot to get it right. Ten issues in the demo.', enabled: true },
  { id: 'monthly', label: 'Monthly', note: 'Long-form and analysis. Not in the demo.', enabled: false },
];

const STYLES: { id: PaperStyle; label: string; desc: string }[] = [
  { id: 'record', label: 'Paper of record', desc: 'Serious and complete. Readers expect the big stories and punish puff.' },
  { id: 'neighborhood', label: 'Neighborhood paper', desc: 'Local first: their blocks, their schools, their teams.' },
  { id: 'tabloid', label: 'Tabloid', desc: 'Loud headlines, big reactions. Sells on the street; trust is fragile.' },
];

const STANCES: { id: Stance; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'center_left', label: 'Center-left' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'center_right', label: 'Center-right' },
  { id: 'right', label: 'Right' },
];

const PROOF: Record<CoverageCategory, string> = {
  politics: 'City Hall braces for a new watchdog',
  economy: 'New paper promises to follow the money',
  social: 'A paper for the neighborhoods, by the neighborhoods',
  sports: 'Finally, a paper that bleeds for the home team',
  culture: 'New paper puts the arts on page one',
  science: 'A paper that checks the science',
  world: 'The world, as it lands on Broad Street',
};

export function SetupScreen() {
  const submit = useStore((s) => s.submitSetup);
  const back = useStore((s) => s.goto);
  const [s, setS] = useState<PaperSetup>(() => useStore.getState().pendingSetup ?? defaultSetup());
  const { cities, world } = loadGameData();
  const city = cities.find((c) => c.id === s.cityId);
  const total = COVERAGE_CATEGORIES.reduce((a, c) => a + s.coverage[c], 0) || 1;
  const top = COVERAGE_CATEGORIES.reduce((best, c) => (s.coverage[c] > s.coverage[best] ? c : best), COVERAGE_CATEGORIES[0]!);
  const origin = world.origins[s.origin];
  const freqNote = FREQ.find((f) => f.id === s.frequency)?.note ?? '';
  const valid = s.paperName.trim().length > 0 && total > 0;

  return (
    <DeskSurface>
      <div className={styles.form}>
        <div className={styles.formHead}>
          <div>
            <div className={styles.formKicker}>Form 1-A · Bureau of Publications</div>
            <div className={styles.formTitle}>Application to register a newspaper</div>
          </div>
          <button className={styles.quick} onClick={() => submit(defaultSetup())}>
            Quick start ▸
          </button>
        </div>

        <label className={styles.nameRow}>
          <span className={styles.label}>1. Name of paper</span>
          <input value={s.paperName} maxLength={40} onChange={(e) => setS({ ...s, paperName: e.target.value })} />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>
            2. City of publication <i>· sets your local news, teams and districts</i>
          </span>
          <div className={styles.cities}>
            {cities.map((c) => (
              <button
                key={c.id}
                disabled={!c.enabled}
                className={c.id === s.cityId ? styles.on : ''}
                onClick={() => setS({ ...s, cityId: c.id })}
                title={c.enabled ? undefined : 'Coming soon'}
              >
                <b>{c.name}</b>
                <span>{c.enabled ? c.difficulty : `${c.difficulty} · soon`}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.cols}>
          <div className={styles.field}>
            <span className={styles.label}>3. How you got the paper</span>
            {ORIGIN_IDS.map((id) => (
              <button key={id} className={`${styles.option} ${s.origin === id ? styles.on : ''}`} onClick={() => setS({ ...s, origin: id })}>
                <b>{world.origins[id].name}</b>
                <span>{ORIGIN_DESC[id]}</span>
              </button>
            ))}
          </div>
          <div className={styles.field}>
            <span className={styles.label}>4. Kind of paper</span>
            {STYLES.map((st) => (
              <button key={st.id} className={`${styles.option} ${s.style === st.id ? styles.on : ''}`} onClick={() => setS({ ...s, style: st.id })}>
                <b>{st.label}</b>
                <span>{st.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.cols}>
          <div className={styles.field}>
            <span className={styles.label}>5. Coverage split</span>
            {COVERAGE_CATEGORIES.map((c) => (
              <label key={c} className={styles.slider}>
                <span>{CATEGORY_LABEL[c]}</span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={s.coverage[c]}
                  onChange={(e) => setS({ ...s, coverage: { ...s.coverage, [c]: Number(e.target.value) } })}
                />
                <span className={styles.pct}>{Math.round((s.coverage[c] / total) * 100)}%</span>
              </label>
            ))}
            <span className={styles.hint}>Where you spread: heavy coverage wins readers who care about it, and the desks you lean on.</span>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>6. Frequency</span>
            <div className={styles.segmented}>
              {FREQ.map((f) => (
                <button key={f.id} disabled={!f.enabled} className={s.frequency === f.id ? styles.on : ''} onClick={() => setS({ ...s, frequency: f.id })}>
                  {f.label}
                </button>
              ))}
            </div>
            <span className={styles.hint}>{freqNote}</span>

            <span className={styles.label} style={{ marginTop: 10 }}>7. Stated editorial stance</span>
            <div className={styles.segmented}>
              {STANCES.map((st) => (
                <button key={st.id} className={s.stance === st.id ? styles.on : ''} onClick={() => setS({ ...s, stance: st.id })}>
                  {st.label}
                </button>
              ))}
            </div>
            <span className={styles.hint}>This is only what you claim. Readers decide what you really are from what you print.</span>
          </div>
        </div>
      </div>

      <div className={styles.report}>
        <span className={styles.formKicker}>Market report · {city?.name}</span>
        <span className={styles.reportHead}>Neighborhood pride runs deep</span>
        <span className={styles.reportBody}>{city?.blurb}</span>
        <div className={styles.reportGrid}>
          <div>
            <span>Rival</span>
            <b>{world.rival.name}</b>
          </div>
          <div>
            <span>Difficulty</span>
            <b>{city?.difficulty}</b>
          </div>
          <div>
            <span>Starting cash</span>
            <b>${origin.cash.toLocaleString()}</b>
          </div>
          <div>
            <span>Payroll budget</span>
            <b>${startingPayrollCap(s.origin)}/issue</b>
          </div>
        </div>
      </div>

      <div className={styles.proof}>
        <span className={styles.proofKicker}>Proof · first edition</span>
        <span className={styles.proofName}>{s.paperName || 'Untitled'}</span>
        <div className={styles.proofMeta}>
          <span>{city?.name}</span>
          <span>{s.frequency}</span>
          <span>${world.pricing.cover_price.toFixed(2)}</span>
        </div>
        <div className={styles.proofHead}>{PROOF[top]}</div>
        <div className={styles.proofCols}>
          <div className={styles.proofPhoto} />
          <div className={styles.proofLines}>
            <i />
            <i />
            <i />
            <i style={{ width: '70%' }} />
          </div>
          <div className={styles.proofLines}>
            <i />
            <i />
            <i style={{ width: '60%' }} />
          </div>
        </div>
      </div>

      <button className={styles.stamp} disabled={!valid} onClick={() => submit({ ...s, paperName: s.paperName.trim() })}>
        <span className={styles.stampWord}>Approved</span>
        <span className={styles.stampHint}>Click to stamp &amp; hire your staff</span>
      </button>
      <button className={styles.back} onClick={() => back('title')}>
        ◂ Back
      </button>
    </DeskSurface>
  );
}
