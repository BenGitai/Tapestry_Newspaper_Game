// Summarizer tech demo: pick a story, read its wire facts, and compare the three
// angles side by side for a chosen reporter voice and length tier. Shows the exact
// prompt, token counts, cost per article and the fact check with flagged text
// highlighted. Articles come from the live dev endpoint (when a key is set), then
// the pre-generated cache, then templates, so it runs with no key at all.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { DeskSurface } from '../components/desk/DeskSurface.tsx';
import { bundledCache } from '../data/ArticleSource.ts';
import { ANGLES, type Angle, type Story } from '../data/schemas.ts';
import { loadGameData } from '../data/worldData.ts';
import { TIERS } from '../sim/balance.ts';
import type { Tier } from '../sim/types.ts';
import { useStore } from '../state/store.ts';
import { cacheKey, entryToText } from '../summarizer/cache.ts';
import { DESK_VOICE_ID, summarizerModel } from '../summarizer/config.ts';
import { callCost, estimateInputTokens, estimateOutputTokens, extrapolate, type Usage } from '../summarizer/cost.ts';
import { factCheck, gameNames, type FactCheckResult, type Field, type Flag } from '../summarizer/factcheck.ts';
import { liveGenerate, liveStatus, type LiveResponse, type LiveStatus } from '../summarizer/live.ts';
import { demoStories } from '../summarizer/plan.ts';
import { buildPrompt } from '../summarizer/prompt.ts';
import { templateArticle } from '../summarizer/templates.ts';
import type { ArticleText } from '../summarizer/types.ts';
import styles from './TechDemo.module.css';

const ANGLE_NAME: Record<Angle, string> = { puff: 'Puff', straight: 'Straight', hard: 'Hard-hitting' };
const TIER_LIST: Tier[] = ['lead', 'secondary', 'brief'];

interface View {
  angle: Angle;
  text: ArticleText;
  origin: 'live' | 'cache' | 'template';
  usage: Usage;
  /** Token counts measured by the API (live or cached) or estimated from the prompt. */
  measured: boolean;
  model: string | null;
  cost: number;
  check: FactCheckResult;
}

/** Text with the flagged ranges for one field marked. */
function Marked({ text, flags, field }: { text: string; flags: Flag[]; field: Field }) {
  const mine = flags.filter((f) => f.field === field).sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let at = 0;
  mine.forEach((f, i) => {
    if (f.start < at) return;
    parts.push(<Fragment key={`t${i}`}>{text.slice(at, f.start)}</Fragment>);
    parts.push(
      <mark key={`m${i}`} className={styles.flag} title={f.kind === 'number' ? 'Number not in the facts' : 'Name not in the facts'}>
        {text.slice(f.start, f.end)}
      </mark>,
    );
    at = f.end;
  });
  parts.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{parts}</>;
}

const money = (v: number) => (v === 0 ? '$0' : `$${v.toFixed(v < 0.01 ? 5 : 4)}`);

