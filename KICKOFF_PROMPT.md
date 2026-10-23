# Kickoff prompt for Claude Code

Unzip this kit into an empty folder, open Claude Code in that folder, and paste everything below the line.

---

I'm building a playable demo of a newspaper-manager game for my student studio, Tapestry Games. You run a print newspaper in Philadelphia: you pick stories off a news wire, assign journalists and an angle, and lay out the front page. Readers, advertisers, City Hall and a rival paper react to what you print. An AI summarizer turns wire facts into the in-game article text.

This folder has everything you need to start:

- `CLAUDE.md`: project rules. Follow them in every session.
- `docs/GAME_DESIGN.md`: the full design spec for the demo. This is the source of truth.
- `docs/PLATFORM_NOTES.md`: my starting recommendation for the tech stack (TypeScript + React + Vite, packaged with Tauri/Electron later).
- `data/stories.philly.json`: 24 fictional wire stories across 4 in-game days.
- `data/districts.philly.json`: city districts, reader groups, advertisers, staff pool, the rival paper, origins and prices.
- `data/cities.json`: the cities shown on the setup form (only Philadelphia is playable).
- `reference/mockups/`: screenshots and the original HTML mockups of the title screen, new game setup, front page editor and city map. Match this look. The `.dc.html` files use a custom component format that won't run on its own; read them for layout, spacing, fonts and colors.
- `reference/tapestry-logo.png`: the studio logo for the title screen.

**Step 1: platform decision. Don't write game code yet.**
Read all of the docs and data. Then write `docs/PLATFORM_DECISION.md` with:
- Whether you agree with the web stack in `PLATFORM_NOTES.md` or would pick something else (Godot, Unity, other), and why, given that this game is mostly typography, drag and drop and panels, the summarizer runs server-side, and we eventually want it on Steam.
- The exact libraries and versions you'd use.
- A folder structure.
- Your plan for the milestones in section 10 of the design spec, with anything you think is missing or risky.
- Any questions about the design that would change how you build it.

Then stop and wait for me to approve before building.

**Step 2, after I approve: build milestone by milestone.**
- Start with the skeleton and the front page layout mechanic. Laying out the page has to feel good before we add the rest.
- After each milestone, make sure `npm run dev` works, run the tests, update `docs/DEVLOG.md`, and give me a short summary of what I can try and what's next.
- Commit after each milestone with a clear message.

**For the summarizer:**
- Build the prompt, cache, `npm run summarize` script, cost report and fact check as described in section 7 of the design spec.
- Use the model `claude-haiku-5-5` by default, configurable in one place. Check Anthropic's current docs for the SDK usage and pricing rather than relying on memory.
- I'll put my API key in `.env` as `ANTHROPIC_API_KEY`. Until I do, everything must work from template fallbacks.
- Include the Summarizer lab dev screen so I can compare the three angles for any story side by side.

Ask me if anything in the spec is unclear or contradicts itself instead of guessing on big decisions. Small decisions you can make yourself; note them in the devlog.
