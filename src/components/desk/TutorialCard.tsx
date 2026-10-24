// AI-CONTENT-REVIEW: the memo text below was written by an AI model for the demo
// (see docs/AI_CONTENT_REVIEW.md). Rewrite in the team's voice before release.
// How-to-play guide: one pinned memo per screen, shown the first time the player
// gets there while the guide is on (Form 1-A, item 8; on by default). "Got it"
// hides that memo; "Turn the guide off" hides them all.
import { useStore } from '../../state/store.ts';
import styles from './TutorialCard.module.css';

interface Tip {
  id: string;
  title: string;
  lines: string[];
  /** Where the memo sits on the 1440 x 900 stage, clear of the buttons it explains. */
  at: { left?: number; right?: number; top?: number; bottom?: number };
}

export const TIPS: Record<string, Tip> = {
  hiring: {
    id: 'hiring',
    title: 'Welcome, editor. First, hire a staff.',
    lines: [
      'Click a résumé to hire that reporter; click again to let them go. Nobody is hired yet: the choice is yours.',
      'Every reporter costs payroll each issue. Stay inside the budget bar. Better reporters cost more.',
      'Each reporter works one desk (politics, sports...). Hire for the desks your coverage split promised.',
      'When you have a few, open the newsroom.',
    ],
    at: { left: 24, bottom: 24 },
  },
  newsroom: {
    id: 'newsroom',
    title: 'The newsroom: choose what to print',
    lines: [
      '“Filed articles”: what your reporters wrote. The chips are a scouting report: readership, political heat, trust. Correction risk and award chance stay hidden until you print.',
      '“The wire & local leads”: real national and world news (NPR, BBC, PBS), each linked to the original, plus the city stories your local reporters found. Commission one, or run the wire copy as-is.',
      'City news only turns up when a reporter works the Philadelphia patch or a district patch (Staff tab). Local stories sell best in their neighborhood.',
      'Mark the pieces you want with “For print”, then go to the layout.',
    ],
    at: { left: 22, bottom: 70 },
  },
  layout: {
    id: 'layout',
    title: 'The layout: paste up the page',
    lines: [
      'Drag articles from the left onto the page. Above the fold sells papers; the front page counts most.',
      'Pick a size (lead, secondary, brief) and an angle: Puff, Straight or Hard-hitting. Angle changes who likes it and who trusts you.',
      'The Ad desk sells space for money. It says who will buy, who signs once you have more readers, and what makes an advertiser pull out (hard-hitting stories about them).',
      'When the page looks right, Send to press.',
    ],
    at: { left: 500, bottom: 40 },
  },
  press: {
    id: 'press',
    title: 'The results',
    lines: [
      'See how the issue sold district by district, what it did to trust and your perceived lean, the money, the letters and the rival’s front page.',
      'Then start the next issue. A game is ten issues; run out of money and the paper folds.',
    ],
    at: { left: 24, bottom: 24 },
  },
  staff: {
    id: 'staff',
    title: 'Staff: assignments and hiring',
    lines: [
      '“Your staff”: set each reporter’s beat, focus, patch, style and workload. Changes take effect next issue. “Help wanted” is the job market.',
      'Patch: “National wire” covers US and world news. “Philadelphia” or a district digs up city news, and nobody else will.',
      'Crunch files more copy but burns morale. Hire more as the paper grows; a desk with 3+ reporters can get a desk head.',
    ],
    at: { right: 24, bottom: 24 },
  },
  map: {
    id: 'map',
    title: 'The city map',
    lines: [
      'Layers show where you sell, who trusts you, how your politics fit, income and the rival’s grip.',
      'Click a district for its readers and tastes. Newsstands and bureaus grow your reach there.',
      'Pins are this issue’s city stories. Hollow ones are stories nobody on your staff is digging up.',
    ],
    at: { left: 24, bottom: 24 },
  },
};

/** The tip for where the player is now, or null. */
function useCurrentTip(): Tip | null {
  const screen = useStore((s) => s.screen);
  const hubTab = useStore((s) => s.hubTab);
  const game = useStore((s) => s.game);
  const pending = useStore((s) => s.pendingSetup);
  const seenEarly = useStore((s) => s.tutorialSeen);
  const setup = screen === 'hiring' ? pending : game?.setup;
  if (!setup || setup.tutorial === false) return null;
  const id = screen === 'hiring' ? 'hiring' : screen === 'press' ? 'press' : screen === 'hub' ? hubTab : null;
  if (!id) return null;
  const seen = screen === 'hiring' ? seenEarly : (game?.tutorialSeen ?? []);
  return seen.includes(id) ? null : (TIPS[id] ?? null);
}

export function TutorialCard() {
  const tip = useCurrentTip();
  const dismiss = useStore((s) => s.dismissTip);
  const setTutorial = useStore((s) => s.setTutorial);
  if (!tip) return null;
  return (
    <aside className={styles.memo} style={tip.at} role="note" aria-label="How to play">
      <div className={styles.kicker}>How to play</div>
      <div className={styles.title}>{tip.title}</div>
      <ul className={styles.lines}>
        {tip.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <div className={styles.actions}>
        <button className={styles.ok} onClick={() => dismiss(tip.id)}>
          Got it
        </button>
        <button className={styles.off} onClick={() => setTutorial(false)}>
          Turn the guide off
        </button>
      </div>
    </aside>
  );
}
