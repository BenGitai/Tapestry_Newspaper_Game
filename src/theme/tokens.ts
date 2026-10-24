// The only place colors and font stacks are defined (design spec section 8).
// global.css reads these through CSS custom properties set in applyTheme().

export const palette = {
  ink: '#1C1B18',
  inkMuted: '#4A4438',
  inkFaint: '#7A7262',
  inkSoft: '#3A362E',
  newsprint: '#F1EAD7',
  newsprintLight: '#F4EEDC',
  agedPaper: '#ECE5D3',
  cardWhite: '#FBF8F0',
  proofGrey: '#A39A85',
  proofBlock: '#CFC5AE',
  pasteUp: '#D8CDB3',
  pasteUpDark: '#C9BC9E',
  photoBox: '#D3C8AF',
  desk: '#2B2520',
  deskGrain: '#342C26',
  rust: '#9A4413',
  tiger: '#E08A2E',
  stampRed: '#E35F3E',
  green: '#2F6B3A',
  // Map: land outside the city, rivers, parks.
  mapLand: '#E2D9BF',
  water: '#8FB3C9',
  waterInk: '#4F7C96',
  park: '#9DB98A',
  // How-to-play memos: a yellow memo slip.
  memo: '#F2E2A4',
} as const;

/**
 * Spot colors, one per desk: muted printing inks (like a two-color section
 * front), used for kickers, slip edges and the placeholder photos.
 */
export const categoryInk = {
  politics: '#5C4A7D',
  economy: '#3D7552',
  social: '#B4613A',
  sports: '#2E6A8C',
  culture: '#B3872B',
  science: '#2F8380',
  world: '#7B5838',
} as const;

/**
 * Map layers: five steps from "low" to "high", each a single hue so the map
 * reads at a glance. Political fit uses violet, never party red or blue.
 */
export const mapRamps = {
  readership: ['#EFE8D3', '#D3DFBC', '#AECA93', '#81A96A', '#557F47'],
  trust: ['#EFE8D3', '#CDDCDD', '#A1C1C7', '#6F9BA8', '#467584'],
  lean: ['#EFE8D3', '#DED0E2', '#C0A9CB', '#9A7FAC', '#725A89'],
  income: ['#EFE8D3', '#ECDAA9', '#DDBF79', '#C49C4F', '#9C7634'],
  rival: ['#EFE8D3', '#F0CDB7', '#E1A487', '#C77A58', '#984C30'],
} as const;

export const fonts = {
  display: "'Old Standard TT', 'Times New Roman', serif",
  body: "'Libre Caslon Text', Georgia, serif",
  mono: "'IBM Plex Mono', 'Courier New', monospace",
} as const;

/** Logical stage size. The whole game is laid out at this size and scaled to the window. */
export const stage = { width: 1440, height: 900 } as const;

export type PaletteKey = keyof typeof palette;

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/** Writes the palette and fonts to :root as --c-* and --f-* custom properties. */
export function themeCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(palette)) vars[`--c-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(categoryInk)) vars[`--c-cat-${k}`] = v;
  for (const [k, v] of Object.entries(fonts)) vars[`--f-${kebab(k)}`] = v;
  return vars;
}

export function applyTheme(root: HTMLElement = document.documentElement): void {
  for (const [k, v] of Object.entries(themeCssVariables())) root.style.setProperty(k, v);
}
