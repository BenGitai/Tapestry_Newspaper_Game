/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { summarizerDevEndpoint } from './server/devEndpoint.ts';

// The summarizer dev endpoint (live generation for the tech demo) only runs under the dev server.
// Never expose ANTHROPIC_API_KEY: Vite only exposes VITE_-prefixed env vars to client code.
export default defineConfig({
  plugins: [react(), summarizerDevEndpoint()],
  // Relative asset paths so the built game loads from file:// inside the desktop app.
  base: './',
  server: { port: 5173 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