export function TechDemo() {
  const goto = useStore((s) => s.goto);
  const hasGame = useStore((s) => s.game !== null);
  const { world, stories } = loadGameData();
  const names = useMemo(() => gameNames(world), [world]);
  const list = useMemo(() => demoStories(stories).sort((a, b) => a.day - b.day || a.filed_at.localeCompare(b.filed_at) || a.id.localeCompare(b.id)), [stories]);
  const reporters = useMemo(() => world.staff_pool.filter((r) => !r.id.startsWith('cand-')), [world]);

  const [storyId, setStoryId] = useState(list[0]?.id ?? '');
  const [voice, setVoice] = useState(DESK_VOICE_ID);
  const [tier, setTier] = useState<Tier>('lead');
  const [promptAngle, setPromptAngle] = useState<Angle>('straight');
  const [showPrompt, setShowPrompt] = useState(true);
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [live, setLive] = useState<Record<string, LiveResponse>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void liveStatus().then(setStatus);
  }, []);

  const story = stories.storyById(storyId) as Story;
  const reporter = reporters.find((r) => r.id === voice);
  const journalistId = reporter ? reporter.id : null;
  const model = status?.model ?? summarizerModel();
  const sensitive = story.sensitivity === 'high';

  const prompts = useMemo(
    () => Object.fromEntries(ANGLES.map((a) => [a, buildPrompt({ story, angle: a, tier, ...(reporter ? { journalist: { name: reporter.name, voice: reporter.voice } } : {}) })])) as Record<Angle, ReturnType<typeof buildPrompt>>,
    [story, tier, reporter],
  );

  const views = useMemo(() => {
    const cache = bundledCache().entries;
    const out: Partial<Record<Angle, View>> = {};
    for (const angle of ANGLES) {
      if (sensitive && angle === 'puff') continue;
      const key = cacheKey(story.id, journalistId, angle, tier);
      const hit = live[key];
      const entry = cache[key] ?? cache[cacheKey(story.id, null, angle, tier)];
      let text: ArticleText;
      let origin: View['origin'];
      let usage: Usage;
      let measured: boolean;
      let viewModel: string | null;
      if (hit?.article) {
        text = hit.article;
        origin = 'live';
        usage = hit.usage;
        measured = true;
        viewModel = hit.model;
      } else if (entry) {
        text = entryToText(entry);
        origin = 'cache';
        usage = { inputTokens: entry.input_tokens, outputTokens: entry.output_tokens };
        measured = true;
        viewModel = entry.model;
      } else {
        text = templateArticle(story, tier);
        origin = 'template';
        usage = { inputTokens: estimateInputTokens(prompts[angle]), outputTokens: estimateOutputTokens(tier) };
        measured = false;
        viewModel = null;
      }
      const cost = hit?.article ? hit.cost : callCost(viewModel ?? model, usage);
      out[angle] = { angle, text, origin, usage, measured, model: viewModel, cost, check: factCheck(text, story, tier, names) };
    }
    return out;
  }, [story, journalistId, tier, live, sensitive, prompts, model, names]);

  const shown = ANGLES.map((a) => views[a]).filter((v): v is View => v !== undefined);
  const total = shown.reduce((a, v) => a + v.cost, 0);
  const avg = shown.length ? total / shown.length : 0;
  const year = extrapolate(avg, 200, 30, 1);

  async function writeLive() {
    setBusy(true);
    setError(null);
    try {
      const angles = ANGLES.filter((a) => !(sensitive && a === 'puff'));
      const results = await Promise.all(angles.map((angle) => liveGenerate({ storyId: story.id, journalistId, angle, tier })));
      setLive((prev) => {
        const next = { ...prev };
        results.forEach((r, i) => {
          if (r.article) next[cacheKey(story.id, journalistId, angles[i]!, tier)] = r;
        });
        return next;
      });
      const failed = results.find((r) => !r.article);
      if (failed) setError(failed.failure === 'refusal' ? 'The model declined one article; showing the template for it.' : `One article could not be written (${failed.failure}); showing the cached or template text.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const days = [...new Set(list.map((s) => s.day))];
  const p = prompts[promptAngle];

  return (
    <DeskSurface>
      <div className={styles.sheet}>
        <div className={styles.head}>
          <h1 className={styles.title}>The Summarizer</h1>
          <div className={styles.sub}>
            Tech demo · wire facts in, newspaper copy out
            <br />
            The model may use only the facts below. Every number and name is checked against them.
          </div>
          <button className={styles.btn} onClick={() => goto(hasGame ? 'hub' : 'title')}>
            ◂ Back
          </button>
        </div>

        <div className={styles.controls}>
          <label className={styles.field}>
            Story
            <select value={storyId} onChange={(e) => setStoryId(e.target.value)}>
              {days.map((d) => (
                <optgroup key={d} label={`Day ${d}`}>
                  {list
                    .filter((s) => s.day === d)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.wire_headline.length > 62 ? s.wire_headline.slice(0, 61) + '…' : s.wire_headline}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Journalist voice
            <select value={voice} onChange={(e) => setVoice(e.target.value)}>
              <option value={DESK_VOICE_ID}>Neutral desk voice</option>
              {reporters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.desk.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.field}>
            Length
            <div className={styles.seg}>
              {TIER_LIST.map((t) => (
                <button key={t} className={`${styles.btn} ${tier === t ? styles.btnOn : ''}`} onClick={() => setTier(t)}>
                  {t} · {TIERS[t].words}w
                </button>
              ))}
            </div>
          </div>
          <button className={styles.btn} disabled={!status?.live || busy} onClick={() => void writeLive()}>
            {busy ? 'Writing…' : '▸ Write with the model'}
          </button>
          <div className={styles.status}>
            {status?.live ? (
              <>Live: {status.model}. Key stays on this machine.</>
            ) : (
              <>No live model here. Showing {Object.keys(bundledCache().entries).length ? 'pre-generated articles' : 'template copy'}; run with a key in .env to write live.</>
            )}
            {error ? <div className={styles.fail}>{error}</div> : null}
          </div>
        </div>

        <div className={styles.main}>
          <div className={styles.wire}>
            <div className={styles.label}>Off the wire</div>
            <div className={styles.wireHead}>{story.wire_headline}</div>
            <div className={styles.meta}>
              {world.city.name} · {story.category} · day {story.day}, {story.filed_at}
              {sensitive ? <span className={styles.sens}>Sensitive</span> : null}
            </div>
            <div className={styles.label}>Facts the model may use</div>
            <ul className={styles.facts}>
              {story.facts.map((f, i) => (
                <li key={i}>
                  <span>[{i}]</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className={styles.label}>Wire text</div>
            <p className={styles.wireText}>{story.wire_text}</p>
          </div>

          {ANGLES.map((angle) => {
            const v = views[angle];
            return (
              <div key={angle} className={`${styles.col} ${styles[tier]}`}>
                <div className={styles.colTop}>
                  <span className={styles.angle}>{ANGLE_NAME[angle]}</span>
                  {v ? <span className={`${styles.tag} ${v.origin === 'live' ? styles.tagLive : v.origin === 'template' ? styles.tagTemplate : ''}`}>{v.origin === 'live' ? 'Live' : v.origin === 'cache' ? 'Pre-generated' : 'Template'}</span> : null}
                </div>
                {!v ? (
                  <div className={styles.blocked}>
                    Not written. This is a sensitive story, so it never runs Puff. A plain, respectful tone is used whatever the angle.
                  </div>
                ) : (
                  <>
                    <h2 className={styles.headline}>
                      <Marked text={v.text.headline} flags={v.check.flags} field="headline" />
                    </h2>
                    {v.text.deck ? (
                      <p className={styles.deck}>
                        <Marked text={v.text.deck} flags={v.check.flags} field="deck" />
                      </p>
                    ) : null}
                    <p className={styles.body}>
                      <Marked text={v.text.body} flags={v.check.flags} field="body" />
                    </p>
                    <div className={styles.stats}>
                      <div className={styles.row}>
                        <span>Facts used</span>
                        <b>{v.text.facts_used.length ? v.text.facts_used.map((i) => `[${i}]`).join(' ') : 'none'}</b>
                      </div>
                      <div className={styles.row}>
                        <span>Tokens in / out{v.measured ? '' : ' (est.)'}</span>
                        <b>
                          {v.usage.inputTokens} / {v.usage.outputTokens}
                        </b>
                      </div>
                      <div className={styles.row}>
                        <span>Cost{v.origin === 'template' ? ' if written' : ''}</span>
                        <b>{money(v.cost)}</b>
                      </div>
                      <div className={styles.row}>
                        <span>Fact check</span>
                        <span className={v.check.passed ? styles.pass : styles.fail}>{v.check.passed ? 'PASS' : `FLAGGED ${v.check.flags.length + v.check.problems.length}`}</span>
                      </div>
                      {!v.check.passed ? (
                        <ul className={styles.issues}>
                          {v.check.flags.map((f, i) => (
                            <li key={i}>
                              {f.kind} “{f.text}” in {f.field}
                            </li>
                          ))}
                          {v.check.problems.map((m, i) => (
                            <li key={`p${i}`}>{m}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.prompt}>
          <div className={styles.promptBar}>
            <b>Prompt sent</b>
            {ANGLES.map((a) => (
              <button key={a} className={`${styles.btn} ${promptAngle === a ? styles.btnOn : ''}`} onClick={() => setPromptAngle(a)}>
                {ANGLE_NAME[a]}
              </button>
            ))}
            <button className={styles.btn} onClick={() => setShowPrompt((s) => !s)}>
              {showPrompt ? 'Hide' : 'Show'}
            </button>
            <span>
              {model} · three articles {money(total)} · at 200 stories a day for 30 days, one article each: ${year.cost.toFixed(2)}
            </span>
          </div>
          {showPrompt ? (
            <div className={styles.promptBody}>
              <pre className={styles.pre}>{`SYSTEM\n${p.system}`}</pre>
              <pre className={styles.pre}>{`USER\n${p.user}${p.angle !== promptAngle ? '\n\n(Angle changed to ' + p.angle + ': sensitive stories never run Puff.)' : ''}`}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </DeskSurface>
  );
}
