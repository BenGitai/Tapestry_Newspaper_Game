// Architecture rules from CLAUDE.md, enforced as tests:
// - the model is never called from client code (no Anthropic SDK under src/)
// - simulation, summarizer and data code have no UI imports
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

function imports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? m[2] ?? '');
}

describe('boundaries', () => {
  it('no client code imports the Anthropic SDK', () => {
    const offenders = files(join(root, 'src')).filter((f) => imports(f).some((i) => i.startsWith('@anthropic-ai/')));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it('simulation, summarizer and data code stay UI-free', () => {
    const pure = ['sim', 'summarizer', 'data'].flatMap((d) => files(join(root, 'src', d)));
    const banned = /^(react|react-dom|zustand)(\/|$)|\/(components|screens|state)\//;
    const offenders = pure.filter((f) => imports(f).some((i) => banned.test(i)));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it('client code never reads the API key', () => {
    const offenders = files(join(root, 'src')).filter((f) => readFileSync(f, 'utf8').includes('ANTHROPIC_API_KEY'));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});
