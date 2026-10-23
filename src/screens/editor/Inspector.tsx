// Right side: notes on the selected item, or a summary of the issue when nothing is selected.
import { articleSource } from '../../data/ArticleSource.ts';
import { ANGLES, ATTRIBUTE_KEYS, type Angle, type Reporter } from '../../data/schemas.ts';
import { displayName, loadGameData } from '../../data/worldData.ts';
import { EXTRA_PAGE_COST_PER_COPY, PROMINENCE } from '../../sim/balance.ts';
import {
  activePages,
  adPay,
  adRevenue,
  FIT_LABEL,
  filingCapacity,
  findBlock,
  fitOf,
  pageLabel,
  pageUsage,
  placementLabel,
  prominenceOf,
  removeBlock,
  reporterLoad,
  setTier,
  textInches,
  togglePhoto,
} from '../../sim/layout.ts';
import { isOnDesk, reporterById } from '../../sim/staff.ts';
import type { PageId, StoryBlock, Tier } from '../../sim/types.ts';
import { useStore, wireStories } from '../../state/store.ts';
import { bylineFor } from '../../components/paper/PageSheet.tsx';
import styles from './Editor.module.css';

const ANGLE_LABEL: Record<Angle, string> = { puff: 'Puff', straight: 'Straight', hard: 'Hard-hitting' };
const TIER_LABEL: Record<Tier, string> = { lead: 'Lead', secondary: 'Secondary', brief: 'Brief' };
const ATTR_LABEL: Record<string, string> = { speed: 'Speed', accuracy: 'Accuracy', impact: 'Impact', charge: 'Charge', flair: 'Flair', tact: 'Tact' };

export function Inspector() {
  const game = useStore((s) => s.game);
  const selectedId = useStore((s) => s.selectedBlockId);
  const sendToPress = useStore((s) => s.sendToPress);
  if (!game) return null;
  const found = selectedId ? findBlock(game.draft, selectedId) : undefined;
  const placed = wireStories(game).filter((s) => game.draft.pages.front.concat(game.draft.pages.a2, game.draft.pages.a3).some((b) => b.kind === 'story' && b.storyId === s.id));

  return (
    <div className={styles.inspector}>
      <div className={styles.memo}>
        {found?.block.kind === 'story' ? (
          <StoryNotes block={found.block} page={found.page} />
        ) : found?.block.kind === 'ad' ? (
          <AdNotes adId={found.block.adId} blockId={found.block.id} page={found.page} />
        ) : (
          <IssueNotes />
        )}
      </div>
      <button className={styles.press} onClick={sendToPress} disabled={placed.length === 0} title={placed.length === 0 ? 'Put at least one story on the page' : undefined}>
        Send to press
      </button>
    </div>
  );
}

