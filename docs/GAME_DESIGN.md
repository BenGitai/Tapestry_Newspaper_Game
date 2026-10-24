<!-- Placeholder game name: Tapestry Newspaper Game (formerly "Above the Fold"). -->
# Tapestry Newspaper Game — Demo Design Spec (v0.1)

Working title. Tapestry Games. Everything here is a starting point for a playable demo; art, writing and balance get redone once the team is assembled.

## 1. Pitch

You run a print newspaper in a real city. Every issue you choose which stories run, where they go on the page, who writes them and with what angle. Placement is the core mechanic: the front page above the fold says "this matters," a brief on page 6 says "we covered it, technically." Your readers, advertisers, City Hall and a rival paper all react to what you print. In the full game the stories come from real current news, so players learn what's actually happening while they play.

## 2. Demo goals

The demo exists to answer three questions:

1. **Is laying out the paper fun?** Dragging stories onto a page with limited space, a fold line and ads has to feel good on its own.
2. **Does the AI summarizer work?** Can a cheap model turn wire facts into short in-game articles in a journalist's voice and a chosen angle, without inventing facts, at the cost we estimated (about $2–5/month at full scale)?
3. **Do the systems create interesting decisions?** Reader groups, trust, perceived political lean, ad money and a rival should pull in different directions.

## 3. Demo scope

**In scope**
- One city: Philadelphia. Other cities appear on the setup form but are greyed out ("coming soon").
- A fixed set of 24 fictional wire stories across 4 days (`data/stories.philly.json`). No live news feed yet.
- Daily frequency fully playable (4 issues). Weekly is optional: one issue pulling from all 4 days.
- Print only. There are no digital articles in this game.
- Placeholder art only: labelled boxes, simple shapes, halftone patterns drawn in code.

**Out of scope for the demo**
- Live news APIs (GDELT, aggregators). Design the data layer so a live source can replace the JSON file later.
- Save/load beyond a simple local save. Steam packaging. Sound. Multiple cities.

## 4. Core loop (one issue)

1. **Morning wire.** New stories arrive on the wire panel. Each is a wire slip with a source credit, time filed, category and a "Read the real story" link (placeholder in the demo).
2. **Assign.** Pick stories, assign a journalist and an angle (Puff / Straight / Hard-hitting). The summarizer produces the in-game article: headline, deck and body sized to the slot.
3. **Lay out.** Drag stories into slots on the front page and inside pages. Slots have sizes in column inches. Ads take space and pay money. The fold line splits the front page.
4. **Preview.** The side panel shows projected reactions per reader group, advertiser and City Hall before you commit.
5. **Send to press.** The issue is printed. Show the finished front page as a full-screen newspaper.
6. **Results.** Sales by district, trust and lean changes, ad revenue, letters to the editor, what the rival paper led with, and any consequences (an advertiser pulls out, a source stops talking).
7. Next day.

## 5. Screens

Visual reference for screens 1–4 is in `reference/mockups/` (screenshots plus the original mockup HTML). Follow the look closely, but the layouts can change where gameplay needs it.

1. **Title screen.** A newspaper lying on a desk. Menu options are headlines: New game is the lead story, Continue and Load are side headlines, Settings/Credits/Quit are classified ads. A strip shows "off the wire today" headlines. A press pass shows the Tapestry Games logo.
2. **New game setup.** A registration form ("Form 1-A") on the desk:
   1. Paper name (live preview on a proof of the masthead)
   2. City (Philadelphia only; others greyed out)
   3. Origin: Founded it / Inherited a family paper / Bought a dying paper
   4. Frequency: Daily / Weekly / Monthly (monthly greyed out in the demo)
   5. Coverage split: sliders for Politics, Economy, Social, Sports, Culture, shown as percentages
   6. Stated editorial stance: Left / Center-left / Neutral / Center-right / Right
   - A Quick start button, and an "APPROVED" rubber stamp you click to begin.
