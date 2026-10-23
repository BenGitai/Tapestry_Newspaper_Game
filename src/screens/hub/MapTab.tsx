// City map: Philadelphia's districts pinned to a corkboard. Layers show where you
// sell, who trusts you, how your politics fit, income and the rival's grip. The
// right panel shows a district, or your paper's stated goals against what it
// actually prints.
import { useState } from 'react';
import type { District } from '../../data/schemas.ts';
import { displayName, loadGameData } from '../../data/worldData.ts';
import { CIRCULATION } from '../../sim/balance.ts';
import { findStoryBlock, placementLabel } from '../../sim/layout.ts';
import { wireForIssue } from '../../sim/newsroom.ts';
import { leanLabel, paperReport } from '../../sim/paperStats.ts';
import { nextUnlock, totalNewsstands } from '../../sim/pages.ts';
import { averageTrust, districtInterests, leanFit, reach, totalReaders } from '../../sim/readers.ts';
import { CATEGORY_LABEL, initials, reporterById } from '../../sim/staff.ts';
import type { GameState } from '../../sim/types.ts';
import { useStore } from '../../state/store.ts';
import { palette } from '../../theme/tokens.ts';
import styles from './Hub.module.css';
import m from './Map.module.css';

type Layer = 'readership' | 'trust' | 'lean' | 'income' | 'rival';

const LAYERS: { id: Layer; label: string; help: string }[] = [
  { id: 'readership', label: 'Your readership', help: 'Share of the district’s print readers who buy your paper, from your weakest district (low) to your strongest (high).' },
  { id: 'trust', label: 'Trust in the paper', help: 'How much readers there believe you (0–100).' },
  { id: 'lean', label: 'Political fit', help: 'How well your perceived lean fits the district’s mix.' },
  { id: 'income', label: 'Income', help: 'Rough income tier of the district.' },
  { id: 'rival', label: 'Rival papers', help: 'Share of readers who take the Herald.' },
];

const STYLE_LABEL = { record: 'Paper of record', neighborhood: 'Neighborhood paper', tabloid: 'Tabloid' } as const;

function centroid(d: District): [number, number] {
  const n = d.polygon.length;
  return [d.polygon.reduce((a, p) => a + p[0], 0) / n, d.polygon.reduce((a, p) => a + p[1], 0) / n];
}

/** 0..1 value for a district under a layer. */
function layerValue(layer: Layer, game: GameState, d: District): number {
  const st = game.districts[d.id]!;
  switch (layer) {
    case 'readership': {
      // Relative to your best district, so a small paper still sees where it is strongest.
      const share = (x: District) => game.districts[x.id]!.readers / Math.max(1, game.printPool * x.population_share);
      const all = loadGameData().world.districts.map(share);
      const lo = Math.min(...all);
      const hi = Math.max(...all);
      return hi - lo < 1e-6 ? 0.5 : (share(d) - lo) / (hi - lo);
    }
    case 'trust':
      return st.trust / 100;
    case 'lean':
      return Math.max(0, Math.min(1, (leanFit(d, game.perceivedLean) - 0.4) / 0.5));
    case 'income':
      return (d.income_tier - 1) / 4;
    case 'rival':
      return st.rivalShare / 0.6;
  }
}

const LEVELS = 5;

