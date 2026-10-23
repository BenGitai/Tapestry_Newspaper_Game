# Above the Fold — project rules for Claude Code

A newspaper-manager game by Tapestry Games (student indie studio). This repo is a playable demo. Read `docs/GAME_DESIGN.md` before making design decisions and `docs/PLATFORM_NOTES.md` for the tech stack.

## Ground rules
- **Print only.** There are no digital articles in this game. Page layout is the core mechanic.
- **Placeholder art only.** Labelled boxes, simple shapes and halftone patterns drawn in code. Never add AI-generated images or stock illustration. Real art comes from the team later.
- **No invented content in the summarizer.** It uses only the facts provided for each story. No invented quotes, names, numbers or events.
- **Demo stories are fiction.** Real Philadelphia places and teams for flavor, but no real people. Don't add real people when editing story data.
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

## Commands (fill in once the project is set up)
- `npm run dev`: start the game
- `npm run summarize`: pre-generate article text for all stories and print the cost report
- `npm test`: run tests
