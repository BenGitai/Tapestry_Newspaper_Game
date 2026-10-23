// Summarizer lab stub. The real lab (three angles side by side, prompt, tokens,
// cost, fact check) is built in milestone 3. For now it shows the template fallback.
import { useState } from 'react';
import { loadGameData } from '../data/worldData.ts';
import { templateArticle } from '../summarizer/templates.ts';
import type { Tier } from '../sim/types.ts';
import { useStore } from '../state/store.ts';
import styles from './Dev.module.css';

export function LabPlaceholder() {
  const goto = useStore((s) => s.goto);
  const hasGame = useStore((s) => s.game !== null);
  const { stories } = loadGameData();
  // Stories from the first 10 days (the daily demo); the full feed runs to day 70.
  const list = Array.from({ length: 10 }, (_, i) => stories.storiesForDay(i + 1)).flat();
  const [id, setId] = useState(list[0]?.id ?? '');
  const story = stories.storyById(id);

  return (
    <div className={styles.lab}>
      <div className={styles.labBar}>
        <b>Summarizer lab</b>
        <span>dev tool · template fallback only until milestone 3</span>
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {list.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · {s.wire_headline}
            </option>
          ))}
        </select>
        <button onClick={() => goto(hasGame ? 'hub' : 'title')}>Back</button>
      </div>
      {story ? (
        <div className={styles.labCols}>
          {(['lead', 'secondary', 'brief'] as Tier[]).map((t) => {
            const a = templateArticle(story, t);
            return (
              <div key={t} className={styles.labCol}>
                <div className={styles.labTier}>{t}</div>
                <h3>{a.headline}</h3>
                {a.deck ? <i>{a.deck}</i> : null}
                <p>{a.body}</p>
                <code>facts_used: [{a.facts_used.join(', ')}]</code>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
