import React from 'react';
import type { Panel } from './panelMapTypes';
import { heatColor } from './panelMapColors';

interface Props {
  panel: Panel;
  uid: string;
  pw: number;
  ph: number;
  x: number;
  y: number;
  isHovered: boolean;
  t: number;
  onHover: (id: number | null) => void;
}

const RoofPanelRect: React.FC<Props> = ({
  panel, uid, pw, ph, x, y, isHovered, t, onHover,
}) => {
  const col = heatColor(t);
  const px1 = x - pw / 2, py1 = y - ph / 2;

  return (
    <g
      onMouseEnter={() => onHover(panel.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      {isHovered && (
        <rect
          x={px1 - 2} y={py1 - 2}
          width={pw + 4} height={ph + 4}
          fill="none"
          stroke={col}
          strokeWidth={1.5}
          rx={2.5}
          opacity={0.5}
        >
          <animate
            attributeName="opacity"
            values="0.3;0.7;0.3"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      <rect
        x={px1 + 0.5} y={py1 + 0.7}
        width={pw} height={ph}
        fill="rgba(0,0,0,0.08)"
        rx={1.2}
      />

      <rect
        x={px1} y={py1}
        width={pw} height={ph}
        fill={`url(#p-${uid}-${panel.id})`}
        stroke={isHovered ? '#111827' : 'rgba(0,0,0,0.18)'}
        strokeWidth={isHovered ? 1.2 : 0.5}
        rx={1.2}
      />

      {pw > 6 && (
        <line
          x1={x} y1={py1 + 1}
          x2={x} y2={py1 + ph - 1}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={0.4}
        />
      )}
      {ph > 10 && pw > 5 && (
        <line
          x1={px1 + 1} y1={y}
          x2={px1 + pw - 1} y2={y}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={0.3}
        />
      )}

      {pw > 4 && ph > 4 && (
        <rect
          x={px1 + 0.5} y={py1 + 0.5}
          width={pw - 1}
          height={Math.max(1, ph * 0.22)}
          fill="rgba(255,255,255,0.18)"
          rx={0.8}
        />
      )}
    </g>
  );
};

export default RoofPanelRect;
