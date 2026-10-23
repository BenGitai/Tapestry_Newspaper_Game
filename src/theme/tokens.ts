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
  for (const [k, v] of Object.entries(fonts)) vars[`--f-${kebab(k)}`] = v;
  return vars;
}

export function applyTheme(root: HTMLElement = document.documentElement): void {
  for (const [k, v] of Object.entries(themeCssVariables())) root.style.setProperty(k, v);
}
