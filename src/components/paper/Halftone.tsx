// Placeholder photo: a labelled halftone box drawn in code (no images). With a
// category it prints as a two-color "spot ink" picture of a simple scene for that
// desk (a dome for politics, a pitch for sports...), so pages are easier to read
// at a glance. Real photos come from the art team later.
import { useId } from 'react';
import type { Category } from '../../data/schemas.ts';
import { categoryInk, palette } from '../../theme/tokens.ts';

interface Props {
  width: number;
  height: number;
  label?: string;
  /** 0..1, how dark the dot field is. */
  density?: number;
  /** Desk the photo belongs to: sets the spot color and the scene. */
  category?: Category;
  /** Varies the scene within a desk (e.g. the story id). */
  seed?: string;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A simple scene for a desk, drawn in a 100 x 60 box. */
function Scene({ category, variant, fill, ink }: { category: Category; variant: number; fill: string; ink: string }) {
  switch (category) {
    case 'politics':
      // Capitol dome with columns and steps.
      return (
        <g fill={fill} stroke={ink} strokeWidth={0.8}>
          <path d="M38 30 A12 12 0 0 1 62 30 Z" />
          <rect x={48.5} y={12} width={3} height={6} />
          <rect x={30} y={30} width={40} height={4} />
          {[33, 39, 45, 51, 57, 63].map((x) => (
            <rect key={x} x={x} y={34} width={3} height={14} />
          ))}
          <rect x={26} y={48} width={48} height={4} />
          <rect x={22} y={52} width={56} height={4} />
        </g>
      );
    case 'economy':
      // Rowhouses, or a rising bar chart.
      return variant % 2 ? (
        <g fill={fill} stroke={ink} strokeWidth={0.8}>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={18 + i * 14} y={46 - i * 7 - (i % 2) * 3} width={10} height={10 + i * 7 + (i % 2) * 3} />
          ))}
          <path d="M14 56 L86 56" />
        </g>
      ) : (
        <g fill={fill} stroke={ink} strokeWidth={0.8}>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <path d={`M${12 + i * 16} 30 L${20 + i * 16} 22 L${28 + i * 16} 30 Z`} />
              <rect x={12 + i * 16} y={30} width={16} height={26} />
              <rect x={16 + i * 16} y={44} width={5} height={12} fill={palette.newsprint} />
            </g>
          ))}
        </g>
      );
    case 'social':
      // A crowd of people in front of houses.
      return (
        <g fill={fill} stroke={ink} strokeWidth={0.8}>
          <rect x={10} y={22} width={22} height={34} opacity={0.5} />
          <rect x={68} y={18} width={22} height={38} opacity={0.5} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <circle cx={24 + i * 13} cy={32 + (i % 2) * 3} r={4.5} />
              <path d={`M${16 + i * 13} 58 Q${24 + i * 13} ${36 + (i % 2) * 3} ${32 + i * 13} 58 Z`} />
            </g>
          ))}
        </g>
      );
    case 'sports':
      // Stadium lights and a pitch with a ball.
      return (
        <g fill={fill} stroke={ink} strokeWidth={0.8}>
          <path d="M6 40 Q50 22 94 40 L94 56 L6 56 Z" opacity={0.55} />
          <path d="M10 56 L30 42 L70 42 L90 56 Z" fill={palette.newsprint} />
          <path d="M50 42 L50 56" fill="none" />
          <circle cx={variant % 2 ? 38 : 62} cy={50} r={3.5} />
          {[14, 86].map((x) => (
            <g key={x}>
              <rect x={x - 0.8} y={10} width={1.6} height={26} />
              <rect x={x - 5} y={8} width={10} height={5} />
            </g>
          ))}
        </g>
      );
    case 'culture':
      // A stage with curtains and a spotlight.
      return (
        <g fill={fill} stroke={ink} strokeWidth={0.8}>
          <path d="M8 6 L92 6 L92 12 L8 12 Z" />
          <path d="M8 12 Q20 30 14 56 L8 56 Z" />
          <path d="M92 12 Q80 30 86 56 L92 56 Z" />
          <path d="M50 12 L36 50 L64 50 Z" fill={palette.newsprint} opacity={0.8} />
          <circle cx={50} cy={36} r={4} />
          <path d="M44 50 Q50 38 56 50 Z" />
          <rect x={8} y={50} width={84} height={6} />
        </g>
      );
    case 'science':
      // A flask and an atom.
      return (
        <g fill="none" stroke={ink} strokeWidth={1}>
          <path d="M28 12 L36 12 M30 12 L30 28 L20 52 L44 52 L34 28 L34 12" fill={palette.newsprint} />
          <path d="M23 44 L41 44 L44 52 L20 52 Z" fill={fill} />
          <ellipse cx={68} cy={32} rx={16} ry={6} />
          <ellipse cx={68} cy={32} rx={16} ry={6} transform="rotate(60 68 32)" />
          <ellipse cx={68} cy={32} rx={16} ry={6} transform="rotate(-60 68 32)" />
          <circle cx={68} cy={32} r={3} fill={fill} />
        </g>
      );
    case 'world':
      // A globe with meridians.
      return (
        <g fill="none" stroke={ink} strokeWidth={0.9}>
          <circle cx={50} cy={32} r={22} fill={fill} opacity={0.35} />
          <circle cx={50} cy={32} r={22} />
          <ellipse cx={50} cy={32} rx={9} ry={22} />
          <path d="M28 32 L72 32 M31 21 L69 21 M31 43 L69 43 M50 10 L50 54" />
          <path d={variant % 2 ? 'M38 18 Q46 14 50 22 Q44 30 38 26 Z M54 34 Q62 30 66 38 Q60 46 56 42 Z' : 'M34 26 Q40 16 48 20 Q48 30 40 34 Z M56 22 Q64 20 66 30 Q58 34 54 28 Z'} fill={fill} />
        </g>
      );
  }
}