export function MapTab() {
  const game = useStore((s) => s.game)!;
  const [layer, setLayer] = useState<Layer>('readership');
  const [selected, setSelected] = useState<string | null>(null);
  const { world, stories } = loadGameData();
  const wire = wireForIssue(game, stories);
  const [vx, vy, vw, vh] = world.city.map_viewbox;
  const district = world.districts.find((d) => d.id === selected);

  // Story pins: one per story on today's wire, at its first district (spread out a little).
  // Pins for the most important local stories (a weekly wire has too many to pin them all).
  const PIN_LIMIT = 14;
  const pinned = new Set(
    [...wire]
      .filter((s) => s.districts.length && s.districts.length < world.districts.length)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, PIN_LIMIT)
      .map((s) => s.id),
  );
  const pins = wire
    .filter((s) => pinned.has(s.id))
    .map((s, i) => {
      const d = world.districts.find((x) => x.id === s.districts[0])!;
      const [cx, cy] = centroid(d);
      const sameBefore = wire.filter((x) => pinned.has(x.id)).slice(0, i).filter((x) => x.districts[0] === s.districts[0]).length;
      return { story: s, n: i + 1, x: cx + 34 + (sameBefore % 3) * 30, y: cy + 26 + Math.floor(sameBefore / 3) * 30 };
    });

  return (
    <>
      {/* ---------- layers ---------- */}
      <section className={styles.col} style={{ left: 14, width: 250 }}>
        <div className={`${styles.paper} ${m.layers}`}>
          <div className={styles.colTitle}>Map layers</div>
          <div className={m.layerList}>
            {LAYERS.map((l) => (
              <button key={l.id} className={layer === l.id ? m.layerOn : ''} onClick={() => setLayer(l.id)} title={l.help}>
                {l.label}
              </button>
            ))}
          </div>
          <p className={m.layerHelp}>{LAYERS.find((l) => l.id === layer)?.help}</p>
          <div className={styles.label}>Key</div>
          <div className={m.key}>
            {[4, 2, 0].map((lvl) => (
              <div key={lvl}>
                <svg width={30} height={18}>
                  <rect width={30} height={18} fill={`url(#ht-${layer === 'rival' ? 'r' : 'i'}${lvl})`} stroke={palette.ink} strokeWidth={0.8} />
                </svg>
                <span>{lvl === 4 ? 'High' : lvl === 2 ? 'Some' : 'Low'}</span>
              </div>
            ))}
            <div>
              <svg width={30} height={18}>
                <circle cx={15} cy={9} r={7} fill={palette.tiger} stroke={palette.ink} strokeWidth={1} />
              </svg>
              <span>Story on today’s wire</span>
            </div>
          </div>
          <div className={m.worldDesk}>
            <div className={styles.kicker}>Off the map</div>
            <b>{wire.filter((s) => !s.districts.length || s.districts.length === world.districts.length).length} citywide or world stories</b>
            <p>Stories with no single district, like fares and national news, reach every neighborhood.</p>
          </div>
        </div>
      </section>

      {/* ---------- map ---------- */}
      <section className={m.board}>
        <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className={m.map} role="img" aria-label={`Map of ${world.city.name}, ${LAYERS.find((l) => l.id === layer)?.label}`}>
          <defs>
            <pattern id="water" width={24} height={10} patternUnits="userSpaceOnUse">
              <path d="M0 5 Q6 1 12 5 T24 5" fill="none" stroke={palette.inkFaint} strokeWidth={0.8} opacity={0.6} />
            </pattern>
            {Array.from({ length: LEVELS }, (_, lvl) => (
              <g key={lvl}>
                <pattern id={`ht-i${lvl}`} width={9} height={9} patternUnits="userSpaceOnUse">
                  <rect width={9} height={9} fill={palette.newsprint} />
                  {lvl > 0 ? <circle cx={4.5} cy={4.5} r={0.6 + lvl * 0.75} fill={palette.ink} /> : <circle cx={4.5} cy={4.5} r={0.5} fill={palette.inkFaint} />}
                </pattern>
                <pattern id={`ht-r${lvl}`} width={9} height={9} patternUnits="userSpaceOnUse">
                  <rect width={9} height={9} fill={palette.newsprint} />
                  {lvl > 0 ? <circle cx={4.5} cy={4.5} r={0.6 + lvl * 0.75} fill={palette.rust} /> : <circle cx={4.5} cy={4.5} r={0.5} fill={palette.inkFaint} />}
                </pattern>
              </g>
            ))}
          </defs>
          <rect x={vx} y={vy} width={vw} height={vh} fill={palette.newsprintLight} />
          <rect x={vx} y={vy} width={vw} height={vh} fill="url(#water)" />

          {world.districts.map((d) => {
            const v = layerValue(layer, game, d);
            const lvl = Math.max(0, Math.min(LEVELS - 1, Math.round(v * (LEVELS - 1))));
            return (
              <polygon
                key={d.id}
                points={d.polygon.map((p) => p.join(',')).join(' ')}
                fill={`url(#ht-${layer === 'rival' ? 'r' : 'i'}${lvl})`}
                stroke={palette.ink}
                strokeWidth={1.6}
                className={m.district}
                onClick={() => setSelected(d.id)}
              >
                <title>{d.name}</title>
              </polygon>
            );
          })}

          {Object.entries(world.city.rivers).map(([name, pts]) => (
            <g key={name} pointerEvents="none">
              <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={palette.ink} strokeWidth={9} strokeLinejoin="round" />
              <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={palette.newsprintLight} strokeWidth={6} strokeLinejoin="round" />
            </g>
          ))}

          {district ? (
            <polygon points={district.polygon.map((p) => p.join(',')).join(' ')} fill="none" stroke={palette.tiger} strokeWidth={5} pointerEvents="none" />
          ) : null}

          {world.districts.map((d) => {
            const [cx, cy] = centroid(d);
            const name = d.name.replace(' & University City', '').toUpperCase();
            const st = game.districts[d.id]!;
            return (
              <g key={d.id} pointerEvents="none">
                <rect x={cx - name.length * 5.4} y={cy - 13} width={name.length * 10.8} height={22} fill={palette.newsprint} />
                <text x={cx} y={cy + 4} textAnchor="middle" fontFamily="Old Standard TT, serif" fontWeight={700} fontSize={16} fill={palette.ink}>
                  {name}
                </text>
                {st.bureau ? (
                  <text x={cx} y={cy + 22} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={10} fill={palette.rust}>
                    BUREAU
                  </text>
                ) : null}
                {Array.from({ length: st.newsstands }, (_, i) => (
                  <rect key={i} x={cx - 18 + i * 10} y={cy + (st.bureau ? 28 : 14)} width={7} height={7} fill={palette.ink} />
                ))}
              </g>
            );
          })}

          {pins.map((p) => (
            <g key={p.story.id} className={m.pin} onClick={() => setSelected(p.story.districts[0]!)}>
              <circle cx={p.x} cy={p.y} r={13} fill={palette.tiger} stroke={palette.ink} strokeWidth={1.5} />
              <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={12} fill={palette.ink}>
                {p.n}
              </text>
              <title>{p.story.wire_headline}</title>
            </g>
          ))}

          <g transform={`translate(${vx + vw - 70}, ${vy + 40})`} pointerEvents="none">
            <line x1={0} y1={44} x2={0} y2={4} stroke={palette.ink} strokeWidth={1.5} />
            <path d="M-7 18 L0 0 L7 18 Z" fill={palette.ink} />
            <text x={0} y={-6} textAnchor="middle" fontFamily="Old Standard TT, serif" fontSize={16} fill={palette.ink}>
              N
            </text>
          </g>
          <g transform={`translate(${vx + 30}, ${vy + vh - 96})`} pointerEvents="none">
            <rect width={300} height={70} fill={palette.newsprint} stroke={palette.ink} strokeWidth={2} />
            <rect x={5} y={5} width={290} height={60} fill="none" stroke={palette.ink} strokeWidth={0.8} />
            <text x={150} y={34} textAnchor="middle" fontFamily="Old Standard TT, serif" fontWeight={700} fontSize={22} fill={palette.ink}>
              City of {world.city.name}
            </text>
            <text x={150} y={53} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={10} letterSpacing={1.5} fill={palette.inkMuted}>
              READERSHIP SURVEY · ISSUE {game.issueNumber}
            </text>
          </g>
        </svg>
      </section>

      {/* ---------- district / paper ---------- */}
      <section className={styles.col} style={{ left: 958, right: 14 }}>
        <div className={`${styles.paper} ${m.side}`}>
          <div className={styles.subTabs}>
            <button className={!district ? styles.subOn : ''} onClick={() => setSelected(null)}>
              Your paper
            </button>
            <button className={district ? styles.subOn : ''} disabled={!district} onClick={() => undefined}>
              {district ? district.name : 'District (click the map)'}
            </button>
          </div>
          <div className={styles.scroll}>{district ? <DistrictPanel game={game} district={district} pins={pins} /> : <PaperPanel game={game} />}</div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={m.stat}>
      <span>{label}</span>
      <b>{value}</b>
      {sub ? <em>{sub}</em> : null}
    </div>
  );
}

