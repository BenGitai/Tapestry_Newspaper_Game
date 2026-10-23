// Reporter helpers: desk matching and default assignments.
import type { CityWorld, Reporter, Story } from '../data/schemas.ts';
import { filingCapacity, reporterLoad } from './layout.ts';
import type { IssueDraft } from './types.ts';

export function reporterById(world: CityWorld, id: string): Reporter | undefined {
  return world.staff_pool.find((r) => r.id === id);
}

export function isOnDesk(reporter: Reporter, story: Story, world: CityWorld): boolean {
  const cats = world.desk_categories[reporter.desk];
  return Array.isArray(cats) && cats.includes(story.category);
}

/**
 * Default reporter for a story that just landed on the page: the staff reporter
 * on the matching desk with the most room left, otherwise wire copy (null).
 * Putting someone off their desk, or over their filing capacity, is left to the player.
 */
export function suggestReporter(draft: IssueDraft, story: Story, staff: Reporter[], world: CityWorld, inchesNeeded: number): string | null {
  const room = (r: Reporter): number => filingCapacity(r) - reporterLoad(draft, r.id);
  const withRoom = staff.filter((r) => room(r) >= inchesNeeded);
  const byRoom = (a: Reporter, b: Reporter): number => room(b) - room(a);
  const onDesk = withRoom.filter((r) => isOnDesk(r, story, world)).sort(byRoom);
  return onDesk[0]?.id ?? null;
}

export function initials(name: string): string {
  const parts = name.split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return `${(parts[0] ?? '').charAt(0)}. ${last}`;
}
