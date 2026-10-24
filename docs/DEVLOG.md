# Devlog

## 2026-10-24 · Real news, local patches, color, real map, how-to-play guide

**What changed**
- **Real news on the wire.**
  - National and world stories come from a snapshot of public RSS feeds: NPR, BBC News and PBS NewsHour, 35 feeds.
  - `npm run news:fetch` refreshes the snapshot (`data/news/snapshot.json`). Only the headline, the feed's own summary and the link are kept, never article text.
  - `npm run news:build` (`server/newsFacts.ts`, `claude-haiku-5-5`) tags each item (desk, sub-focus, importance, sensitivity, lean) and restates it as facts. It then drops any fact whose numbers or names aren't in the source.
  - 604 items gave 554 stories, about 55 per issue. Cost about $0.12. Results are cached in `data/news/extractions.json`, so re-runs only pay for new items.
  - Every story links to the original. The Guardian is on hold until its API is set up.
- **The wire is national and international only.** World is international only. An issue's wire is the 20 most important stories (40 for a weekly), taken a desk at a time so every beat has something.
- **City news only through local patches.** Patches are now:
  - *National wire* (the default).
  - *Philadelphia* (any city story).
  - A district.
  Philadelphia stories (hand-written plus generator) show up only as "Philadelphia leads" for reporters on a local patch. The wire desk, map pins and commissions follow the same rule. National scoops count everywhere; local stories still get the neighborhood boost. Saves are now v4, because the patch values changed.
- **AI summaries in the game:** `npm run summarize` now covers both the wire and the local pool of issues 1–10. Real news is written in the neutral desk voice.
- **Color.**
  - One spot ink per desk (`categoryInk` in `src/theme/tokens.ts`) on slips, kickers and layout cards.
  - Placeholder photos are code-drawn two-color scenes per desk: a dome for politics, a pitch for sports, a globe for world, and so on.
  - Still no images, gradients or drop shadows.
- **Real map.** `npm run map:build` turns City of Philadelphia open data into `data/map.philly.json`, credited on the map:
  - The 18 planning districts, grouped into the 8 game districts.
  - Rivers and large parks.
  Layers are now colored single-hue choropleths; political fit uses violet, never party red or blue. Hollow pins are city stories nobody is digging up.
- **How-to-play guide.** Item 8 on Form 1-A, on by default. It shows a memo on each screen the first time you reach it: hiring, newsroom, layout, results, staff and map. "Got it" hides one memo; "Turn the guide off" hides them all. The hub's Guide button brings them back.
- **Hiring day starts empty:** the player picks every hire.

**Balance** (`npm run simulate`; the runner now puts half the starting staff on the Philadelphia patch): a grown paper reaches about 18–22k readers (inherited or bought), as before. A paper with nobody on local patches grows much less: city news matters.

**Next**
- Re-run `npm run news:fetch` and `news:build` over a few days for a bigger pool; add the Guardian once its key is set up.
- Spot-check the model's lean tags on real stories.
- Real art from the team.


## 2026-10-24 · Offline article cache filled; tested in the desktop app

- **Article cache filled** with `claude-haiku-5-5`: 5,455 of 5,541 planned articles (98.4%) are pre-generated in `data/generated/summaries.cache.json`. The game reads them offline through `ArticleSource` (newsroom, layout, printed pages, tech demo). The other 86 failed the fact check (for example "two decades" for 19 years, invented weekdays and cities) and use templates.
- **Real cost** about $1.50 in total: three passes, roughly $0.00021 per article, with prompts around 1,100 tokens rather than the dry-run's estimate. At full scale (200 stories a day for 30 days) that's about $1.23 a month for one article per story.
- **Fact check:**
  - Headlines a word or two over, and bodies up to 2.2× target, are now warnings, not rejections. They made up most of the first run's 1,109 rejections, and the layout already fits them.
  - Capitalized number words ("Fourteen ...") are checked as numbers.
  - Invented numbers and names still fail.
