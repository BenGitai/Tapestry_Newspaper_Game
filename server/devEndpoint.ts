// Dev-only live generation for the tech demo (spec 7.4: "a dev-only endpoint that
// generates on a cache miss when ANTHROPIC_API_KEY is set"). Vite mounts it while
// `npm run techdemo` / `npm run dev` run; the built game has no such endpoint.
// The key stays in this Node process. The page only ever sees the article text,
// the prompt, token counts and the fact check.
import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';
import { loadGameData } from '../src/data/worldData.ts';
import { summarizerModel } from '../src/summarizer/config.ts';
import type { LiveRequest, LiveResponse, LiveStatus } from '../src/summarizer/live.ts';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function summarizerDevEndpoint(): Plugin {
  return {
    name: 'summarizer-dev-endpoint',
    apply: 'serve',
    configureServer(server) {
      const model = summarizerModel(process.env);
      server.middlewares.use('/__summarize', (req, res) => {
        const send = (code: number, body: LiveStatus | LiveResponse | { error: string }) => {
          res.statusCode = code;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method === 'GET') return send(200, { live: Boolean(process.env['ANTHROPIC_API_KEY']), model });
        if (req.method !== 'POST') return send(405, { error: 'POST or GET only' });
        if (!process.env['ANTHROPIC_API_KEY']) return send(503, { error: 'ANTHROPIC_API_KEY is not set' });
        void (async () => {
          try {
            const body = JSON.parse(await readBody(req)) as LiveRequest;
            const { world, stories } = loadGameData();
            const story = stories.storyById(body.storyId);
            if (!story) return send(404, { error: `Unknown story ${body.storyId}` });
            const j = body.journalistId ? world.staff_pool.find((r) => r.id === body.journalistId) : undefined;
            // The SDK is loaded on first use, so the dev server starts without it.
            const { generateArticle, makeClient } = await import('./generate.ts');
            const r = await generateArticle(makeClient(), model, { story, angle: body.angle, tier: body.tier, ...(j ? { journalist: { name: j.name, voice: j.voice } } : {}) }, world);
            send(200, { article: r.article, failure: r.failure ?? null, model: r.model, usage: r.usage, cost: r.cost, attempts: r.attempts, angle: r.prompt.angle });
          } catch (e) {
            send(500, { error: e instanceof Error ? e.message : String(e) });
          }
        })();
      });
    },
  };
}
