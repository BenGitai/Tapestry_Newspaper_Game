# Mockups

Early speculative mockups. Use them for the look and feel, not as exact layouts.

- `01-title-screen.png` / `Menu.dc.html`: **the target look.** Physical objects on a dark desk: a newspaper, a press pass, a wire slip. Menu options are headlines and classified ads.
- `Setup.dc.html`: the new game setup form (no screenshot). A "Form 1-A" registration form on the same desk, with a market report card, a live proof of the masthead and an "APPROVED" stamp that starts the game. The logic in its `<script>` block shows how the choices behave.
- `03-front-page-editor.png` / `Main.dc.html`: the layout of the main screen (wire, paste-up board, inspector). It reads too flat and "app-like" compared with the title screen. Give it the desk treatment: the paste-up board lying on the desk, wire slips as curling paper, the inspector as notes and memos.
- `04-city-map.png` / `Map.dc.html`: map layers, halftone readership density and the district panel. The district names in the mockup belong to a made-up town; use the Philadelphia districts from `data/districts.philly.json`. Pinning the map to a corkboard on the desk would fit the look.

The `.dc.html` files use a custom component format (`<x-dc>`, `{{holes}}`, `<sc-for>`) that won't run outside the design tool. Read them for structure, fonts, sizes and colors.
