// Right side of the layout tab: notes on the selected item, or a summary of the issue.
import { articleSource } from '../../data/ArticleSource.ts';
import { ANGLES } from '../../data/schemas.ts';
import { displayName, loadGameData } from '../../data/worldData.ts';
import { EXTRA_PAGE_COST_PER_COPY, PROMINENCE } from '../../sim/balance.ts';
import {
  activePages,
  adPay,
  adRevenue,
  FIT_LABEL,
  findBlock,
  findStoryBlock,
  fitOf,
  pageLabel,
  pageUsage,
  placementLabel,
  prominenceOf,
  removeBlock,
  setTier,
  textInches,
  togglePhoto,
} from '../../sim/layout.ts';
import { articleForStory, selectedForPrint } from '../../sim/newsroom.ts';
import { payroll } from '../../sim/staff.ts';
import { nextUnlock, totalNewsstands } from '../../sim/pages.ts';
import { totalReaders } from '../../sim/readers.ts';
import type { PageId, StoryBlock, Tier } from '../../sim/types.ts';
import { useStore } from '../../state/store.ts';
import { ANGLE_LABEL, articleScorecard, bylineOf, OriginalStoryLink, ScoutingReport, STYLE_SHORT } from '../../components/newsroom/ArticleParts.tsx';
import styles from './Editor.module.css';

const TIER_LABEL: Record<Tier, string> = { lead: 'Lead', secondary: 'Secondary', brief: 'Brief' };

export function Inspector() {
  const game = useStore((s) => s.game);
  const selectedId = useStore((s) => s.selectedBlockId);
  const sendToPress = useStore((s) => s.sendToPress);
  if (!game) return null;
  const found = selectedId ? findBlock(game.draft, selectedId) : undefined;
  const placed = selectedForPrint(game).filter((a) => findStoryBlock(game.draft, a.storyId)).length;

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
      <button className={styles.press} onClick={sendToPress} disabled={placed === 0} title={placed === 0 ? 'Put at least one article on the page' : undefined}>
        Send to press
      </button>
    </div>
  );
}

function StoryNotes({ block, page }: { block: StoryBlock; page: PageId }) {
  const game = useStore((s) => s.game)!;
  const edit = useStore((s) => s.edit);
  const setAngle = useStore((s) => s.setArticleAngle);
  const selectArticle = useStore((s) => s.selectArticle);
  const setHubTab = useStore((s) => s.setHubTab);
  const article = articleForStory(game, block.storyId);
  const sc = article && articleScorecard(game, article);
  if (!article || !sc) return null;
  const story = sc.story;
  const sized = { ...story, base_column_inches: article.inches };
  const fit = fitOf(sized, block);
  const copy = articleSource().get({ storyId: story.id, journalistId: article.reporterId, angle: article.angle, tier: block.tier }, story);

  return (
    <>
      <div className={styles.kicker}>Selected · {placementLabel(page, block)}</div>
      <h2 className={styles.noteHead}>{copy.headline}</h2>
      <OriginalStoryLink story={story} />
      <div className={styles.smallRow}>
        <span>
          {bylineOf(article)} · {STYLE_SHORT[article.style]}
        </span>
        <button
          className={styles.linkBtn}
          onClick={() => {
            selectArticle(article.id);
            setHubTab('newsroom');
          }}
        >
          Open in newsroom
        </button>
      </div>

      <div className={styles.label}>Size on the page</div>
      <div className={styles.segmented}>
        {(['lead', 'secondary', 'brief'] as Tier[]).map((t, i) => (
          <button key={t} className={block.tier === t ? styles.segOn : ''} onClick={() => edit((d) => setTier(d, block.id, t, sized))} title={`Key ${i + 1}`}>
            {TIER_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={styles.fitLine}>
        <span>
          {block.cols}×{block.rows} · {Math.round(textInches(block))} in of space for a {article.inches} in article
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

      <div className={styles.label}>Angle</div>
      <div className={styles.segmented}>
        {ANGLES.map((ang) => (
          <button
            key={ang}
            disabled={(ang === 'puff' && story.sensitivity === 'high') || (article.reporterId === null && ang !== 'straight')}
            className={article.angle === ang ? styles.segOn : ''}
            onClick={() => setAngle(article.id, ang)}
          >
            {ANGLE_LABEL[ang]}
          </button>
        ))}
      </div>

      <div className={styles.label}>Scouting report · placement multiplies it ×{prominenceOf(page, block).toFixed(2)}</div>
      <ScoutingReport card={sc.card} />

      <div className={styles.label}>Copy · {copy.origin === 'template' ? 'wire facts (template)' : copy.origin}</div>
      <div className={styles.copy}>
        <div className={styles.copyHead}>{copy.headline}</div>
        {copy.deck ? <div className={styles.copyDeck}>{copy.deck}</div> : null}
        <div className={styles.copyByline}>{bylineOf(article)}</div>
        <p>{copy.body}</p>
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
  const pages = activePages(game.draft);
  const pile = selectedForPrint(game);
  const placed = pile.filter((a) => findStoryBlock(game.draft, a.storyId)).length;
  const ads = adRevenue(game.draft, world.entities);
  const pay = payroll(world, game.staff);
  return (
    <>
      <div className={styles.kicker}>Notes for this issue</div>
      <h2 className={styles.noteHead}>Make up the paper</h2>
      <p className={styles.note}>
        Drag your picked articles onto the page. Space is the budget: what doesn't fit waits in the backlog and goes stale. A story with its headline above the
        fold counts most (×{PROMINENCE.frontAboveFold}), below the fold ×{PROMINENCE.frontBelowFold}, inside ×{PROMINENCE.inside}, a brief ×{PROMINENCE.brief}.
      </p>

      <div className={styles.label}>Articles</div>
      <div className={styles.smallRow}>
        <span>Placed</span>
        <b>
          {placed} of {pile.length} picked
        </b>
      </div>

      <div className={styles.label}>Space</div>
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

      <NextPage />

      <div className={styles.label}>Money this issue</div>
      <div className={styles.smallRow}>
        <span>Ads</span>
        <b className={styles.money}>+${ads}</b>
      </div>
      <div className={styles.smallRow}>
        <span>Payroll</span>
        <b className={styles.warnText}>−${pay}</b>
      </div>
      {game.draft.extraPages.length ? (
        <div className={styles.smallRow}>
          <span>Extra pages</span>
          <span className={styles.warnText}>+${(EXTRA_PAGE_COST_PER_COPY * game.draft.extraPages.length).toFixed(2)} print cost per copy</span>
        </div>
      ) : null}
      <p className={styles.keys}>Copy sales arrive with the simulation milestone.</p>

      <div className={styles.label}>Keys</div>
      <p className={styles.keys}>
        Click to select · drag to move · drag the orange corner to resize · arrows nudge · shift+arrows resize · 1/2/3 lead/secondary/brief · Del removes ·
        Ctrl+Z undo · Ctrl+Shift+Z redo · F1/F2/F3 switch tabs
      </p>
    </>
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

/** What it takes to unlock the next inside page. */
function NextPage() {
  const game = useStore((s) => s.game)!;
  const next = nextUnlock(game);
  if (!next) return <p className={styles.keys}>All {game.unlockedPages.length + 2} pages unlocked.</p>;
  const readers = totalReaders(game.districts);
  const stands = totalNewsstands(game);
  return (
    <p className={styles.keys}>
      Next page, {next.page.toUpperCase()}: {readers.toLocaleString()}/{next.readers.toLocaleString()} readers · {stands}/{next.newsstands} newsstands (add
      them on the City map).
    </p>
  );
}
