// Placeholder photo: a labelled halftone box drawn in code (no images).
import { useId } from 'react';
import { palette } from '../../theme/tokens.ts';

interface Props {
  width: number;
  height: number;
  label?: string;
  /** 0..1, how dark the dot field is. */
  density?: number;
}

export function PhotoBox({ width, height, label = 'PHOTO', density = 0.55 }: Props) {
  const id = useId().replace(/:/g, '');
  const r = 0.6 + density * 1.4;
  return (
    <svg width={width} height={height} role="img" aria-label={`Placeholder photo: ${label}`} style={{ display: 'block' }}>
      <defs>
        <pattern id={`ht-${id}`} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx={2.5} cy={2.5} r={r} fill={palette.ink} opacity={0.55} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={palette.photoBox} />
      <rect width={width} height={height} fill={`url(#ht-${id})`} opacity={0.35} />
      {/* simple skyline shape so it reads as a photo, not an empty box */}
      <path
        d={`M0 ${height * 0.72} L${width * 0.12} ${height * 0.72} L${width * 0.12} ${height * 0.5} L${width * 0.24} ${height * 0.5} L${width * 0.24} ${height * 0.62} L${width * 0.4} ${height * 0.62} L${width * 0.4} ${height * 0.38} L${width * 0.5} ${height * 0.38} L${width * 0.5} ${height * 0.58} L${width * 0.7} ${height * 0.58} L${width * 0.7} ${height * 0.46} L${width * 0.82} ${height * 0.46} L${width * 0.82} ${height * 0.68} L${width} ${height * 0.68} L${width} ${height} L0 ${height} Z`}
        fill={`url(#ht-${id})`}
      />
      <text x={width / 2} y={height / 2 + 3} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={9} letterSpacing={1} fill={palette.inkMuted}>
        [{label}]
      </text>
    </svg>
  );
}
