// npm run map:build — build the city map (data/map.philly.json) from the City of
// Philadelphia's open data (OpenDataPhilly / the city's ArcGIS services): the 18
// planning districts, grouped into the game's 8 districts, plus rivers and the
// large parks. Shapes are projected into the map's 800 x 900 viewbox, simplified
// and stored as SVG paths, so the game needs no network or map library.
import { writeFileSync } from 'node:fs';

const BASE = 'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services';
const OUT = 'data/map.philly.json';
const VIEW = { w: 800, h: 900, pad: 24 };
/** Simplification tolerance, in map pixels. */
const TOLERANCE = 0.7;
/** Parks smaller than this (square map pixels) are left off. */
const MIN_PARK_AREA = 250;

/** Planning district (abbrev) → game district. */
const GROUPS: Record<string, string> = {
  CTR: 'center_city',
  STH: 'south_philly',
  LS: 'south_philly',
  RW: 'river_wards',
  WST: 'west_philly',
  WP: 'west_philly',
  USW: 'west_philly',
  NOR: 'north_philly',
  LNO: 'north_philly',
  UNO: 'north_philly',
  NDEL: 'northeast',
  LFNE: 'northeast',
  LNE: 'northeast',
  CNE: 'northeast',
  UFNE: 'northeast',
  UNW: 'northwest',
  LNW: 'northwest',
  LSW: 'southwest',
};

type Ring = [number, number][];

async function query(service: string, layer: number, where: string, fields: string): Promise<{ attributes: Record<string, unknown>; geometry?: { rings: Ring[] } }[]> {
  const url = `${BASE}/${service}/FeatureServer/${layer}/query?where=${encodeURIComponent(where)}&outFields=${fields}&outSR=4326&f=json&geometryPrecision=5&maxAllowableOffset=0.0001`;
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  const j = (await r.json()) as { error?: unknown; features?: { attributes: Record<string, unknown>; geometry?: { rings: Ring[] } }[] };
  if (!j.features) throw new Error(`${service}: ${JSON.stringify(j.error)}`);
  return j.features;
}

const districts = await query('Planning_Districts', 0, '1=1', 'abbrev,dist_name');
const water = await query('Hydrographic_Features_Poly', 1, 'Shape__Area>40000', 'creek_name');
const parks = await query('PPR_Parks', 0, '1=1', 'PUBLIC_NAM');

// ---- projection: equirectangular, scaled by cos(latitude), fitted to the viewbox ----
const all = districts.flatMap((f) => f.geometry!.rings.flat());
const minX = Math.min(...all.map((p) => p[0]));
const maxX = Math.max(...all.map((p) => p[0]));
const minY = Math.min(...all.map((p) => p[1]));
const maxY = Math.max(...all.map((p) => p[1]));
const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
const scale = Math.min((VIEW.w - 2 * VIEW.pad) / ((maxX - minX) * k), (VIEW.h - 2 * VIEW.pad) / (maxY - minY));
const offX = (VIEW.w - (maxX - minX) * k * scale) / 2;
const offY = (VIEW.h - (maxY - minY) * scale) / 2;
const project = ([lon, lat]: [number, number]): [number, number] => [offX + (lon - minX) * k * scale, offY + (maxY - lat) * scale];

// ---- geometry helpers ----
/** Douglas-Peucker on a closed ring: split at the point farthest from the start, simplify both halves. */
function simplifyRing(ring: Ring, tol: number): Ring {
  const pts = ring.slice(0, -1);
  if (pts.length < 4) return pts;
  const [sx, sy] = pts[0]!;
  let far = 1;
  pts.forEach(([x, y], i) => {
    if (Math.hypot(x - sx, y - sy) > Math.hypot(pts[far]![0] - sx, pts[far]![1] - sy)) far = i;
  });
  return [...simplify(pts.slice(0, far + 1), tol).slice(0, -1), ...simplify([...pts.slice(far), pts[0]!], tol).slice(0, -1)];
}

function simplify(pts: Ring, tol: number): Ring {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a]!;
    const [bx, by] = pts[b]!;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]!;
      const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > worst) [worst, at] = [d, i];
    }
    if (worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function area(r: Ring): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i]!;
    const [x2, y2] = r[(i + 1) % r.length]!;
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

function centroid(rings: Ring[]): [number, number] {
  let A = 0;
  let cx = 0;
  let cy = 0;
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const [x1, y1] = r[i]!;
      const [x2, y2] = r[(i + 1) % r.length]!;
      const c = x1 * y2 - x2 * y1;
      A += c;
      cx += (x1 + x2) * c;
      cy += (y1 + y2) * c;
    }
  }
  return [Math.round(cx / (3 * A)), Math.round(cy / (3 * A))];
}

const inView = (r: Ring) => r.some(([x, y]) => x > -100 && x < VIEW.w + 100 && y > -100 && y < VIEW.h + 100);
const round = (n: number) => Math.round(n * 10) / 10;
const toPath = (rings: Ring[]) => rings.map((r) => 'M' + r.map(([x, y]) => `${round(x)} ${round(y)}`).join('L') + 'Z').join('');
const prep = (rings: Ring[], tol = TOLERANCE) => rings.map((r) => simplifyRing(r.map(project), tol)).filter((r) => r.length >= 3);

// ---- build ----
const out: Record<string, { path: string; label: [number, number] }> = {};
const byGroup = new Map<string, Ring[]>();
for (const f of districts) {
  const id = GROUPS[String(f.attributes.abbrev)];
  if (!id) throw new Error(`Unmapped planning district ${String(f.attributes.abbrev)}`);
  byGroup.set(id, [...(byGroup.get(id) ?? []), ...prep(f.geometry!.rings)]);
}
for (const [id, rings] of byGroup) {
  if (!rings.length) throw new Error(`${id}: no shapes`);
  // The label sits at the district's center of area.
  out[id] = { path: toPath(rings), label: centroid(rings) };
}

const waterPaths = water
  .filter((f) => f.geometry)
  .map((f) => prep(f.geometry!.rings, 1.2).filter(inView))
  .filter((r) => r.length)
  .map(toPath);
const parkPaths = parks
  .filter((f) => f.geometry)
  .map((f) => prep(f.geometry!.rings, 1).filter((r) => Math.abs(area(r)) > MIN_PARK_AREA))
  .filter((r) => r.length)
  .map(toPath);

const json = {
  _note: 'Built by npm run map:build from City of Philadelphia open data (planning districts, hydrography, parks). Projected to the 800 x 900 map viewbox and simplified. Do not edit by hand.',
  attribution: 'Map data: City of Philadelphia (OpenDataPhilly)',
  viewbox: [0, 0, VIEW.w, VIEW.h],
  districts: out,
  water: waterPaths,
  parks: parkPaths,
};
writeFileSync(OUT, JSON.stringify(json) + '\n');
console.log(`Wrote ${OUT}: ${byGroup.size} districts, ${waterPaths.length} water shapes, ${parkPaths.length} parks, ${(JSON.stringify(json).length / 1024).toFixed(0)} KB`);
