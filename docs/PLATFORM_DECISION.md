# Platform decision

Status: **approved 2026-10-23**, with the answers below. The original proposal follows unchanged for reference.

## Approved decisions (2026-10-23)

- **Stack:** TypeScript/React approved, shipped as a **desktop app from now on** (update, same day: "not a web game"). **Electron 44** wraps it today; electron-builder packages it. Steam integration comes later from the Electron main process.
- **Added to scope:** local save/load, end-of-demo screen, symmetry mirror test, headless runner (`npm run simulate`).
- **Letters to the editor:** may be AI-generated for now, but **flagged internally for later review**. Every AI-written letter and the code that produces it carries the marker `AI-CONTENT-REVIEW`, and `docs/AI_CONTENT_REVIEW.md` lists them.
- **Q1 layout:** **B, snap-grid paste-up.** Space is a management resource.
- **Q2 reporters:** each reporter has their own **attributes** (FM-style 1–20): how fast they write, how impactful, how politically charged, how accurate, and more. Different strengths and weaknesses are a core focus of the game.
- **Q3 clock:** **no real-time timer.** The game shouldn't be stressful.
- **Q4 cost:** only the demo's cost matters for now.
- **Q5 coverage split:** changes how far the paper spreads, and with it the money and coverage available. **Sensational** stories get stronger reactions in both directions: more likely to win awards, more likely to lose readers. **Frequency** (daily/weekly/monthly) changes how many stories come through per issue.
- **New: article scorecard.** Each article gets a half-shown, half-hidden scouting-style rating of how likely it is to cause certain effects (readership, political heat, trust, awards, corrections), like player ratings in a football manager. It's built partly from the story's content and partly from the journalist's attributes.
- **Small decisions** (end of this doc) approved. Make the project a git repo.
- **Tooling change from the proposal:** `typescript-eslint` doesn't support TS 7 yet (peer range `<6.1`), so we use **TypeScript 6.0.x**.
Written 2026-10-23 after reading `CLAUDE.md`, `docs/GAME_DESIGN.md`, `docs/PLATFORM_NOTES.md`, all three data files, the mockups (PNGs and `.dc.html`) and Anthropic's current SDK and pricing docs.

---

## 1. Verdict: keep the web stack

I agree with `PLATFORM_NOTES.md`: **TypeScript + React + Vite**, with the simulation in plain TypeScript, and a desktop wrapper added later for Steam.

Why it fits this game:

- **The core mechanic is typography.** Headlines that wrap, justified columns, decks, bylines, "Cont. A4" jumps and text that has to fit a slot. In a browser that's CSS (`column-count`, `hyphens`, `text-wrap: balance`, overflow measurement). In Godot you'd have to rebuild it on top of `RichTextLabel`, which has no multi-column flow and weaker kerning and hyphenation. Unity's TextMeshPro is better but still not a page-layout engine.
- **The mockups are already HTML/CSS.** Spacing, rules, fonts and the slight paper rotation can be carried over almost directly.
- **One language end to end.** The summarizer script, the dev-server endpoint, the future live news pipeline and the game all use TypeScript, and the prompt builder and fact check can be shared between server and client tests.
- **The simulation is easy to test.** Plain TS functions plus Vitest, and a headless runner (section 4) can play hundreds of games for balance work.
- **The demo can be shared as a link.** That's useful for a student team doing playtests before anything goes on Steam.

What we give up, and how to cover it:

| Gap | Mitigation |
|---|---|
| Less built-in "game feel" tooling | Paper lift, snapping and the stamp thud are CSS transforms plus short JS-driven springs. That's enough for paper on a desk. If we later want particles or a 3D desk, revisit Godot as the notes say. |
| Steam needs a native wrapper | See 1.1. Keep the app shell-agnostic: no Node APIs in `src/`, saves behind an interface. |
| Browsers aren't game engines | At 1440x900 with a few dozen DOM nodes per page there's no performance risk. The map is under 10 SVG polygons. |

### 1.1 Electron or Tauri (decide at packaging time, leaning Electron)

Nothing in milestones 1–7 depends on this choice. For when we get there, I lean **Electron**:

- **Same renderer on every platform.** Electron ships Chromium. Tauri uses the OS webview: WebView2 on Windows, WebKit on macOS, **WebKitGTK on Linux/Steam Deck**. Typography and CSS-column rendering would differ between them, and WebKitGTK is the weakest of the three. Steam Deck is a real target for a game like this.
- **Steam integration.** There are working Node bindings for Steamworks (`steamworks.js`, though it was last released in 2024, so we should check again at packaging time). Tauri would go through Rust (`steamworks-rs`), which is fine but adds a second language.
- **Cost of Electron:** a download of roughly 150 MB instead of roughly 10 MB. That barely matters on Steam.

