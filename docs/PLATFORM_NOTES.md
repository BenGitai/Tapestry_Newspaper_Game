# Platform notes

Starting recommendation for the demo. Claude Code should challenge this if it sees a better option, then wait for a decision before building.

## Recommendation: web stack (TypeScript), packaged for desktop later

- **TypeScript + React + Vite** for the game UI.
- **dnd-kit** (or similar) for drag and drop on the page layout.
- **Plain SVG** for the stylized city map and halftone patterns. No map library needed.
- **Zustand** (or similar) for game state, with the simulation as plain TypeScript functions that don't depend on React, so they can be unit tested.
- **Node script** (`npm run summarize`) for the AI summarizer, using the official Anthropic TypeScript SDK. Optional Vite dev-server middleware for generate-on-miss.
- **Vitest** for simulation and fact-check tests.
- Later: package for Steam with **Tauri** or **Electron**. A browser build also makes it easy to share the demo with the team as a link.

## Why

- The game is mostly UI: newspaper typography, columns, drag and drop, panels, a 2D map. That is exactly what HTML/CSS is best at, and the mockups are already HTML.
- Fastest path to a playable demo, and the easiest stack for a student team to pick up.
- The summarizer and the future live news pipeline are server-side TypeScript/Node anyway, so one language across the whole project.
- Claude Code is very strong in TypeScript/React.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| **Godot 4** (GDScript or C#) | Free and open source, a real game engine, good 2D, easy desktop and Steam export, good for animation and "game feel" | Rich text layout and newspaper typography are much harder than in CSS; UI-heavy screens take longer; smaller pool of students who know it |
| **Unity** (C#) | Industry standard, huge ecosystem, strong for juicy effects | Heavy for a UI-driven 2D game, licensing history makes some teams wary, slower iteration for this kind of game |
| **Web stack** (recommended) | Best for typography and UI, fastest iteration, shareable in a browser, one language for client and server | Needs Tauri/Electron for Steam; less built-in "game feel" tooling (animations are done in CSS or a library) |

## Revisit when

- The team wants heavy animation, particle effects or a 3D desk scene. Then Godot is worth a second look.
- Performance problems show up on the map (unlikely at this scale).