3. **Front page editor** (the main screen). Wire panel on the left with filters, the paste-up board in the middle with page tabs (Front, A2, A3), and an inspector on the right for the selected story (journalist, angle, projected reactions, letters). "Send to press" button.
4. **City map.** Philadelphia's districts as a stylized map (not a real street map). Layers: Readership (halftone dot density), Trust, Perceived lean, Income, Rival share. Story pins show where today's stories happen. Clicking a district shows its panel: population share, your share, trust, what they want to read, and actions (add newsstands, open a bureau).
5. **Press run / results.** The printed front page full screen, then a results sheet.
6. **Staff.** List of journalists with desk, skill, voice and salary. Hire from a small pool.
7. **Archive.** Every front page you've printed, browsable. In the full game this doubles as a record of real news during your playthrough.
8. **Summarizer lab** (dev tool, not part of the game). Pick any story, see the output for all three angles side by side, the input sent to the model, token counts, cost, and the fact-check result.

## 6. Systems

All numbers are first-pass placeholders. Keep every tunable value in one config file (`src/sim/balance.ts` or equivalent) so the team can tweak without touching logic.

### 6.1 Page layout
- Front page: a grid of slots (one lead, two or three secondary, briefs, one ad slot). Inside pages: more slots, more ads.
- Every story has a base length in column inches. Slot size determines article length (lead ~120 words, secondary ~60, brief ~25).
- **Prominence** multiplies a story's effect: front above the fold 1.0, front below the fold 0.6, inside page 0.3, brief 0.15. Unplaced stories have zero effect, but leaving out a big story has its own cost (see 6.4).
- Ads: each ad slot filled pays money. More ads = more money and less room for news.

### 6.2 Readers
- The city is split into districts (`data/districts.philly.json`). Each district has a population share and a mix of reader groups.
- Each reader group has interest weights per category, a political lean, a preference for hard news vs. light news, and price sensitivity.
- After each issue, each group's satisfaction is computed from the stories it saw, weighted by prominence, interest and how well the angle matched its taste. Satisfaction moves circulation in each district.
- Stories tagged with a district matter more to readers in that district.

### 6.3 Trust
- A 0–100 score per district.
- Hard-hitting coverage of important stories raises trust over time. Puff on serious stories lowers it. Sensational treatment of sensitive stories (6.6) lowers it a lot.
- Trust scales how much circulation you keep when readers are unhappy.

### 6.4 Perceived political lean
- The stance chosen at setup is only your starting reputation.
- Each story can carry a lean signal depending on the angle (some stories have none). What you print, and what you leave out, moves perceived lean over time.
- Leaving out a story that most papers would run counts as a signal too ("the Ledger ignored the strike").
- Keep this symmetric. No side is treated as correct. Lean only changes which readers trust you more or less and how officials and advertisers react.

### 6.5 Money
- Revenue: copies sold × price + ads. Costs: printing per copy, salaries, distribution per district, bureaus.
- Advertisers have sensitivities. A hard-hitting story about a company or a sector can make related advertisers pull out. City Hall buys ads and gets annoyed by critical coverage.
- Origin sets starting conditions:
  - Founded it: low cash, no readers, no debt, no baggage.
  - Inherited: loyal, older readers, high trust, outdated habits (higher costs), modest cash.
  - Bought a dying paper: known name, existing readers in decline, big debt, low morale.

### 6.6 Sensitive stories
- Some stories are flagged `sensitivity: "high"` (deaths, tragedies). They can't take the Puff angle. Sensational placement and framing cost trust. Responsible, prominent coverage is the "correct" move but doesn't sell as well.
- The summarizer uses a stricter prompt for these stories (6.8).

### 6.7 Rival paper
- One rival, the *Philadelphia Herald* (fictional), with its own stance and strong districts. Each day it picks its own front page from the same wire using a simple rule-based AI.
- The results screen shows the rival's front page next to yours. Scooping the rival on a story gives a bonus.
- Light internet pressure: occasional notes like "Online outlets had this six hours ago" on stale stories, plus a slow, small decline in the print reader pool. The internet is a pressure, never something the player publishes to.

### 6.8 Journalists
- Each has a desk (City Hall, Business, Neighborhoods, Sports, Culture), a skill (1–5), a short voice description used by the summarizer, and a salary.
- Assigning a reporter outside their desk lowers quality. Low skill means a chance of a correction the next day (a trust hit).
- Start with three reporters depending on coverage split and origin. A small hiring pool of four more.

## 7. AI summarizer

This is a tool that turns wire facts into in-game article text. It does not invent stories, people, quotes or numbers.