export function PhotoBox({ width, height, label = 'PHOTO', density = 0.55, category, seed = '' }: Props) {
  const id = useId().replace(/:/g, '');
  const r = 0.6 + density * 1.4;
  const ink = category ? categoryInk[category] : palette.ink;
  // Fit the 100 x 60 scene into the box, centered, leaving room for the label.
  const s = Math.min(width / 100, (height - 4) / 60);
  return (
    <svg width={width} height={height} role="img" aria-label={`Placeholder photo: ${label}`} style={{ display: 'block' }}>
      <defs>
        <pattern id={`ht-${id}`} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx={2.5} cy={2.5} r={r} fill={ink} opacity={0.55} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={palette.photoBox} />
      {category ? <rect width={width} height={height} fill={ink} opacity={0.14} /> : null}
      <rect width={width} height={height} fill={`url(#ht-${id})`} opacity={category ? 0.22 : 0.35} />
      {category ? (
        <g transform={`translate(${(width - 100 * s) / 2} ${(height - 60 * s) / 2}) scale(${s})`}>
          <Scene category={category} variant={hash(seed)} fill={`url(#ht-${id})`} ink={ink} />
        </g>
      ) : (
        // simple skyline shape so it reads as a photo, not an empty box
        <path
          d={`M0 ${height * 0.72} L${width * 0.12} ${height * 0.72} L${width * 0.12} ${height * 0.5} L${width * 0.24} ${height * 0.5} L${width * 0.24} ${height * 0.62} L${width * 0.4} ${height * 0.62} L${width * 0.4} ${height * 0.38} L${width * 0.5} ${height * 0.38} L${width * 0.5} ${height * 0.58} L${width * 0.7} ${height * 0.58} L${width * 0.7} ${height * 0.46} L${width * 0.82} ${height * 0.46} L${width * 0.82} ${height * 0.68} L${width} ${height * 0.68} L${width} ${height} L0 ${height} Z`}
          fill={`url(#ht-${id})`}
        />
      )}
      {category ? null : (
        <text x={width / 2} y={height / 2 + 3} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={9} letterSpacing={1} fill={palette.inkMuted}>
          [{label}]
        </text>
      )}
    </svg>
  );
}
