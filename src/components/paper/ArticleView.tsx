// One story block as it prints: headline, deck, byline, optional photo, body in columns.
import type { Story } from '../../data/schemas.ts';
import { LEAD_PHOTO_ROWS, TIERS } from '../../sim/balance.ts';
import type { StoryBlock } from '../../sim/types.ts';
import type { ArticleText } from '../../summarizer/types.ts';
import { CELL_H, CELL_W, GUTTER } from './geometry.ts';
import { PhotoBox } from './Halftone.tsx';
import styles from './PageSheet.module.css';

const HEADLINE_SIZES: Record<StoryBlock['tier'], number[]> = {
  lead: [36, 32, 28, 25, 22, 19, 17],
  secondary: [21, 19, 17, 15.5, 14, 12.5, 11.5],
  brief: [12, 11, 10, 9.5],
};

/** Rough line count for text set at a size in a width (display face, bold). */
function lineCount(text: string, widthPx: number, size: number, upper: boolean): number {
  const perLine = Math.max(4, Math.floor(widthPx / (size * (upper ? 0.64 : 0.5))));
  let lines = 1;
  let used = 0;
  for (const w of text.split(/\s+/)) {
    const len = w.length + (used ? 1 : 0);
    if (used + len > perLine && used > 0) {
      lines++;
      used = w.length;
    } else used += len;
  }
  return lines;
}

/** Largest headline size whose lines fit the tier's headline space (after deck and byline). */
function headlineSize(block: StoryBlock, headline: string, width: number, deck: string): number {
  const upper = block.tier === 'lead';
  let budget = TIERS[block.tier].headlineRows * CELL_H - GUTTER * 2;
  if (deck && block.tier !== 'brief') budget -= lineCount(deck, width, 11.5, false) * 15 + 5;
  if (block.tier !== 'brief') budget -= 14;
  const sizes = HEADLINE_SIZES[block.tier];
  for (const size of sizes) {
    if (lineCount(headline, width, size, upper) * size * 1.04 <= budget) return size;
  }
  return sizes[sizes.length - 1] ?? 10;
}

/** Splits text at a word boundary so `share` of the words land in the first part. */
function splitWords(text: string, share: number): [string, string] {
  const words = text.split(/\s+/);
  const cut = Math.round(words.length * share);
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

interface Props {
  story: Story;
  block: StoryBlock;
  article: ArticleText;
  byline: string;
}

export function ArticleView({ story, block, article, byline }: Props) {
  const width = block.cols * CELL_W - GUTTER * 2;
  const isLead = block.tier === 'lead';
  const bodyRows = block.rows - TIERS[block.tier].headlineRows;
  const photoCols = isLead && block.photo ? Math.ceil(block.cols / 2) : 0;
  const restCols = block.cols - photoCols;
  const photoW = photoCols * CELL_W - GUTTER * 2;
  const photoH = LEAD_PHOTO_ROWS * CELL_H - GUTTER * 2;

  // With a photo, the body runs under the photo on the left and in full columns on the right.
  const leftArea = bodyRows - LEAD_PHOTO_ROWS >= 1 ? photoCols * (bodyRows - LEAD_PHOTO_ROWS) : 0;
  const rightArea = restCols * bodyRows;
  const [leftText, rightText] = photoCols ? splitWords(article.body, leftArea / Math.max(1, leftArea + rightArea)) : ['', article.body];

  return (
    <div className={`${styles.article} ${styles[block.tier]}`} style={{ width }}>
      <h3 className={styles.headline} style={{ fontSize: headlineSize(block, article.headline, width, isLead ? article.deck : '') }}>
        {article.headline}
      </h3>
      {article.deck && isLead ? <p className={styles.deck}>{article.deck}</p> : null}
      {block.tier !== 'brief' ? <div className={styles.byline}>{byline}</div> : null}
      <div className={styles.bodyRow}>
        {photoCols ? (
          <div className={styles.photoCol} style={{ width: photoW + GUTTER }}>
            <PhotoBox width={photoW} height={photoH} label="Photo" />
            <div className={styles.cutline}>{story.photo?.replace(/^Placeholder:\s*/i, '') ?? ''}</div>
            {leftText ? <div className={styles.body} style={{ columnCount: photoCols }}>{leftText}</div> : null}
          </div>
        ) : null}
        <div className={styles.body} style={{ columnCount: Math.max(1, restCols), flex: 1 }}>
          {block.tier === 'brief' ? <b className={styles.briefByline}>{byline} · </b> : null}
          {rightText}
        </div>
      </div>
    </div>
  );
}