### 7.1 Input
- The story's `facts` list and `wire_text` from the data file. In the full game this will be headlines, snippets and facts gathered from several licensed sources. It must never be the full text of a copyrighted article.
- Journalist name and voice description.
- Angle: Puff, Straight or Hard-hitting.
- Target length (from slot size) and whether it needs a headline and deck.
- The paper's name and stated stance (light influence on framing only).

### 7.2 Output (JSON)
```json
{ "headline": "...", "deck": "...", "body": "...", "facts_used": [0, 2, 3] }
```

### 7.3 Rules for the prompt
- Use only the facts given. No invented quotes, names, numbers, dates or events. If a fact is uncertain in the input, keep it uncertain.
- The angle changes emphasis, word choice and which facts lead. It never changes the facts.
- Sensitive stories: plain, respectful tone, no speculation about victims, no sensational language, regardless of angle.
- Write as a newspaper of the paper's name. No mention of AI.

### 7.4 Architecture
- **Generate once, share with everyone.** Articles are generated on a server (in the demo, a build script or local dev server) and cached. Players never call the model directly, and the API key is never shipped to the client.
- Cache key: story id + journalist id + angle + length tier.
- `npm run summarize` (or equivalent) pre-generates every combination for the 24 stories and writes them to a cache file that the game loads. The demo must also run with no API key at all, using the cache, or a simple template fallback if a combination is missing.
- Optional: a dev-only endpoint that generates on a cache miss when `ANTHROPIC_API_KEY` is set.

### 7.5 Model and cost
- Default model: `claude-haiku-5-5` (configurable). Published price for prompts up to 100K tokens: $0.10 per million input tokens and $0.50 per million output tokens. Recheck before relying on it.
- Log input and output tokens per call. The summarize script prints a total cost report and an extrapolation to "200 stories/day for 30 days" so we can compare against our ~$2–5/month estimate.

### 7.6 Checks
- Automatic fact check: every number and capitalized name in the output must appear in the input facts or wire text. Flag failures in the summarizer lab and the cost report.
- Summarizer lab screen (section 5) for reviewing outputs by eye.

## 8. Visual direction

Letterpress / print shop on an editor's desk. Physical materials, not app UI.

- Palette: ink `#1C1B18`, newsprint `#F1EAD7` / `#F4EEDC`, aged paper `#ECE5D3`, paste-up board `#D8CDB3`, desk `#2B2520`, rust `#9A4413`, tiger orange `#E08A2E` (highlight / selection, taken from the Tapestry logo), stamp red `#E35F3E`, positive green `#2F6B3A`.
- Type: Old Standard TT (mastheads, headlines), Libre Caslon Text (body), IBM Plex Mono (labels, wire slips, numbers). All on Google Fonts; bundle them locally.
- Halftone dot patterns for shading and map density. Double rules, column rules, slight rotation on papers lying on the desk.
- Hard no: gradients, glassmorphism, drop-shadow cards, neon, emoji, rounded "SaaS" panels, stock AI-looking illustration. Placeholder images are labelled boxes or simple halftone shapes drawn in code.

## 9. Content and legal notes

- All 24 demo stories are fictional. Real Philadelphia neighborhoods, landmarks and teams are used for flavor, but every event, person and quote is invented. No real people. Mark the demo as fiction on the title screen.
- Wire sources in the demo are fictional ("Keystone Wire", "Delaware Valley Press Service").
- "Read the real story" links are placeholders. In the full game they point to the original coverage.
- Tapestry's AI policy: AI is used as a development tool, not for creative work. The summarizer counts as tooling. Placeholder stories and art will be replaced by the team's own work.

## 10. Suggested milestones

1. **Skeleton.** Project setup, data loading, game state, screen navigation, fonts and palette.
2. **Layout mechanic.** Front page editor with drag and drop, slots, fold line, ads, page tabs. Make this feel good before anything else.
3. **Summarizer.** Prompt, cache, pre-generation script, cost report, fact check, summarizer lab.
4. **Simulation.** Readers, trust, lean, money, results screen. Balance values in one config file.
5. **Map, title screen, setup form.**
6. **Rival, staff, archive, letters, sensitive-story handling, internet pressure.**
7. **Polish pass** on the print look and a short playtest checklist.