function StoryNotes({ block, page }: { block: StoryBlock; page: PageId }) {
  const game = useStore((s) => s.game)!;
  const edit = useStore((s) => s.edit);
  const assign = useStore((s) => s.assignReporter);
  const setAngle = useStore((s) => s.setAngle);
  const { stories, world } = loadGameData();
  const story = stories.storyById(block.storyId);
  if (!story) return null;
  const a = game.draft.assignments[story.id] ?? { reporterId: null, angle: 'straight' as Angle };
  const fit = fitOf(story, block);
  const staff = game.staff.map((id) => reporterById(world, id)).filter((r): r is Reporter => !!r);
  const reporter = a.reporterId ? reporterById(world, a.reporterId) : undefined;
  const article = articleSource().get({ storyId: story.id, journalistId: a.reporterId, angle: a.angle, tier: block.tier }, story);
  const inches = textInches(block);

  return (
    <>
      <div className={styles.kicker}>Selected · {placementLabel(page, block)}</div>
      <h2 className={styles.noteHead}>{story.wire_headline}</h2>

      <Label>Size on the page</Label>
      <div className={styles.segmented}>
        {(['lead', 'secondary', 'brief'] as Tier[]).map((t, i) => (
          <button key={t} className={block.tier === t ? styles.segOn : ''} onClick={() => edit((d) => setTier(d, block.id, t, story))} title={`Key ${i + 1}`}>
            {TIER_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.fitLine}>
        <span>
          {block.cols}×{block.rows} · {Math.round(inches)} in of text for a {story.base_column_inches} in story
        </span>
        <span className={styles['fitWord_' + fit.status]}>{FIT_LABEL[fit.status]}</span>
      </div>
      <div className={styles.smallRow}>
        <span>Prominence ×{prominenceOf(page, block).toFixed(2)}</span>
        {block.tier === 'lead' ? (
          <button className={styles.linkBtn} onClick={() => edit((d) => togglePhoto(d, block.id))}>
            {block.photo ? 'Drop photo' : 'Add photo'}
          </button>
        ) : null}
      </div>

      <Label>Reporter</Label>
      <div className={styles.reporters}>
        {staff.map((r) => {
          const load = reporterLoad(game.draft, r.id) - (a.reporterId === r.id ? inches : 0);
          const cap = filingCapacity(r);
          const over = load + inches > cap;
          return (
            <button key={r.id} className={`${styles.reporter} ${a.reporterId === r.id ? styles.reporterOn : ''}`} onClick={() => assign(story.id, r.id)}>
              <span className={styles.repName}>
                {r.name}
                {!isOnDesk(r, story, world) ? <em> · off desk</em> : null}
              </span>
              <Meter value={load + inches} max={cap} warn={over} />
              <span className={over ? styles.warnText : styles.repCap}>
                {Math.round(load + inches)}/{cap} in
              </span>
            </button>
          );
        })}
        <button className={`${styles.reporter} ${a.reporterId === null ? styles.reporterOn : ''}`} onClick={() => assign(story.id, null)}>
          <span className={styles.repName}>Wire copy</span>
          <span className={styles.repCap}>no byline · straight only</span>
        </button>
      </div>
      {reporter ? <Attributes reporter={reporter} /> : null}

      <Label>Angle</Label>
      <div className={styles.segmented}>
        {ANGLES.map((ang) => {
          const disabled = (ang === 'puff' && story.sensitivity === 'high') || (a.reporterId === null && ang !== 'straight');
          return (
            <button key={ang} disabled={disabled} className={a.angle === ang ? styles.segOn : ''} onClick={() => setAngle(story.id, ang)}>
              {ANGLE_LABEL[ang]}
            </button>
          );
        })}
      </div>
      {story.sensitivity === 'high' ? <p className={styles.note}>Sensitive story: no Puff, and the copy stays plain and respectful whatever the angle.</p> : null}

      <Label>Copy · {article.origin === 'template' ? 'wire facts (template)' : article.origin}</Label>
      <div className={styles.copy}>
        <div className={styles.copyHead}>{article.headline}</div>
        {article.deck ? <div className={styles.copyDeck}>{article.deck}</div> : null}
        <div className={styles.copyByline}>{bylineFor(game.draft, story.id)}</div>
        <p>{article.body}</p>
      </div>

      <button className={styles.linkBtn} onClick={() => edit((d) => removeBlock(d, block.id), { select: null })}>
        Take it off the page (Del)
      </button>
    </>
  );
}

function AdNotes({ adId, blockId, page }: { adId: string; blockId: string; page: PageId }) {
  const edit = useStore((s) => s.edit);
  const entity = loadGameData().world.entities.find((e) => e.id === adId);
  if (!entity) return null;
  return (
    <>
      <div className={styles.kicker}>Selected · advertisement · {pageLabel(page)}</div>
      <h2 className={styles.noteHead}>{displayName(entity.name)}</h2>
      <p className={styles.note}>
        Pays <b>${adPay(entity, page)}</b> this issue{page === 'front' ? ' (front-page rate)' : ''}. Front page pays ${adPay(entity, 'front')}, inside ${adPay(entity, 'a2')}.
      </p>
      {entity.note ? <p className={styles.note}>{entity.note}</p> : null}
      <button className={styles.linkBtn} onClick={() => edit((d) => removeBlock(d, blockId), { select: null })}>
        Pull the ad (Del)
      </button>
    </>
  );
}

function IssueNotes() {
  const game = useStore((s) => s.game)!;
  const { world } = loadGameData();
  const staff = game.staff.map((id) => reporterById(world, id)).filter((r): r is Reporter => !!r);
  const pages = activePages(game.draft);
  return (
    <>
      <div className={styles.kicker}>Notes for this issue</div>
      <h2 className={styles.noteHead}>Make up the paper</h2>
      <p className={styles.note}>
        Drag stories off the wire onto the page. Space is the budget: what you can't fit goes inside or doesn't run. A story with its headline above the fold
        counts most (×{PROMINENCE.frontAboveFold}), below the fold ×{PROMINENCE.frontBelowFold}, inside ×{PROMINENCE.inside}, a brief ×{PROMINENCE.brief}.
      </p>

      <Label>Space</Label>
      {pages.map((p) => {
        const u = pageUsage(game.draft, p);
        return (
          <div key={p} className={styles.spaceRow}>
            <span>{pageLabel(p)}</span>
            <SpaceBar news={u.newsInches} ads={u.adInches} total={u.totalInches} />
            <span>{u.freeInches} in free</span>
          </div>
        );
      })}
      <div className={styles.smallRow}>
        <span>Ad money this issue</span>
        <b className={styles.money}>+${adRevenue(game.draft, world.entities)}</b>
      </div>
      {game.draft.extraPages.length ? (
        <div className={styles.smallRow}>
          <span>Extra pages</span>
          <span className={styles.warnText}>+${(EXTRA_PAGE_COST_PER_COPY * game.draft.extraPages.length).toFixed(2)} print cost per copy</span>
        </div>
      ) : null}

      <Label>Reporters' filing</Label>
      {staff.map((r) => {
        const load = reporterLoad(game.draft, r.id);
        const cap = filingCapacity(r);
        return (
          <div key={r.id} className={styles.spaceRow}>
            <span>{r.name}</span>
            <Meter value={load} max={cap} warn={load > cap} />
            <span className={load > cap ? styles.warnText : ''}>{Math.round(load)}/{cap} in</span>
          </div>
        );
      })}

      <Label>Keys</Label>
      <p className={styles.keys}>
        Click to select · drag to move · drag the orange corner to resize · arrows nudge · shift+arrows resize · 1/2/3 lead/secondary/brief · Del removes ·
        Ctrl+Z undo · Ctrl+Shift+Z redo
      </p>
    </>
  );
}

function Attributes({ reporter }: { reporter: Reporter }) {
  return (
    <div className={styles.attrs}>
      <div className={styles.attrVoice}>"{reporter.voice}"</div>
      {ATTRIBUTE_KEYS.map((k) => (
        <div key={k} className={styles.attr}>
          <span>{ATTR_LABEL[k]}</span>
          <b className={reporter.attributes[k] >= 15 ? styles.attrHigh : reporter.attributes[k] <= 7 ? styles.attrLow : ''}>{reporter.attributes[k]}</b>
        </div>
      ))}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className={styles.label}>{children}</div>;
}

function Meter({ value, max, warn }: { value: number; max: number; warn?: boolean }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <span className={styles.meter}>
      <span className={warn ? styles.meterWarn : styles.meterFill} style={{ width: `${pct}%` }} />
    </span>
  );
}

function SpaceBar({ news, ads, total }: { news: number; ads: number; total: number }) {
  return (
    <span className={styles.meter}>
      <span className={styles.meterFill} style={{ width: `${(news / total) * 100}%` }} />
      <span className={styles.meterAd} style={{ width: `${(ads / total) * 100}%` }} />
    </span>
  );
}
