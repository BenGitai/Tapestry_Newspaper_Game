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

## Future (not in the demo)
- **Generated local news.** The full game should generate local sports and local politics rather than take them from real news. Real news remains the source for everything else.
