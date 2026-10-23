// Shared pieces for anything that shows reporters: attribute tables and the assignment editor.
import { ATTRIBUTE_KEYS, CATEGORIES, type Attributes, type Reporter } from '../../data/schemas.ts';
import { loadGameData, subtopicName } from '../../data/worldData.ts';
import { STYLE, WORKLOAD } from '../../sim/balance.ts';
import {
  ATTRIBUTE_HELP,
  ATTRIBUTE_LABEL,
  CATEGORY_LABEL,
  DESK_LABEL,
  filingCapacity,
  homeBeat,
  scoutedRange,
  strengthsAndWeaknesses,
} from '../../sim/staff.ts';
import type { Frequency, StaffAssignment, StaffMember, Workload, WritingStyle } from '../../sim/types.ts';
import styles from './StaffParts.module.css';

const STYLE_LABEL: Record<WritingStyle, string> = { news: 'News', feature: 'Feature', investigative: 'Investigative' };
const STYLE_HELP: Record<WritingStyle, string> = {
  news: 'Straight reporting. Normal length and pace.',
  feature: 'Human-interest pieces. Puff angle, a little shorter.',
  investigative: 'Digs in. Hard-hitting, longer, slower to write. Wins awards, makes enemies.',
};
const WORKLOAD_LABEL: Record<Workload, string> = { light: 'Light', normal: 'Normal', crunch: 'Crunch' };
const WORKLOAD_HELP: Record<Workload, string> = {
  light: 'Less copy, fewer mistakes, morale recovers.',
  normal: 'Steady.',
  crunch: 'More copy, more corrections, morale drops every issue.',
};
const ANGLE_LABEL = { puff: 'Puff', straight: 'Straight', hard: 'Hard-hitting' } as const;

export { STYLE_LABEL, WORKLOAD_LABEL };

export function patchLabel(patch: string): string {
  if (patch === 'citywide') return 'Citywide';
  return loadGameData().world.districts.find((d) => d.id === patch)?.name ?? patch;
}

export function assignmentSummary(a: StaffAssignment): string {
  const focus = a.focus !== 'none' ? ` (${subtopicName(a.focus)})` : '';
  return `${CATEGORY_LABEL[a.beat]}${focus} · ${patchLabel(a.patch)} · ${STYLE_LABEL[a.style]} · ${WORKLOAD_LABEL[a.workload]}`;
}

/** 1-20 attributes as numbers with bars. Unscouted candidates show a range instead. */
export function AttributeTable({
  reporter,
  attrs,
  scouted,
  training,
  oneColumn,
}: {
  reporter: Reporter;
  attrs: Attributes;
  scouted: boolean;
  training?: keyof Attributes | 'none';
  /** For narrow cards. */
  oneColumn?: boolean;
}) {
  return (
    <div className={`${styles.attrs} ${oneColumn ? styles.oneColumn : ''}`}>
      {ATTRIBUTE_KEYS.map((k) => {
        const v = Math.floor(attrs[k]);
        const [lo, hi] = scouted ? [v, v] : scoutedRange(reporter, k);
        const tone = k === 'charge' ? '' : (scouted ? v : (lo + hi) / 2) >= 14 ? styles.high : (scouted ? v : (lo + hi) / 2) <= 8 ? styles.low : '';
        return (
          <div key={k} className={styles.attr} title={ATTRIBUTE_HELP[k]}>
            <span className={styles.attrName}>
              {ATTRIBUTE_LABEL[k]}
              {training === k ? <em> · training</em> : null}
            </span>
            <span className={styles.bar}>
              {scouted ? (
                <span className={`${styles.fill} ${tone}`} style={{ width: `${(v / 20) * 100}%` }} />
              ) : (
                <span className={styles.range} style={{ left: `${((lo - 1) / 20) * 100}%`, width: `${((hi - lo + 1) / 20) * 100}%` }} />
              )}
            </span>
            <b className={tone}>{scouted ? v : `${lo}–${hi}`}</b>
          </div>
        );
      })}
    </div>
  );
}

export function StrengthsLine({ attrs }: { attrs: Attributes }) {
  const { strengths, weaknesses } = strengthsAndWeaknesses(attrs);
  return (
    <div className={styles.sw}>
      <span>
        <b className={styles.high}>Strong:</b> {strengths.length ? strengths.map((k) => ATTRIBUTE_LABEL[k]).join(', ') : 'nothing stands out'}
      </span>
      <span>
        <b className={styles.low}>Weak:</b> {weaknesses.length ? weaknesses.map((k) => ATTRIBUTE_LABEL[k]).join(', ') : 'no clear weakness'}
      </span>
    </div>
  );
}

