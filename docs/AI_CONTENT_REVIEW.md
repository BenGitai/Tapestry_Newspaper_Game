# AI content review list

Tapestry's AI policy: AI is a development tool, not for creative work. The summarizer counts as tooling. Anything else written by a model is temporary and must be reviewed or replaced by the team.

Every item below is also marked in code or data with `AI-CONTENT-REVIEW` (search for it).

| Item | Where | Status |
|---|---|---|
| Letters to the editor: sentence templates and reader names | `src/sim/letters.ts` | Written by an AI model as placeholders, filled from game events. Approved for the demo only. Review or rewrite before release. |
| Generated demo news: about 90 story templates and the name lists | `src/data/NewsGenerator.ts` | Written by an AI model as generic, fictional placeholder news to fill 70 days of wire (days 1–4 keep the hand-written stories). Approved for the demo only. The full game uses real wire news plus generated local sports and politics. |
| Generated job candidates: name lists and voice lines | `src/data/CandidateGenerator.ts` | 18 extra fictional candidates so the hiring market can support a 20+ newsroom. Approved for the demo only. |
| Pre-generated article text | `data/generated/summaries.cache.json` | Output of the summarizer (tooling, see section 7 of the design spec) from `npm run summarize`. It only rephrases each story's own facts and is fact checked, but the stories it rewrites are placeholders, so it is regenerated when they are replaced. Not creative content. |
| Real-news wire facts and tags | `server/newsFacts.ts` → `data/news/stories.json` | Tooling, like the summarizer: `npm run news:build` asks the model to tag each RSS item (desk, sub-focus, importance, sensitivity, lean signal) and restate its headline and feed summary as facts. Facts with numbers or names not in the source are dropped. Headlines and links are the publishers' own. Spot-check the tags (especially lean) before release. |
| How-to-play memos | `src/components/desk/TutorialCard.tsx` | Guide text written by an AI model. Approved for the demo only. Rewrite in the team's voice before release. |
| Six extra advertisers (names and sectors) | `data/districts.philly.json` (entities with `min_readers` above 0; `note` says AI-CONTENT-REVIEW) | Fictional placeholder businesses that sign up as the paper grows. Approved for the demo only. |