function DistrictPanel({ game, district, pins }: { game: GameState; district: District; pins: { story: { id: string; districts: string[]; wire_headline: string }; n: number }[] }) {
  const addNewsstand = useStore((s) => s.addNewsstand);
  const openBureau = useStore((s) => s.openBureau);
  const { world, stories } = loadGameData();
  const st = game.districts[district.id]!;
  const pool = Math.round(game.printPool * district.population_share);
  const share = st.readers / Math.max(1, pool);
  const fit = leanFit(district, game.perceivedLean);
  const interests = districtInterests(world, district).slice(0, 5);
  const maxW = interests[0]?.weight ?? 1;
  const history = game.results.map((r) => r.districts[district.id]?.readers ?? 0);
  const here = wireForIssue(game, stories).filter((s) => s.districts.includes(district.id));

  return (
    <>
      <div className={styles.kicker}>District</div>
      <h2 className={m.dName}>{district.name}</h2>
      <p className={m.dNeighborhoods}>{district.example_neighborhoods.join(' · ')}</p>
      <div className={m.stats}>
        <Stat label="Print readers" value={pool.toLocaleString()} sub={`${Math.round(district.population_share * 100)}% of the city`} />
        <Stat label="Your readers" value={st.readers.toLocaleString()} sub={`${(share * 100).toFixed(1)}% share · reach ${Math.round(reach(world, district, st, game.setup.coverage) * 100)}%`} />
        <Stat label="Trust" value={`${Math.round(st.trust)} / 100`} />
        <Stat label="Rival share" value={`${Math.round(st.rivalShare * 100)}%`} sub={world.rival.strong_districts.includes(district.id) ? 'Herald stronghold' : undefined} />
        <Stat label="Political fit" value={fit >= 0.7 ? 'Good' : fit >= 0.55 ? 'Fair' : 'Poor'} sub={`left ${Math.round(district.lean_mix.left * 100)}% · center ${Math.round(district.lean_mix.center * 100)}% · right ${Math.round(district.lean_mix.right * 100)}%`} />
        <Stat label="Income" value={['Low', 'Lower-middle', 'Middle', 'Upper-middle', 'High'][district.income_tier - 1] ?? '?'} />
      </div>
      {history.length > 1 ? <Spark values={history} label="Your readers here, by issue" /> : null}

      <div className={styles.label}>What they want to read</div>
      {interests.map((i) => (
        <div key={i.category} className={m.barRow}>
          <span>{CATEGORY_LABEL[i.category]}</span>
          <span className={styles.meter}>
            <span className={styles.meterFill} style={{ width: `${(i.weight / maxW) * 100}%` }} />
          </span>
        </div>
      ))}

      <div className={styles.label}>Today in {district.name}</div>
      {here.length === 0 ? <p className={styles.note}>Nothing on the wire from here this issue.</p> : null}
      {here.map((s) => {
        const pin = pins.find((p) => p.story.id === s.id);
        const a = game.articles.find((x) => x.storyId === s.id && x.status !== 'spiked');
        const placed = findStoryBlock(game.draft, s.id);
        const r = a?.reporterId ? reporterById(world, a.reporterId) : undefined;
        return (
          <div key={s.id} className={m.today}>
            {pin ? <span className={m.pinDot}>{pin.n}</span> : <span />}
            <div>
              <b>{s.wire_headline}</b>
              <em>
                {placed ? `On your page · ${placementLabel(placed.page, placed.block)}` : a ? `Filed by ${r ? initials(r.name) : 'wire copy'} · not on the page` : 'Nobody is covering it'}
              </em>
            </div>
          </div>
        );
      })}

      <div className={styles.label}>Grow here</div>
      <div className={m.actions}>
        <button className={styles.btn} disabled={st.bureau} onClick={() => openBureau(district.id)}>
          {st.bureau ? 'Bureau open' : `Open a bureau · $${world.pricing.bureau_cost}`}
        </button>
        <button className={styles.btn} disabled={st.newsstands >= CIRCULATION.maxNewsstands} onClick={() => addNewsstand(district.id)}>
          Add newsstand · ${world.pricing.newsstand_cost} ({st.newsstands}/{CIRCULATION.maxNewsstands})
        </button>
      </div>
      <p className={m.hint}>Newsstands widen your reach here. A bureau widens it more and makes local stories land harder.</p>
    </>
  );
}

