// The rival paper picks its front page from the same wire with a simple rule
// (districts.philly.json: "Leads with the highest-importance politics or economy
// story of the day. Never runs Puff on the lead. Puts sports below the fold
// unless it is a playoff win.").
import type { Story } from '../data/schemas.ts';

const RIVAL_FRONT_SIZE = 4;

function isPlayoffWin(s: Story): boolean {
  return s.category === 'sports' && s.tags.includes('playoffs') && /\b(take|win|wins|clinch|homers)\b/i.test(s.wire_headline);
}

/** Story ids on the rival's front page, lead first. Deterministic. */
export function rivalFrontPage(wire: Story[]): string[] {
  const byImportance = [...wire].sort((a, b) => b.importance - a.importance || a.filed_at.localeCompare(b.filed_at));
  const lead = byImportance.find((s) => s.category === 'politics' || s.category === 'economy') ?? byImportance[0];
  if (!lead) return [];
  const rest = byImportance.filter((s) => s.id !== lead.id && (s.category !== 'sports' || isPlayoffWin(s)));
  return [lead.id, ...rest.slice(0, RIVAL_FRONT_SIZE - 1).map((s) => s.id)];
}
