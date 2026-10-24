// Article slips and their scouting-report scorecard.
import type { Story } from '../../data/schemas.ts';
import { loadGameData } from '../../data/worldData.ts';
import { isOriginalStoryUrl } from '../../data/StorySource.ts';
import { freshness } from '../../sim/newsroom.ts';
import { editorEffect } from '../../sim/desks.ts';
import { grade, heatLabel, scorecard, trustLabel, type Scorecard } from '../../sim/scorecard.ts';
import { initials, reporterById } from '../../sim/staff.ts';
import type { Article, GameState } from '../../sim/types.ts';
import styles from './ArticleParts.module.css';

export const ANGLE_LABEL = { puff: 'Puff', straight: 'Straight', hard: 'Hard-hitting' } as const;
export const STYLE_SHORT = { news: 'News', feature: 'Feature', investigative: 'Investigation' } as const;

export function articleScorecard(game: GameState, article: Article): { card: Scorecard; fresh: number; superseded: boolean; story: Story } | undefined {
  const { world, stories } = loadGameData();
  const story = stories.storyById(article.storyId);
  if (!story) return undefined;
  const member = game.staff.find((m) => m.reporterId === article.reporterId);
  const f = freshness(article, game, stories);
  return { card: scorecard(article, story, world, member, f.value, editorEffect(game, world, story)), fresh: f.value, superseded: f.superseded, story };
}

export function bylineOf(article: Pick<Article, 'reporterId' | 'storyId'>): string {
  const { world, stories } = loadGameData();
  const r = article.reporterId ? reporterById(world, article.reporterId) : undefined;
  if (r) return `By ${initials(r.name)}`;
  const story = stories.storyById(article.storyId);
  return stories.wireSources().find((w) => w.id === story?.wire_source)?.name ?? 'Wire report';
}

/** The shown half of the scorecard as chips, plus question marks for the hidden half. */
export function ScoreChips({ card, compact }: { card: Scorecard; compact?: boolean }) {
  const g = grade(card.shown.readership);
  return (
    <div className={`${styles.chips} ${compact ? styles.chipsCompact : ''}`}>
      <span className={`${styles.chip} ${styles['g' + g]}`} title="Readership appeal">
        Read {g}
      </span>
      <span className={`${styles.chip} ${card.shown.heat >= 0.4 ? styles.hot : ''}`} title="Political heat (either side)">
        Heat {heatLabel(card.shown.heat)}
      </span>
      <span className={`${styles.chip} ${card.shown.trust > 0.02 ? styles.good : card.shown.trust < -0.02 ? styles.bad : ''}`} title="Effect on trust">
        {trustLabel(card.shown.trust)}
      </span>
      {card.shown.sensational ? <span className={`${styles.chip} ${styles.sensational}`}>Sensational</span> : null}
      {!compact ? (
        <>
          <span className={`${styles.chip} ${styles.hidden}`} title="Hidden until the paper is printed">
            Correction ?
          </span>
          <span className={`${styles.chip} ${styles.hidden}`} title="Hidden until the paper is printed">
            Award ?
          </span>
        </>
      ) : null}
    </div>
  );
}

/** Full scouting report for the detail panel. */
export function ScoutingReport({ card }: { card: Scorecard }) {
  return (
    <div className={styles.report}>
      <div className={styles.reportRow}>
        <span>Readership appeal</span>
        <b>{grade(card.shown.readership)}</b>
        <Bar v={card.shown.readership} />
      </div>
      <div className={styles.reportRow}>
        <span>Political heat</span>
        <b>{heatLabel(card.shown.heat)}</b>
        <Bar v={card.shown.heat} warn />
      </div>
      <div className={styles.reportRow}>
        <span>Trust</span>
        <b>{trustLabel(card.shown.trust)}</b>
        <Bar v={(card.shown.trust + 1) / 2} centered />
      </div>
      <div className={styles.reportRow}>
        <span>Correction risk</span>
        <b className={styles.q}>?</b>
        <span className={styles.hiddenNote}>revealed when printed</span>
      </div>
      <div className={styles.reportRow}>
        <span>Award chance</span>
        <b className={styles.q}>?</b>
        <span className={styles.hiddenNote}>revealed when printed</span>
      </div>
      {card.shown.upsets.length ? <div className={styles.upsets}>Will upset: {card.shown.upsets.map((n) => n.replace(/\s*\(fictional\)/, '')).join(', ')}</div> : null}
      {card.notes.length ? (
        <ul className={styles.notes}>
          {card.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Bar({ v, warn, centered }: { v: number; warn?: boolean; centered?: boolean }) {
  return (
    <span className={styles.bar}>
      {centered ? <span className={styles.mid} /> : null}
      <span className={warn ? styles.barWarn : styles.barFill} style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
    </span>
  );
}

/**
 * Link to the original coverage a story is based on. Real links open in the
 * system browser (the desktop shell only lets https:// out). Demo stories are
 * fiction, so their link is a placeholder and says so instead of going nowhere.
 */
export function OriginalStoryLink({ story }: { story: Pick<Story, 'real_story_url' | 'wire_source'> }) {
  const { stories } = loadGameData();
  const source = stories.wireSources().find((w) => w.id === story.wire_source)?.name ?? 'the wire';
  if (isOriginalStoryUrl(story.real_story_url)) {
    return (
      <a className={styles.original} href={story.real_story_url} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
        Read the original story ({source}) ↗
      </a>
    );
  }
  return (
    <span className={styles.originalPlaceholder} title="Every story in the demo is fiction. In the full game this links to the real coverage.">
      Original story: placeholder in the demo (fictional {source} report)
    </span>
  );
}
