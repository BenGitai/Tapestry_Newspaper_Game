/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The summarizer dev middleware (generate-on-miss) is added in milestone 3.
// Never expose ANTHROPIC_API_KEY: Vite only exposes VITE_-prefixed env vars to client code.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
