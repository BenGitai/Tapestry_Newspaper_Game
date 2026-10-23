# Devlog

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