### 1.2 Where the summarizer runs

- **Demo:** `npm run summarize` (Node) writes `data/generated/summaries.cache.json`, which is committed so the game works without a key. An optional Vite dev-server middleware generates on a cache miss when `ANTHROPIC_API_KEY` is set. It's dev only and isn't included in the build.
- **Full game (later):** a small hosted service runs "generate once, share with everyone". The client only ever fetches article text through an `ArticleSource` interface. In the demo that interface is backed by the cache file plus template fallbacks, and later it switches to HTTP. The API key never leaves the server in either case.
- **Enforcement:** the Anthropic SDK is imported only under `server/` and `scripts/`. A test fails if anything under `src/` imports it. The key is never given a `VITE_` prefix, so Vite won't put it in the bundle.

---

## 2. Libraries and versions

Checked against npm on 2026-10-23. I'll pin exact versions in `package-lock.json` and use caret ranges inside the current major.

| Purpose | Package | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | 24.x LTS | You have 24.16.0 |
| Language | `typescript` | 7.0.x (7.0.2) | Native compiler, used for type checking only. Vite transpiles. |
| UI | `react`, `react-dom` | 19.3.x | |
| Build/dev | `vite` | 8.3.x | |
| | `@vitejs/plugin-react` | 6.1.x | |
| Drag and drop | `@dnd-kit/core` | 6.3.1 | Stable, with pointer and keyboard sensors and custom collision detection. `@dnd-kit/react` (0.5) is the successor but still pre-1.0. I'll draw the dragged paper ourselves in a `DragOverlay` so we fully control the feel. |
| State | `zustand` | 5.0.x | Holds the store only. All rules live in `src/sim`. |
| Validation | `zod` | 4.x | Validates the data JSON at load time and the model's JSON output. The SDK's `zodOutputFormat` helper uses it too. |
| Summarizer | `@anthropic-ai/sdk` | 1.2.x | Server and scripts only. 1.2.0 shipped today, so I'll reread the SDK README before writing M3. |
| Script runner | `tsx` | 4.23.x | Runs `scripts/*.ts`. |
| Env | Node `--env-file-if-exists=.env` | built in | No `dotenv` needed. |
| Tests | `vitest` | 5.0.x | Sim, layout rules, fact check, prompt builder. |
| Component tests | `@testing-library/react` 16.3.x + `jsdom` 30.x | | Used sparingly, mostly for drag/drop state transitions. |
| Fonts | `@fontsource/old-standard-tt`, `@fontsource/libre-caslon-text`, `@fontsource/ibm-plex-mono` | 5.3.0 | Fonts are bundled into the build and nothing loads from Google at runtime. All are OFL-licensed, and I'll put the license texts in `docs/` for Steam. |
| Map, halftone | plain SVG | none | Halftone is an SVG `<pattern>` with dot radius driven by a value. |
| Lint | `eslint` 9 + `typescript-eslint` | latest at setup | Includes a `no-restricted-imports` rule to keep the SDK out of `src/` and React out of `src/sim/`. |

