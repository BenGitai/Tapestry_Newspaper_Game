// npm run dev: start the Vite dev server, then open the game in the desktop window.
// Closing the window stops the server. Use `npm run dev:web` for a browser tab instead.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('Vite dev server did not report a URL');
console.log(`Dev server at ${url}, opening the game window…`);

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

const stop = async (code = 0) => {
  await server.close();
  process.exit(code);
};
child.on('exit', (code) => stop(code ?? 0));
process.on('SIGINT', () => {
  child.kill();
  stop(0);
});
