# Tapestry Newspaper Game (placeholder name) — project rules for Claude Code

A newspaper-manager game by Tapestry Games (student indie studio). This repo is a playable demo, shipped as a desktop app (Electron). Read `docs/GAME_DESIGN.md` and then `docs/DESIGN_CHANGES.md` (which overrides it where they differ) before making design decisions, and `docs/PLATFORM_DECISION.md` for the tech stack.

## Ground rules
- **Print only.** There are no digital articles in this game. Page layout is the core mechanic.
- **Placeholder art only.** Labelled boxes, simple shapes and halftone patterns drawn in code. Never add AI-generated images or stock illustration. Real art comes from the team later.
- **No invented content in the summarizer.** It uses only the facts provided for each story. No invented quotes, names, numbers or events.
- **Local stories are fiction; the national and world wire is real news.** Philadelphia stories (`data/stories.philly.json` and the generator) use real places and teams for flavor but no real people. Don't add real people there. The wire (`data/news/`) is built from public RSS headlines and feed summaries (NPR, BBC News, PBS NewsHour) with `npm run news:fetch` and `npm run news:build`. Keep only the headline, the feed's own summary and the link, never article text. Facts restate only those, and every story links to the original coverage.
- **City news only through local patches.** The wire is national and international (World is international only). Philadelphia stories reach the paper only when a reporter works the Philadelphia or a district patch.
- **API key safety.** Read `ANTHROPIC_API_KEY` from the environment (`.env`, gitignored). Never commit it, never send it to the browser, never call the model from client code.
- **The demo must run with no API key**, from cached summaries or template fallbacks.
- **Political symmetry.** Lean mechanics must treat left and right identically. Lean changes who trusts you, never whether the game treats a side as right.

## Visual rules
- Follow section 8 of the design spec and the screenshots in `reference/mockups/`.
- Palette and fonts live in one theme file. Don't hardcode colors elsewhere.
- No gradients, glassmorphism, drop shadows on cards, neon, emoji or rounded "app" panels. It should look like ink on paper on a desk, not a dashboard.
- Bundle fonts locally (Old Standard TT, Libre Caslon Text, IBM Plex Mono).

## Code conventions
- Simulation logic is plain TypeScript with no UI imports, so it can be unit tested.
- All tunable numbers (prices, multipliers, decay rates) live in one balance config file with comments.
- Data lives in `data/` as JSON. Keep loaders behind an interface so a live news source can replace the story file later.
- Write tests for the simulation and the summarizer fact check.
- Keep a short `docs/DEVLOG.md`: what changed and what's next, a few lines per session.

## Commands
- `npm run dev`: open the game in its desktop window (Electron + Vite hot reload). `npm run dev:web` runs it in a browser tab instead. In dev, the backtick key (`` ` ``) opens a jump menu.
- `npm run start`: build and run the desktop app; `npm run package`: build an unpacked app into `release/`
- `npm run smoke`: build, then play through the desktop app with Playwright (screenshots in `.tmp/smoke/`)
- `npm test`: run tests (Vitest)
- `npm run typecheck`, `npm run lint`, `npm run build`
- `npm run summarize`: pre-generate articles for the demo's story set into `data/generated/summaries.cache.json` and print the cost report. Flags: `--dry-run`, `--story <id>`, `--force`, `--limit <n>`. Needs `ANTHROPIC_API_KEY` in `.env` (except with `--dry-run`)
- `npm run techdemo`: open the desktop app straight into the summarizer tech demo (live generation when a key is set)
- `npm run simulate`: play the demo headlessly with fixed strategies (per origin) and print readers, cash, trust and lean, for balance work

## AI-written content
- Letters to the editor may be AI-generated for now. Mark any code or data that produces them with `AI-CONTENT-REVIEW` and list it in `docs/AI_CONTENT_REVIEW.md` so the team can review or replace it later.
