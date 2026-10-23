# AI content review list

Tapestry's AI policy: AI is a development tool, not for creative work. The summarizer counts as tooling. Anything else written by a model is temporary and must be reviewed or replaced by the team.

Every item below is also marked in code or data with `AI-CONTENT-REVIEW` (search for it).

| Item | Where | Status |
|---|---|---|
| Letters to the editor: sentence templates and reader names | `src/sim/letters.ts` | Written by an AI model as placeholders, filled from game events. Approved for the demo only. Review or rewrite before release. |
| Generated demo news: about 90 story templates and the name lists | `src/data/NewsGenerator.ts` | Written by an AI model as generic, fictional placeholder news to fill 70 days of wire (days 1–4 keep the hand-written stories). Approved for the demo only. The full game uses real wire news plus generated local sports and politics. |