- **Tech demo fixes:** the squeezed status line, and no dev-endpoint calls in the offline build. The desktop play-through passes on the branch.
- **Original-story links** wherever an article is read. Real `https://` links open in the system browser. Demo placeholders say they're placeholders.
- Tests: 176 passing, including checks that the shipped cache covers more than 95% of the 10-issue set.
- **Key handling:** the API key lives only in `.env` (gitignored). Rotate it if it was ever shared.

## 2026-10-24 · Summarizer: tech demo and offline pre-generated articles

**What changed**
- **Tech demo** (`src/screens/TechDemo.tsx`, replaces the lab stub). Title screen classified "TECH DEMO", or `npm run techdemo` (opens the desktop app straight into it; `npm run techdemo:start` does the same from a build; in a browser use `npm run dev:web` and open `/#techdemo`). Pick a story, see the wire facts, compare Puff / Straight / Hard-hitting for a chosen reporter voice and length tier, with the exact prompt, tokens, cost per article and the fact check (flagged numbers and names highlighted). Sensitive stories show no Puff column.
- **Live mode in the tech demo** only under the dev server and only with a key: `server/devEndpoint.ts` (Vite middleware) calls the model. The key never leaves Node. Without a key the demo shows pre-generated articles, then templates.
- **`npm run summarize`** (`scripts/summarize.ts`, Node `--env-file-if-exists=.env`): writes `data/generated/summaries.cache.json`. Flags `--dry-run`, `--story <id>`, `--force`, `--limit <n>`, `--concurrency <n>`, `--verbose`. Saves as it goes and skips cached articles, so it can be stopped and re-run. Prints per-call tokens and cost, totals, and an extrapolation to 200 stories/day for 30 days.
- **Game reads articles through `ArticleSource`** (unchanged for game code): session-fetched, then cache (exact reporter, then the neutral desk voice), then templates. `RemoteArticleProvider` is the stub for the final game's shared server (generate once, share with everyone). No server built.
- **Rules in code:** `src/summarizer/prompt.ts` (facts only, uncertainty kept, angle changes emphasis not facts, sensitive stories plain and never Puff, write as the paper, never mention AI), `factcheck.ts` (numbers normalized: commas, $, million/billion/thousand, number words; names checked against facts, wire text and game data: paper, reporters, city, districts, neighborhoods, wire sources), `config.ts` (model, prices, headline word limits). Model is `claude-haiku-5-5`, set only in `config.ts`, overridable with `SUMMARIZER_MODEL`.
- **API use** (`server/generate.ts`): `@anthropic-ai/sdk` `messages.parse` with a Zod structured output, thinking disabled, effort low, no sampling parameters, no prefill. A refusal or truncated answer is left out of the cache (the game uses the template). A failed fact check is retried once; if it fails again it is also left out.
- Tests: 169 passing (was 117). New: fact check, prompt builder, cache and article source layers, plan, cost, generator with a fake client.

**Which articles are pre-generated** (`src/summarizer/plan.ts`): the 542 stories a 10-issue game can show: the full daily wire of days 1-10 and the top `WEEKLY_WIRE_SIZE` stories of weeks 1-10 (taken from `wireForIssue`, so it matches the game). Per story: angle x length tier (Puff skipped when sensitive). The 30 hand-written stories are also written in each matching desk reporter's voice (their voice line from the staff pool); generated stories use the neutral desk voice only, and any reporter without their own entry gets the desk voice. That is 5,541 articles. Pre-generated copy never names the paper (the player picks the name).

**Cost** (`npm run summarize -- --dry-run`, estimates): 5,541 calls, about 3.0M input and 0.8M output tokens, about $0.69 at $0.10 / $0.50 per million. Allow 5-10% more for retries. At that average, 200 stories/day for 30 days is about $0.75 for one article per story, or about $6.75 if every angle and length is written.

