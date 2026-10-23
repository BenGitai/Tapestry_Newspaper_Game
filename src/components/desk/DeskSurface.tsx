// The editor's desk: dark wood with faint grain lines, drawn in SVG.
import type { ReactNode } from 'react';
import { palette, stage } from '../../theme/tokens.ts';

const GRAIN = [
  'M0 70 C300 62 700 80 1440 66',
  'M0 190 C400 200 900 180 1440 196',
  'M0 330 C500 322 1000 342 1440 328',
  'M0 480 C350 490 800 470 1440 486',
  'M0 640 C450 632 950 652 1440 636',
  'M0 800 C300 810 850 792 1440 806',
];

export function DeskSurface({ children }: { children?: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: palette.desk }}>
      <svg width={stage.width} height={stage.height} aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        <g stroke={palette.deskGrain} strokeWidth={2} fill="none">
          {GRAIN.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
      {children}
    </div>
  );
}
