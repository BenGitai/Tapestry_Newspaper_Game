import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'reference'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The model is only ever called server-side.
      'no-restricted-imports': ['error', { patterns: [{ group: ['@anthropic-ai/*'], message: 'The Anthropic SDK may only be imported from server/ or scripts/.' }] }],
    },
  },
  {
    files: ['src/sim/**/*.ts', 'src/summarizer/**/*.ts', 'src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['react', 'react-dom', 'zustand', '*/components/*', '*/screens/*', '*/state/*'], message: 'Simulation, summarizer and data code must stay UI-free.' },
        { group: ['@anthropic-ai/*'], message: 'The Anthropic SDK may only be imported from server/ or scripts/.' },
      ] }],
    },
  },
  {
    files: ['server/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
);
