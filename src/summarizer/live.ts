// Client side of the tech demo's dev-only live endpoint (server/devEndpoint.ts).
// Only the Vite dev server answers; in a built game every call fails and the
// tech demo shows cached and template articles instead.
import type { Angle } from '../data/schemas.ts';
import type { Tier } from '../sim/types.ts';
import type { Usage } from './cost.ts';
import type { ArticleText } from './types.ts';

export interface LiveStatus {
  live: boolean;
  model: string;
}

export interface LiveRequest {
  storyId: string;
  journalistId: string | null;
  angle: Angle;
  tier: Tier;
}

export interface LiveResponse {
  article: ArticleText | null;
  failure: 'refusal' | 'max_tokens' | 'unparseable' | null;
  model: string;
  usage: Usage;
  cost: number;
  attempts: number;
  /** The angle actually used (sensitive stories are never Puff). */
  angle: Angle;
}

export async function liveStatus(): Promise<LiveStatus | null> {
  try {
    const r = await fetch('/__summarize');
    return r.ok && (r.headers.get('content-type') ?? '').includes('json') ? ((await r.json()) as LiveStatus) : null;
  } catch {
    return null;
  }
}

export async function liveGenerate(req: LiveRequest): Promise<LiveResponse> {
  const r = await fetch('/__summarize', { method: 'POST', body: JSON.stringify(req) });
  const body = (await r.json()) as LiveResponse | { error: string };
  if (!r.ok || 'error' in body) throw new Error('error' in body ? body.error : `HTTP ${r.status}`);
  return body;
}
