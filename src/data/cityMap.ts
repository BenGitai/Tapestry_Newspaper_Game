// The city map drawn on the Map tab: real district outlines, rivers and parks
// from the City of Philadelphia's open data (built by npm run map:build into
// data/map.philly.json). Pure data, so it can be checked in tests.
import { z } from 'zod';
import raw from '../../data/map.philly.json';

const point = z.tuple([z.number(), z.number()]);
const cityMapSchema = z.object({
  attribution: z.string(),
  viewbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** Game district id → SVG path and label position. */
  districts: z.record(z.string(), z.object({ path: z.string(), label: point })),
  water: z.array(z.string()),
  parks: z.array(z.string()),
});

export type CityMap = z.infer<typeof cityMapSchema>;

let cached: CityMap | undefined;

export function cityMap(): CityMap {
  cached ??= cityMapSchema.parse(raw);
  return cached;
}