Left out on purpose: React Router (screens are a small state machine in the store), CSS frameworks (Tailwind would push us toward the "app" look; we use CSS modules plus theme tokens), animation libraries (we can add `motion` later if CSS isn't enough), and Electron/Tauri (not until packaging).

### Model settings (verified against Anthropic's current docs)

- Model: `claude-haiku-5-5`, set in one place: `src/summarizer/config.ts`, overridable with `SUMMARIZER_MODEL`.
- Price: **$0.10 per million input tokens and $0.50 per million output tokens for prompts up to 100K tokens** ($0.50 / $2.50 above that, which we'll never hit). This matches the spec. Prices also live in `config.ts`, and the cost report prints which prices it used.
- Things that changed recently and affect our code:
  - Haiku 5.5 has adaptive thinking **on by default**, and thinking tokens are billed as output. For short, constrained rewrites I'll send `thinking: {type: "disabled"}` with `effort: "low"` (disabling is allowed at effort `high` or below), then compare quality against `low` with thinking on in the lab.
  - `temperature` and `top_p` are now rejected (400) on every model, so we won't send them.
  - Assistant prefill is rejected, so the JSON output comes from structured outputs (`output_config.format` with a Zod schema via `client.messages.parse`).
  - Refusals come back as `stop_reason: "refusal"` with no server-side fallback on Haiku, so the script logs them and the game falls back to the template.
- The **Message Batches API** is 50% cheaper. `npm run summarize --batch` can use it for the full pre-generation run, and the default stays plain calls so output is immediate.

---

## 3. Folder structure

```
tapestry-newspaper-game/
├─ CLAUDE.md
├─ .env                      (gitignored: ANTHROPIC_API_KEY)
├─ .env.example
├─ data/
│  ├─ stories.philly.json    (existing)
│  ├─ districts.philly.json  (existing)
│  ├─ cities.json            (existing)
│  ├─ letters.templates.json (hand-written letter templates, M6)
│  └─ generated/
│     ├─ summaries.cache.json   (committed so the demo runs with no key)
│     └─ cost-report.json
├─ docs/  GAME_DESIGN.md  PLATFORM_NOTES.md  PLATFORM_DECISION.md  DEVLOG.md  PLAYTEST.md
├─ reference/                (existing, read only)
├─ scripts/
│  ├─ summarize.ts           (npm run summarize: pre-generate and print the cost report)
│  └─ simulate.ts            (npm run simulate: headless strategy runs for balance)
├─ server/                   (Node only, the only place the Anthropic SDK is imported)
│  ├─ anthropicClient.ts
│  ├─ generateArticle.ts     (one call: prompt, parse, fact check, usage)
│  └─ devMiddleware.ts       (Vite plugin: /api/article on a cache miss, dev only)
├─ src/
│  ├─ main.tsx  App.tsx
│  ├─ theme/                 (palette, font stacks, spacing; the only place colors are defined)
│  │  ├─ tokens.ts
│  │  └─ global.css          (CSS custom properties generated from tokens, @font-face)
│  ├─ data/                  (loaders behind interfaces)
│  │  ├─ schemas.ts          (zod schemas for all JSON)
│  │  ├─ StorySource.ts      (interface; JsonStorySource now, a live source later)
│  │  ├─ ArticleSource.ts    (interface; cache file, then dev endpoint, then template fallback)
│  │  └─ worldData.ts
│  ├─ sim/                   (plain TS, no React or DOM imports)
│  │  ├─ balance.ts          (every tunable number, commented)
│  │  ├─ types.ts  rng.ts    (seeded RNG so runs are reproducible)
│  │  ├─ layout.ts           (page grid, slots, fit, prominence)
│  │  ├─ readers.ts  trust.ts  lean.ts  money.ts  rival.ts  staff.ts
│  │  ├─ issue.ts            (resolveIssue(state, draft) -> results; also used for preview)
│  │  └─ *.test.ts
│  ├─ summarizer/            (pure TS, safe to share with the client)
│  │  ├─ config.ts           (model id, prices, length tiers)
│  │  ├─ prompt.ts           (normal and sensitive prompt variants)
│  │  ├─ factCheck.ts        (+ factCheck.test.ts)
│  │  ├─ cacheKey.ts
│  │  ├─ templates.ts        (no-key fallback built only from facts)
│  │  └─ outputSchema.ts
│  ├─ state/  store.ts  save.ts      (Zustand store; localStorage save behind an interface)
│  ├─ components/
│  │  ├─ desk/   Desk, PaperSheet, WireSlip, Memo, Stamp, Corkboard
│  │  └─ paper/  Masthead, Headline, ColumnText, Rule, Halftone, PhotoBox, AdBox
│  └─ screens/
│     Title  Setup  Editor  CityMap  PressRun  Results  Staff  Archive  SummarizerLab
└─ tests/
   └─ boundaries.test.ts     (no SDK imports in src/, no React in src/sim/)
```

---

## 4. Milestone plan

Each milestone ends with: `npm run dev` working, `npm test` passing, `docs/DEVLOG.md` updated, a short summary for you, and a git commit. The folder isn't a git repo yet, so M1 starts with `git init`, a `.gitignore` that covers `.env`, and an initial commit of the kit as it is.

**M1 Skeleton**
- Vite + React + TS, ESLint, Vitest, the boundary tests.
- Theme tokens and bundled fonts. A desk background and a `PaperSheet` component (rotation, double rules) to check the look early.
- Zod-validated loaders for all three data files, so bad data fails loudly at startup.
- Game state, a screen state machine, and a dev-only "jump to screen / day" menu.
- A fixed 1440x900 logical stage scaled to fit the window. The mockups are 16:10, which also matches Steam Deck's 1280x800.

**M2 Layout mechanic (the most important milestone)**
- Wire panel with wire slips and filters, the paste-up board with Front/A2/A3 tabs, and the fold line.
- Drag from the wire to the page and between slots, swap, drag back to the wire to unplace, and keyboard drag.
- Ads as placeable blocks that show their pay. Live column-inch accounting.
- Article text comes from the template fallback, so layout is testable before the summarizer exists.
- Feel work: lift and tilt on pickup, snap preview, a fit warning ("runs 3 in. long: cut to brief?"), undo, and auto "Cont. A2" jumps.
- Pure `layout.ts` rules with tests. Prominence comes straight from placement.
- I'll stop here for you to play it before going further.

**M3 Summarizer**
- Prompt (normal and sensitive variants), output schema, cache, and the template fallback.
- `npm run summarize` with flags `--story`, `--force`, `--batch` and `--dry-run` (estimates cost without calling the model).
- Cost report with token counts per call, totals, the 200 stories × 30 days extrapolation (see Q4) and fact-check failures.
- Dev middleware for generate-on-miss.
- **Summarizer lab:** story picker, the three angles side by side, the exact prompt sent, tokens, cost and fact-check highlights. You can also switch journalist and length tier.

**M4 Simulation**
- Readers, trust, lean, money and `resolveIssue`. The inspector's projected reactions run the same function on the draft page, so the preview and the results always agree.
- A results screen with sales by district, deltas and ad money.
- Balance values in `balance.ts`.
- **Symmetry test:** mirror every lean sign, stance and district lean mix, then assert that the results are mirrored exactly.
- `npm run simulate` runs fixed strategies (all Puff, all Hard-hitting, lean left, lean right, chase ads, ignore big stories) so we can see whether the systems actually pull against each other.

**M5 Map, title screen, setup form**
- SVG map with the five layers and the district panel (newsstands and bureaus).
- Title screen with a "this is fiction" notice.
- Form 1-A setup with the stamp and Quick start.

**M6 Rival, staff, archive, letters, sensitive stories, internet pressure**
- The rival's front page from its stated rule, and scoop bonuses.
- Hiring, corrections and the archive.
- Letters to the editor.
- Sensitive-story rules, stale-story notes and the slow print-pool decline.

**M7 Polish and `docs/PLAYTEST.md`**

**Things missing from section 10 that I'd add:**
- **Local save/load.** It's in scope in section 3 but not assigned to a milestone. I'd put a single autosave slot in M4, with Continue/Load wired up in M5.
- **End of demo.** After issue 4: a summary sheet plus a "thanks for playing / feedback" page.
- **Settings.** Text size at minimum, since the title screen mockup promises it. Goes in M5.
- **Letters to the editor are creative writing.** Tapestry's AI policy covers the summarizer as tooling only, so I'd build letters from hand-written placeholder templates filled from game state, with no model involved. Tell me if you'd rather extend the policy.
- **Headless balance runner** (`npm run simulate`). Without it, question 3 of the demo goals ("do the systems create interesting decisions?") gets answered by feel alone.
- **Seeded RNG** so a reported bug or playtest can be replayed.

**Risks:**
1. **Layout feel** is the demo's main question and the hardest to get right on paper. Mitigation: M2 is time-boxed for iteration, and you play it before M3.
2. **Text fit.** Model output varies in length. I'll set word targets per tier, measure overflow in the DOM, and clip with a jump line instead of overflowing. The model is asked for a word range, and the fact check also flags length.
3. **Fact-check false positives.** "Every capitalized name must appear in the input" catches sentence-initial words ("Officials"), the paper's own name, the byline, "Philadelphia", days of the week, and numbers written differently ("1,000" vs "1000", "four" vs "4", "$1.3 million"). Plan: normalize numbers, allowlist names that come from game data (paper, journalist, city, districts and neighborhoods from the data files), and ignore sentence-initial common words. All of it gets tests. It will still produce some false flags, so the lab shows each flag next to its source text so you can judge.
4. **Balance.** Six reader groups × eight districts × lean × trust gives many knobs. The headless runner and the symmetry test keep this manageable.
5. **Scope.** Eight screens and six systems is a lot for a demo. If time runs short, cut weekly mode, bureaus and the archive's detail view first.

---

## 5. Questions that change how I build it

**Q1. How does a story fill space? (decides M2, the most important one)**
The data gives each story `base_column_inches` (6–14). The mockup shows slots with capacities ("4 col. in. free"). The spec gives word counts per slot type (lead 120, secondary 60, brief 25). These don't quite line up: 14 column inches is roughly 400 words of real newsprint. Two options:
- **A. Fixed slot templates** (what the spec literally describes). Each page has preset slots: lead, secondaries, briefs and ad. You drop any story into any slot, and the slot sets the length tier. `base_column_inches` only drives a penalty when a big story is crammed into a small slot. Fast to build and easy to read, but the puzzle is mostly "which story goes where".
- **B. Snap-grid paste-up.** Each page is a 6-column grid with the fold as a row. A story is a block you can set to lead, secondary or brief shape, each with a column-inch footprint. Ads are fixed blocks you choose whether to place. Space is the real constraint: you can't fit everything, and an extra ad pushes a story inside.

**My recommendation is B.** It's closer to real paste-up and is the more likely answer to "is laying out fun?". It still maps to the same three length tiers, so the summarizer doesn't change. It's about 1.5× the work of A in M2. I can build B with a couple of preset arrangements as a quick-fill. Which do you want?

**Q2. How many stories can a reporter file per issue, and what happens to stories with no reporter?**
There are three starting reporters and six stories a day, sometimes three pages of slots. My proposal: each reporter files up to 2 stories per issue, and any story placed without a reporter runs as **wire copy** (Straight angle only, wire source credited, no voice, a small quality penalty, cheap). This also adds a cache variant ("wire" in place of a journalist).

**Q3. Is the press deadline real time?**
The editor mockup shows "Press deadline 3h 20m", but the spec never mentions a clock. Options: none, an in-game clock that advances with actions (each assignment costs an hour), or a real-time timer. I recommend **the action-based clock**. It adds pressure without making a typography game twitchy. It could also make stories filed later in the day arrive mid-session.

**Q4. What does the ~$2–5/month estimate assume?** This decides the cache key for the full game. My numbers at ~1,100 input and ~200 output tokens per call, thinking off, current Haiku 5.5 prices:

| Scenario (6,000 stories/month) | Calls/month | Cost/month |
|---|---|---|
| Pre-generate every combo: 7 journalists × 3 angles × 3 tiers | 378,000 | about $79 |
| Pre-generate story × angle × tier, no journalist voice | 54,000 | about $11 |
| One call per story × angle returning all 3 lengths | 18,000 | about $6 |
| **Generate on demand, shared by everyone** (~1–3 distinct picks per story) | 6,000–18,000 | **about $1.30–$3.80** |

The demo's full pre-generation (70 story-angles, since the two sensitive stories can't be Puff, × 7 journalists × 3 tiers = 1,470 calls) costs roughly **$0.30**, or $0.15 with the Batch API, so the demo is fine either way. For the full game, the estimate only holds with on-demand, shared generation, or if voice is applied at a coarser level (per desk or per paper). For the demo I'll keep the spec's key (story + journalist + angle + tier), and the cost report will print all four scenarios. Is that the right framing?

**Q5. What does the coverage split do?**
The spec only says it picks the starting reporters. Proposal: it picks 3 of the 4 `starting_candidate` reporters by your top desks (the fourth joins the hiring pool, which makes the "four more" in the spec work out), it sets the wire panel's default sort, and it sets readers' starting expectations, so a sports-heavy paper's readers are disappointed by a page with no sports. Is that last part wanted, or should it be cosmetic beyond staffing?

**Q6. What counts as "sensational" treatment of a sensitive story?**
Puff is blocked and the prompt stays respectful whatever the angle. Proposal: a sensitive story is "sensational" if it runs Hard-hitting with a reporter whose voice is flagged as dramatic (Walt Brenner), **or** as a lead next to an ad. In both cases trust drops sharply. Hard-hitting otherwise means accountability framing (for example, the smoke detectors in the fire story) and is fine. Does that match your intent?

**Q7. Weekly mode: build it in the demo or leave it?**
The spec marks it optional. I'd leave the button visible but greyed out like monthly, and build it only if time remains after M6.

### Small decisions I'll make myself and log in the devlog
- I'll use the IDs from `data/cities.json` and `districts.philly.json` (`philadelphia`, `founded`), not the mockup's (`philly`, `startup`).
- The five stances map to lean −1, −0.5, 0, +0.5, +1. District `lean_mix` buckets stay left/center/right.
- There are three length tiers (lead, secondary, brief). Inside-page slots use the same tiers.
- Cover price is fixed in the demo at `pricing.cover_price` and lives in `balance.ts`.
- "A big story left out" means importance ≥ 4 and run by the rival on its front page.
- The demo calendar starts on Wednesday, matching the wire text.
- The summaries cache is committed, and `.env` never is.

I'm stopping here until you approve or answer the questions.