export function ReporterHeader({ reporter, sub }: { reporter: Reporter; sub?: string }) {
  return (
    <div className={styles.head}>
      <div className={styles.name}>{reporter.name}</div>
      <div className={styles.meta}>
        {DESK_LABEL[reporter.desk]} desk · ${reporter.salary_per_issue}/issue{sub ? ` · ${sub}` : ''}
      </div>
      <div className={styles.interest}>Loves writing about: {subtopicName(reporter.interest)}</div>
      <div className={styles.voice}>“{reporter.voice}”</div>
    </div>
  );
}

interface EditorProps {
  reporter: Reporter;
  value: StaffAssignment;
  member?: StaffMember;
  onChange: (a: StaffAssignment) => void;
  compact?: boolean;
  frequency?: Frequency;
}

/** Beat, patch, writing style, workload and training for one reporter. */
export function AssignmentEditor({ reporter, value, member, onChange, compact, frequency = 'daily' }: EditorProps) {
  const { world, subtopics } = loadGameData();
  const home = homeBeat(world, reporter);
  const cap = filingCapacity(reporter, member ? { ...member, assignment: value } : { reporterId: reporter.id, hiredIssue: 0, morale: 50, growth: {}, assignment: value }, frequency);
  const setBeat = (beat: StaffAssignment['beat']) => {
    // Keep the focus only if it belongs to the new beat; prefer their own interest if it does.
    const subs = subtopics[beat].map((s) => s.id);
    const focus = subs.includes(value.focus) ? value.focus : subs.includes(reporter.interest) ? reporter.interest : 'none';
    onChange({ ...value, beat, focus });
  };
  return (
    <div className={`${styles.editor} ${compact ? styles.compact : ''}`}>
      <label className={styles.row}>
        <span>Beat</span>
        <select value={value.beat} onChange={(e) => setBeat(e.target.value as StaffAssignment['beat'])}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
              {c === home ? ' (home desk)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.row}>
        <span>Focus</span>
        <select value={value.focus} onChange={(e) => onChange({ ...value, focus: e.target.value })}>
          <option value="none">No particular focus</option>
          {subtopics[value.beat].map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.id === reporter.interest ? ' ★ their favorite' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.row}>
        <span>Patch</span>
        <select value={value.patch} onChange={(e) => onChange({ ...value, patch: e.target.value })}>
          <option value="citywide">Citywide (more stories)</option>
          {world.districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} (local knowledge)
            </option>
          ))}
        </select>
      </label>
      <div className={styles.row}>
        <span>Style</span>
        <div className={styles.seg}>
          {(Object.keys(STYLE) as WritingStyle[]).map((s) => (
            <button key={s} type="button" className={value.style === s ? styles.segOn : ''} title={STYLE_HELP[s]} onClick={() => onChange({ ...value, style: s })}>
              {STYLE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.row}>
        <span>Workload</span>
        <div className={styles.seg}>
          {(Object.keys(WORKLOAD) as Workload[]).map((w) => (
            <button key={w} type="button" className={value.workload === w ? styles.segOn : ''} title={WORKLOAD_HELP[w]} onClick={() => onChange({ ...value, workload: w })}>
              {WORKLOAD_LABEL[w]}
            </button>
          ))}
        </div>
      </div>
      <label className={styles.row}>
        <span>Training</span>
        <select value={value.training} onChange={(e) => onChange({ ...value, training: e.target.value as StaffAssignment['training'] })}>
          <option value="none">No focus</option>
          {ATTRIBUTE_KEYS.map((k) => (
            <option key={k} value={k}>
              {ATTRIBUTE_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.preview}>
        Files about <b>{cap} in</b> per issue · writes <b>{ANGLE_LABEL[STYLE[value.style].angle]}</b> by default
        {value.beat !== home ? <span className={styles.warn}> · off their home desk</span> : null}
        {value.focus !== 'none' && value.focus === reporter.interest ? <span className={styles.good}> · happy with this focus</span> : null}
        {value.focus !== 'none' && value.focus !== reporter.interest ? <span className={styles.warn}> · not their favorite (small morale cost)</span> : null}
        {!compact ? <div className={styles.help}>{STYLE_HELP[value.style]} {WORKLOAD_HELP[value.workload]}</div> : null}
      </div>
    </div>
  );
}
