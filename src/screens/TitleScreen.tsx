// Title screen: a newspaper on the desk where the menu options are headlines.
// First pass for milestone 1; the full title screen and setup form come in milestone 5.
import logo from '../assets/tapestry-logo.png';
import { loadGameData } from '../data/worldData.ts';
import { useStore } from '../state/store.ts';
import { DeskSurface } from '../components/desk/DeskSurface.tsx';
import { PhotoBox } from '../components/paper/Halftone.tsx';
import { saves } from '../state/save.ts';
import styles from './TitleScreen.module.css';

export function TitleScreen() {
  const goto = useStore((s) => s.goto);
  const loadGame = useStore((s) => s.loadGame);
  const { stories } = loadGameData();
  const metas = saves.list();
  const auto = metas.find((m) => m.slot === 'autosave');
  const slot1 = metas.find((m) => m.slot === 'slot1');
  const headlines = stories.storiesForDay(1).slice(0, 3);

  return (
    <DeskSurface>
      <div className={styles.paperBack} />
      <div className={styles.paper}>
        <div className={styles.topline}>
          <span>Vol. I · No. 1</span>
          <span>Late city edition</span>
          <span>Price: your integrity</span>
        </div>
        <h1 className={styles.masthead}>Tapestry Newspaper Game</h1>
        <div className={styles.dateline}>
          <span>Philadelphia</span>
          <span>A demo · every story in it is fiction</span>
          <span>All the news you choose to print</span>
        </div>

        <button className={styles.lead} onClick={() => goto('setup')}>
          <span className={styles.kicker}>▸ New game</span>
          <span className={styles.leadHead}>Upstart launches paper on a shoestring</span>
          <span className={styles.deck}>New owner promises "the news people actually need." Rival Herald declines to comment.</span>
        </button>

        <div className={styles.columns}>
          <div className={styles.left}>
            <PhotoBox width={392} height={210} label="The river at dawn" density={0.7} />
            <div className={styles.caption}>The Delaware at dawn, where every story starts. Photo: staff.</div>
            <div className={styles.wireLabel}>Off the wire today</div>
            <ul className={styles.wireList}>
              {headlines.map((s) => (
                <li key={s.id}>{s.wire_headline}</li>
              ))}
            </ul>
          </div>
          <div className={styles.right}>
            <button className={styles.side} disabled={!auto} onClick={() => loadGame('autosave')}>
              <span className={styles.kicker}>▸ Continue</span>
              <span className={styles.sideHead}>{auto ? `${auto.paperName} reaches issue ${auto.issueNumber}` : 'No paper on the press yet'}</span>
            </button>
            <button className={styles.side} disabled={!slot1} onClick={() => loadGame('slot1')}>
              <span className={styles.kicker}>▸ Load game</span>
              <span className={styles.sideHead}>{slot1 ? `Saved edition found: ${slot1.paperName}, issue ${slot1.issueNumber}` : 'Old editions found in basement archive'}</span>
            </button>
            <div className={styles.classifieds}>
              <div className={styles.classTitle}>Classifieds</div>
              <p>
                <button className={styles.classLink} onClick={() => goto('techdemo')}>
                  <b>TECH DEMO.</b> The summarizer: wire facts in, three angles out, with the prompt, cost and fact check on show. See how the copy is written. <i>(Click to open.)</i>
                </button>
              </p>
              <p>
                <b>SETTINGS.</b> Sound, text size, which wire services to trust. Inquire within. <i>(Coming soon.)</i>
              </p>
              <p>
                <b>CREDITS.</b> Tapestry Games. Placeholder stories and art, to be replaced by the team.
              </p>
              <p>
                <b>NOTICE.</b> All people, companies and events in this demo are invented. Real neighborhoods and teams appear for flavor only.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.pass}>
        <div className={styles.passTop}>
          <span>Press</span>
          <span className={styles.passNo}>No. 0001</span>
        </div>
        <div className={styles.passLogo}>
          <img src={logo} alt="Tapestry Games" />
        </div>
        <div className={styles.passFoot}>A Tapestry Games production</div>
      </div>

      <div className={styles.slip}>
        <div className={styles.slipMeta}>Wire · 06:02 · Urgent</div>
        Editor wanted. Must handle deadlines, angry mayors, and the truth. Start today.
      </div>

      <div className={styles.footer}>Prototype v0.1 · click a headline</div>
    </DeskSurface>
  );
}