**Needs the owner:** the cloud run had no API key, so **the committed cache is empty** and the game runs on templates. Add `ANTHROPIC_API_KEY` to `.env` (gitignored), run `npm run summarize` locally (try `-- --limit 20` first), review a few articles in the tech demo, and commit `data/generated/summaries.cache.json` before shipping the offline demo. Prices were last checked 2026-10-24; recheck.

**Small decisions**
- The cache is about 5,500 articles, so the committed file will be around 3-4 MB and ships inside the app bundle.
- Body length: the minimum shrinks for stories with few facts (a four-fact story cannot honestly fill a 120-word lead), and the prompt tells the model to write less rather than pad.
- Sentence-initial single words are not name-checked (they can't be told from "Residents"); sentence-initial capitalized pairs and all mid-sentence capitals are.
- The cache has no paper-stance variants. Stance would multiply the set by three for a small framing change.

**What's next:** run `npm run summarize` with a key and review; decide whether any flagged-and-dropped articles need a prompt tweak; later, the shared server behind `RemoteArticleProvider`.

## 2026-10-23 · Renamed to the placeholder "Tapestry Newspaper Game" (game title, window, package, app id, save keys). "Above the fold" stays where it means the newspaper fold.

## 2026-10-23 · Page unlocks

- Pages A4–A6 unlock permanently with readers plus newsstands (`src/sim/pages.ts`, `PAGE_UNLOCKS` in balance). A3 is open from the start. Extra pages carry over between issues. Locked tabs show their requirements, and progress shows in the Layout notes and the map's paper panel.
- Saves bumped to v3.
- Runner: "Grow + desk heads" now buys newsstands and runs unlocked pages. It reaches 18–25k readers and 5–6 pages by issue 10, against 12–16k for a 4-reporter paper. It ends with less cash (invested) and more corrections (cheap hires). A big newsroom now pays off through more pages.
- Tests: 117 passing.

## 2026-10-23 · Bigger starting budgets, room for a big newsroom

- Starting payroll budgets are now $500 (founded), $580 (inherited) and $540 (bought). That buys 4–5 average reporters (about $100 each) or 3–4 good ones (about $135). You can hire up to 5 on hiring day. Tests check both targets.
- The newsroom cap went from 8 to 24 (`MAX_STAFF`).
- The hiring market adds 18 generated candidates (`src/data/CandidateGenerator.ts`, deterministic, flagged for AI-content review), 36 in total. Most are average, with a few rookies and standouts, and salaries follow the hand-written pool by skill.
- Balance (`npm run simulate`, 10 daily issues, suggested staff): a founder ends with about $12–20k, enough to grow staff. A 20-person payroll costs about $2k per issue, so a big newsroom is a later-game goal you earn with circulation.
- Tests: 103 passing.

- **Desk heads** (`src/sim/desks.ts`). Promotion needs 3 or more journalists on the desk. There are four delegable duties (Filter, Fix, Upgrade, Run the desk) plus mentoring.
  - The start of each issue now runs head assignments, then filing, then head commissions, then filtering.
  - The Staff tab groups people by desk, with promote and step-down controls and duty toggles. The newsroom shows HEAD and "desk pick" badges.
- **Runner:** a new "Grow + desk heads" strategy reaches 23–24 staff by issue 10 and stays solvent. Readers barely beat a 4-reporter paper, though, because page space is the bottleneck. A bigger newsroom gives more choice, not more volume. A future step could be more pages, or sales that reward quality more.
- **Tests:** 113 passing.

## 2026-10-23 · Ten issues, generated news, more copy, sub-focus

**What changed**
- **Ten issues per game** (`MAX_ISSUES`). Weekly papers get a new week of news each issue (days 1–70).
- **News generator.** `src/data/NewsGenerator.ts` holds about 90 templates across all 37 subtopics. It's deterministic by day, fictional, and flagged `AI-CONTENT-REVIEW`. `DemoStorySource` merges it with the hand-written stories behind the same `StorySource` interface. Twenty stories a day; a weekly wire is the week's top 40.
- **Subtopics** (`data/subtopics.json`):
  - Each story has one, and each reporter has an interest (added to the data).
  - The assignment editor has a Focus picker, with the reporter's favorite starred.
  - Slips show the subtopic and a ★ focus marker.
  - Focus affects filing priority, the scorecard and morale.
- **More articles per writer.**
  - Capacity raised (base 12 + 1.5 × speed), ×2.5 for a weekly.
  - General assignment after the beat is covered.
  - A 30% reserve for commissions, so commissioning works in practice.
- **Tests:** 101 passing. New ones cover:
  - Every generated story is valid, and headline numbers appear in its facts.
  - Lean balance, raw and importance-weighted.
  - Determinism.
  - Full 10-issue daily and weekly games with no repeated news.
  - More copy than space.
  - Focus effects.
  - The mirror test now flips the whole feed, generated news included.

**Problems found and fixed**
- Template headlines and facts could disagree on numbers (drawn twice). Number draws are now stable within a story.
- The Flyers template gave a score in the headline that the facts never mentioned. The test caught it.
- Generated lean was balanced by count but tilted left by importance. Balancing is now importance-weighted, and two right-leaning templates were added.
- Once reporters filed to capacity, commissions became impossible. Added the commission reserve.

**Balance** (`npm run simulate`, 10 daily issues)
- Founded: about 1,500 → 10,000–11,500 readers, cash $6k → $5–18k depending on ads.
- Wire copy now trades cash (fees) for readers.
- All-puff costs about 20 trust points.
- Printing nothing goes bankrupt.
- Right stances still trail left in Philadelphia because of the district data (rules verified symmetric).

**What's next:** the summarizer milestone. Article text is still built from the facts by templates.

## 2026-10-23 · Full gameplay loop, city map, more reporters

**What changed**
- **Simulation (`src/sim/simulate.ts`).** `resolveIssue` runs when you send to press and covers readers and trust per district, perceived lean, money, hidden scorecard rolls, advertisers, the rival, letters and bankruptcy. Every number lives in `balance.ts` (READERS, CIRCULATION, TRUST, LEAN, MONEY, ADVERTISERS, RIVAL_SIM, PAPER_STYLE). Rolls use a seeded RNG, so a game replays exactly.
- **Rival (`rival.ts`)** follows the rule in the data file. Scoops and missed big stories move rival share and your lean.
- **Results sheet** after every issue covers the books, sales by district, the revealed hidden half, events, the rival's front page and letters. The end memo compares start and finish, and there's a bankruptcy ending.
- **City map tab (F4)** has five layers, story pins, a district panel with newsstands and bureaus, and a stated-vs-actual report for the paper.
- **Saves:** autosave every issue, a manual slot from the hub's Save button, and Continue/Load on the title page. Storage sits behind a `SaveStore` interface.
- **Pulled ads** show on the ad desk and can't be placed.
- **Reporters:** 9 more fictional ones (18 total). The newsroom holds 8. Suggested starting staff now covers different desks.
- **`npm run simulate`** plays 10 strategies for each origin.
- **Tests:** 84 passing. New: a full mirror test (flip every lean, the stance and every district's mix, and results mirror exactly), deterministic replay, the books balancing, advertiser pull-outs, the rival rule, district actions, letters and bankruptcy.

**Bugs found and fixed**
- `findFreeSpot` ignored candidate positions when handed a whole block. The balance runner caught it.
- The first balance pass was far too generous: a new paper went from 1,500 to 26,000 readers and earned $80k in four issues. Added delivery cost per copy, overhead, debt repayment and wire fees, and slowed reader growth.

**Balance after this session** (`npm run simulate`, 4 daily issues)
- Founded: about 1,500 → 5,000 readers. Cash is tight ($6k → about $3–4k, more with ads). Printing nothing goes bankrupt.
- Inherited grows modestly. Bought shrinks but stays solvent.
- All-puff loses about 7 trust points against straight or hard-hitting.
- Stances: right-leaning stances do slightly worse than left in Philadelphia because the district data leans left. That comes from the data, not the rules; the mirror test proves the rules are symmetric. The team may want to revisit the district mixes.
- These numbers need real playtesting.

**Small decisions**
- Readers are copies sold. Cover price is fixed.
- A missed big story is the rival's front-page story with importance ≥ 4 that you didn't run.
- Corrections and awards apply in the same results sheet. They aren't held over to the next day.
- Letters are template-filled from issue events and flagged `AI-CONTENT-REVIEW`.

**What's next:** the summarizer (prompt, cache, `npm run summarize`, cost report, fact check, Summarizer lab). Then polish: sound-free juice on the stamp and press, a settings screen, and a playtest checklist.

## 2026-10-23 · Desktop app and the newsroom loop

**What changed**
- **Desktop app.** Electron 44 wraps the game. `npm run dev` opens the game window, with hot reload from Vite. `npm run start` runs the production build. `npm run package` builds an unpacked app in `release/`. `npm run smoke` plays through the built app with Playwright and screenshots each step into `.tmp/smoke/`.
  - The window is sandboxed: no Node in the page, no navigation, links open in the system browser. F11 toggles fullscreen.
  - `npm run dev:web` still opens it in a browser tab if you need one.
- **New flow:** title → Form 1-A → hiring day → hub with Newsroom / Layout / Staff tabs. F1/F2/F3 switch tabs. Details are in `docs/DESIGN_CHANGES.md`.
- **Setup:** paper kind, seven coverage sliders (including Science & Tech and World & National), frequency, stance, live proof, and an APPROVED stamp.
- **Hiring:** pick 2–4 reporters within an origin-based payroll budget, and set each one's beat, patch, style, workload and training.
- **Newsroom:**
  - Reporters file automatically from their assignments, most important stories first.
  - You can commission uncovered stories or run wire copy.
  - Star, pick for print, change the angle or spike any article.
  - The backlog carries over and goes stale; storylines supersede old pieces.
- **Scorecard:** shown readership, heat, trust and sensational flag; correction risk and award chance stay hidden until printed.
- **Staff tab:**
  - Full assignment editor, morale and record for each reporter.
  - Release with severance.
  - A market where candidates show attribute ranges until you check references ($50). Hiring has a signing fee, and hires start the next issue.
- **Layout** now uses only articles picked for print. Fit compares the block with the article's length.
- **Between issues:** placed articles are published, payroll is paid, ad money comes in, training and morale apply, queued assignments take effect, and reporters file again.
- **Data:**
  - 6 fictional Science & Tech stories, a `science_tech` desk, and two reporters (Amara Osei, Felix Moreau).
  - Reader groups got a `science` interest.
  - Left and right story leans are still balanced; there's a test for it.
- **Tests:** 71 passing. New: filing and commissions, backlog and staleness, staff (scouting, hiring, assignment queue, training, morale), scorecard (including a left/right mirror test), and data balance.

**Small decisions**
- Every reporter can always file their first piece of an issue, however long. Capacity only limits extra pieces. Without this, Rosa Okafor couldn't file the day's biggest City Hall story.
- Assignment changes wait until the next issue. Commissions are the way to react in the same issue.
- Only one active article per story. Two reporters never file the same story.
- Released reporters' unpublished work is spiked.
- Readers and trust in the header are still the origin's starting values until the simulation milestone.
- Letters to the editor (milestone 6) may be AI-written but are flagged for review (`docs/AI_CONTENT_REVIEW.md`).

**What's next:** the summarizer milestone (prompt, cache, `npm run summarize`, cost report, fact check, Summarizer lab). Then the simulation: sales, trust, lean, rival, plus results revealing the hidden scorecard lines and save/load.

## 2026-10-23 · Milestones 1 + 2: skeleton and paste-up layout

**What changed**
- Project setup: Vite 8, React 19, TypeScript 6.0, Zustand 5, Zod 4, Vitest 5, ESLint 10. Fonts are bundled through `@fontsource`. Palette and fonts live only in `src/theme/tokens.ts` and reach CSS as `--c-*` / `--f-*` variables.
- Data loading validates all three JSON files with Zod. Stories come through the `StorySource` interface and article text through `ArticleSource` (template fallback for now; the cache is added in M3).
- The game runs on a fixed 1440x900 stage scaled to fit the window.
- Screens: title (first pass), editor, press run, end-of-demo, a lab stub. The dev jump menu opens with the backtick key.
- **Paste-up layout (decision B):**
  - Each page is a 6-column × 20-inch grid with a fold line on the front. Front and A2 always run; A3 is optional and costs $0.06 per copy.
  - Stories are lead, secondary or brief blocks. Each tier has size limits and headline space, and only the remaining area counts as text inches.
  - Fit labels compare text inches with the story's `base_column_inches`: cut hard, trimmed, fits, padded.
  - Prominence follows spec 6.1. A block counts as above the fold if its top row is.
  - Ads are fixed-size blocks from the ad desk. Front-page ads pay ×1.25.
- **Drag and drop** is hand-rolled (`src/components/drag/drag.ts`):
  - Over the page, the held story snaps into its exact grid footprint, orange when it fits and red with the reason when it doesn't. Off the page it's a tilted slip.
  - Keys 1/2/3 switch tier mid-drag. Dropping on the wire takes an item off the page. The orange corner resizes. Arrows nudge, shift+arrows resize, Del removes, Ctrl+Z / Ctrl+Shift+Z undo and redo.
- **Reporters:**
  - Each reporter has 1–20 attributes: speed, accuracy, impact, charge, flair, tact. I added these to `staff_pool` in `districts.philly.json` with placeholder values matched to each voice.
  - Speed sets column inches filed per issue. The inspector shows the load and flags anyone over capacity.
  - A newly placed story goes to the on-desk reporter if they have room, otherwise it runs as wire copy. Wire copy has no byline and can only run Straight.
- Angle buttons enforce "no Puff on sensitive stories".
- Tests (39): data validation, layout rules, calendar and starting staff, the template fallback using only facts, and boundary tests (no Anthropic SDK in `src/`, no UI imports in `sim/`, `summarizer/` or `data/`).

**Small decisions (please flag any you disagree with)**
- I used custom drag code, not dnd-kit. Its coordinates are wrong under a CSS-scaled stage, and we need grid snapping plus resizing.
- I used TypeScript 6.0, not 7, because `typescript-eslint` doesn't support 7 yet.
- Grid: 1 row = 1 inch. Headline space is 3 rows for a lead, 1.5 for a secondary and 1 for a brief.
- A placed story is never auto-assigned to an off-desk reporter. Stretching someone off their desk or over capacity is the player's call.
- Day 1 is Wednesday, Oct 21, 2026, to match the wire text.
- Wire headlines are long, so lead headlines shrink to fit. The summarizer (M3) will get headline word limits per tier.
- Circulation and trust in the header are the origin's starting values until M4.
- Weekly frequency is wired up (one issue drawing on all 24 stories) but can't be picked until the setup form exists (M5).

**Interpretations to confirm before M4**
- *Coverage split:* "changes how far the paper spreads and so the money and coverage". My plan: districts whose reader groups like your heavy categories start with more readers and newsstand reach, and the split sets which desks you staff.
- *Article scorecard:* computed from the story (importance, lean, sensitivity, fit, prominence) plus the reporter's attributes. Some lines are shown as ratings (readership, political heat). Others stay hidden until after printing (award chance, correction risk), like scouting reports.

**What's next:** M3, the summarizer: prompt, cache, `npm run summarize`, cost report, fact check, the real Summarizer lab.