function PaperPanel({ game }: { game: GameState }) {
  const { world } = loadGameData();
  const rep = paperReport(game);
  const maxShare = Math.max(0.01, ...rep.coverage.flatMap((c) => [c.stated, c.actual]));
  const copies = game.results.map((r) => r.copies);
  const verdicts: string[] = [];
  if (rep.published === 0) verdicts.push('Nothing printed yet. Print an issue to see how you measure up.');
  else {
    if (game.setup.style === 'record' && rep.angles.puff > 0.3) verdicts.push('More puff than a paper of record should run.');
    if (game.setup.style === 'record' && rep.sensational > 0.1) verdicts.push('Sensational pieces undercut a paper of record.');
    if (game.setup.style === 'tabloid' && rep.sensational < 0.1 && rep.angles.hard < 0.3) verdicts.push('Tame for a tabloid. Street sales want bigger swings.');
    if (game.setup.style === 'neighborhood' && rep.local < 0.2) verdicts.push('Little patch reporting for a neighborhood paper. Put reporters on district patches.');
    const off = rep.coverage.filter((c) => c.stated - c.actual > 0.12).map((c) => CATEGORY_LABEL[c.category]);
    if (off.length) verdicts.push(`You promised more ${off.join(' and ')} than you print.`);
    const drift = rep.perceivedLean - rep.statedLean;
    if (Math.abs(drift) > 0.15) verdicts.push(`Readers see you as ${leanLabel(rep.perceivedLean).toLowerCase()}, not the ${leanLabel(rep.statedLean).toLowerCase()} paper you registered as.`);
    if (!verdicts.length) verdicts.push('So far, you are the paper you said you would be.');
  }

  return (
    <>
      <div className={styles.kicker}>{game.setup.paperName}</div>
      <h2 className={m.dName}>Stated vs actual</h2>
      <p className={m.dNeighborhoods}>What you registered on Form 1-A, against what you have printed ({rep.published} articles).</p>

      <div className={m.stats}>
        <Stat label="Readers" value={totalReaders(game.districts).toLocaleString()} sub={game.results.length ? `${game.results[game.results.length - 1]!.copiesChange >= 0 ? '+' : ''}${game.results[game.results.length - 1]!.copiesChange} last issue` : undefined} />
        <Stat label="Trust" value={`${Math.round(averageTrust(game.districts))} / 100`} />
        <Stat label="Cash" value={`$${game.cash.toLocaleString()}`} sub={game.debt ? `debt $${game.debt.toLocaleString()}` : undefined} />
        <Stat label="Awards · corrections" value={`${game.awards} · ${game.corrections}`} />
        <Stat
          label="Pages"
          value={`${2 + game.unlockedPages.length} unlocked`}
          sub={(() => {
            const n = nextUnlock(game);
            return n ? `${n.page.toUpperCase()} at ${n.readers.toLocaleString()} readers + ${n.newsstands} stands` : 'all pages open';
          })()}
        />
        <Stat label="Newsstands" value={`${totalNewsstands(game)}`} sub="across the city" />
      </div>
      {copies.length > 1 ? <Spark values={copies} label="Copies sold, by issue" /> : null}

      <div className={styles.label}>Coverage · stated / printed</div>
      {rep.coverage.map((c) => (
        <div key={c.category} className={m.cmpRow}>
          <span>{CATEGORY_LABEL[c.category]}</span>
          <div className={m.cmpBars}>
            <span className={m.stated} style={{ width: `${(c.stated / maxShare) * 100}%` }} />
            <span className={m.actual} style={{ width: `${(c.actual / maxShare) * 100}%` }} />
          </div>
          <span className={m.cmpNums}>
            {Math.round(c.stated * 100)}% / {Math.round(c.actual * 100)}%
          </span>
        </div>
      ))}
      <div className={m.legend}>
        <span>
          <i className={m.stated} /> stated
        </span>
        <span>
          <i className={m.actual} /> printed
        </span>
      </div>

      <div className={styles.label}>Politics · stated / perceived</div>
      <LeanScale stated={rep.statedLean} perceived={rep.perceivedLean} />

      <div className={styles.label}>Kind of paper · {STYLE_LABEL[game.setup.style]}</div>
      <div className={m.stats}>
        <Stat label="Puff" value={`${Math.round(rep.angles.puff * 100)}%`} />
        <Stat label="Straight" value={`${Math.round(rep.angles.straight * 100)}%`} />
        <Stat label="Hard-hitting" value={`${Math.round(rep.angles.hard * 100)}%`} />
        <Stat label="Sensational" value={`${Math.round(rep.sensational * 100)}%`} />
        <Stat label="From a patch" value={`${Math.round(rep.local * 100)}%`} />
        <Stat label="Rival" value={displayName(world.rival.name).replace('The ', '')} />
      </div>

      <div className={styles.label}>The verdict</div>
      <ul className={m.verdicts}>
        {verdicts.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    </>
  );
}

function LeanScale({ stated, perceived }: { stated: number; perceived: number }) {
  const x = (v: number) => 10 + ((v + 1) / 2) * 380;
  return (
    <svg viewBox="0 0 400 72" className={m.leanScale} role="img" aria-label={`Stated ${leanLabel(stated)}, perceived ${leanLabel(perceived)}`}>
      <line x1={10} y1={30} x2={390} y2={30} stroke={palette.ink} strokeWidth={1.5} />
      {[-1, -0.5, 0, 0.5, 1].map((v) => (
        <line key={v} x1={x(v)} y1={25} x2={x(v)} y2={35} stroke={palette.ink} strokeWidth={1} />
      ))}
      <text x={10} y={68} fontFamily="IBM Plex Mono, monospace" fontSize={10} fill={palette.inkMuted}>
        LEFT
      </text>
      <text x={200} y={68} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={10} fill={palette.inkMuted}>
        CENTER
      </text>
      <text x={390} y={68} textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize={10} fill={palette.inkMuted}>
        RIGHT
      </text>
      <g transform={`translate(${x(stated)}, 30)`}>
        <rect x={-6} y={-6} width={12} height={12} fill="none" stroke={palette.ink} strokeWidth={2} />
        <text y={-12} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={9} fill={palette.ink}>
          STATED
        </text>
      </g>
      <g transform={`translate(${x(perceived)}, 30)`}>
        <circle r={6} fill={palette.tiger} stroke={palette.ink} strokeWidth={1.5} />
        <text y={20} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={9} fill={palette.rust}>
          SEEN AS
        </text>
      </g>
    </svg>
  );
}

function Spark({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const w = 400;
  const h = 46;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * (w - 10) + 5},${h - 6 - ((v - min) / Math.max(1, max - min)) * (h - 14)}`).join(' ');
  return (
    <div className={m.spark}>
      <span>{label}</span>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke={palette.ink} strokeWidth={2} />
        {values.map((v, i) => (
          <circle key={i} cx={(i / Math.max(1, values.length - 1)) * (w - 10) + 5} cy={h - 6 - ((v - min) / Math.max(1, max - min)) * (h - 14)} r={3} fill={palette.ink} />
        ))}
      </svg>
    </div>
  );
}
