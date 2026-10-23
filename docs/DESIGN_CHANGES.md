# Design changes after the first playtest (2026-10-23)

These decisions from the studio lead change or extend `GAME_DESIGN.md`. Where they conflict, this file wins.

## Platform
- The game is a **desktop app** (Electron), not a web page. It runs in its own window now and gets packaged for Steam later. The code stays TypeScript/React. See `PLATFORM_DECISION.md`.

## Core loop: a newsroom you manage (replaces spec section 4, steps 1–2)
One turn = one issue (daily: one wire day; weekly: the whole week).

1. **Form 1-A setup**: paper name, city, origin, **kind of paper** (paper of record / neighborhood paper / tabloid), frequency, **coverage split across seven categories** (Politics, Economy, Social, Sports, Culture, **Science & Tech**, **World & National**), stated stance.
2. **Hiring day**: pick 2–4 starting reporters from the pool within a payroll budget set by origin, and give each an **assignment**.
3. Each issue, the **hub** has three tabs:
   - **Newsroom**: every reporter, their strengths and weaknesses, and what they filed this issue plus their **unpublished backlog**. Star favorites, pick articles **for print**, spike the rest. The wire side panel lets you **commission** an uncovered story from a reporter (it uses their remaining copy) or run raw wire copy.
   - **Layout**: the paste-up board. Only articles picked for print can go on the page.
   - **Staff**: change assignments, hire from the market, release reporters.

**Hybrid article creation:** reporters automatically file the most important wire stories on their beat and patch, up to their filing capacity. The editor can also commission specific stories.

## Assignments
Each reporter has an assignment, and changes take effect from the next issue. A new hire's assignment can be set before they start.
- **Beat**: a category. Off their home desk is allowed, but the work is weaker.
- **Patch**: citywide (more stories) or one district. A district patch gives local knowledge, but they only see stories there.
- **Style**: News (Straight), Feature (Puff; Straight on sensitive stories), Investigative (Hard-hitting, longer, slower, more awards).
- **Workload**: Light / Normal / Crunch. Crunch means more copy, more corrections and falling morale.
- **Training focus**: one attribute grows slowly each issue.

## Reporter attributes (1–20, football-manager style)
- **Speed**: copy per issue.
- **Accuracy**: correction risk.
- **Impact**: reaction strength and awards.
- **Charge**: political charge, magnitude only, so it stays symmetric.
- **Flair**: readability.
- **Tact**: handling of sensitive stories.

Reporters also have morale. Candidates on the market show **ranges** until you pay to check references.

## Article scorecard (half shown, half hidden)
Every article gets a scouting report built from the story and the reporter.
- **Shown:** readership grade, political heat (never says which side), trust effect, a sensational flag, and who it will upset.
- **Hidden until printed:** correction risk and award chance.

**Sensational** means Hard-hitting by a high-charge or low-tact reporter, or low tact on a sensitive story. It swings harder both ways: more awards and more lost readers.

## Backlog
Unpublished articles carry over and lose value each issue. An article whose storyline has moved on (a newer step is on the wire) drops sharply.

## Coverage split
Changes how far the paper spreads, and with it the money and coverage. It already suggests the starting staff. Reader reach and money arrive with the simulation.

## Frequency
Changes how many stories come through per issue. Daily gets one wire day per issue. Weekly gets the whole week in one issue.

## Full loop, map and stated-vs-actual (2026-10-23, second update)
- **Simulation.** Every printed issue is resolved and the results feed the next issue.
  - Readers in each district, from what they like, the angle, local stories, staleness, sensational swings, trust, political fit, reach and the rival's share.
  - Trust and perceived lean. Lean is symmetric, and leaving out a big story the rival led with counts too.
  - Money: sales, ads, printing, delivery, distribution, payroll, overhead, wire fees and debt.
  - Hidden scorecard rolls: corrections and awards.
  - Advertisers who pull their ads, the rival's front page, scoops, and letters to the editor.
  - Cash below −$1,500 ends the paper.
- **Results sheet** after every issue, and a **final memo** at the end comparing start and finish.
- **City map tab.** Philadelphia's districts with five layers: your readership, trust, political fit, income and rival share. It shows story pins, a district panel (stats, what they read, today's stories, newsstands and bureaus), and a **"Your paper: stated vs actual"** report: coverage promised against printed, stance against how readers see you, the kind of paper against its actual mix, and a verdict.
- **Save and load.** Autosave every issue, a manual save slot, and Continue/Load on the title page.
- **18 reporters** in the pool. Up to 8 on staff.

## Ten issues, more news, sub-focus (2026-10-23, third update)
- **10 issues per game.** Daily: one day of wire per issue. Weekly: one week per issue, and the wire is the week's 40 most important stories.
- **Generic generated news.** `src/data/NewsGenerator.ts` fills 70 days at 20 stories a day. Days 1–4 keep the hand-written stories (topped up to 20) and their headlines. Every category appears every day. Left and right lean are balanced, also when weighted by importance.
- **More copy per reporter.** Capacity went up (speed 11 means about 29 inches a day). A weekly gives a week of work (×2.5). Once their beat is covered, reporters pick up other uncovered stories (general assignment, at the off-desk penalty). Their own filing leaves 30% of their time free for your commissions. Four reporters now file more than two pages can hold.
- **Sub-focus.** Every story has a subtopic (data/subtopics.json). Every reporter has a personal interest. You set each reporter's focus within their beat.
  - Reporters prefer stories on their focus when choosing what to file.
  - On their focus: +2 accuracy and impact, better readership and award odds.
  - On their interest: +2 flair and better readership.
  - Morale: +2 per issue when the focus is their interest, −1 otherwise.

## Future (not in the demo)
- **Generated local news.** The full game should generate local sports and local politics rather than take them from real news. Real news remains the source for everything else.
