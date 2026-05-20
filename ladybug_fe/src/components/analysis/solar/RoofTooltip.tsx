import React from 'react';
import type { Panel } from './panelMapTypes';
import { SVG_W } from './panelMapConstants';
import { useT } from '../../../i18n/useT';

interface Props {
  panel: Panel;
  x: number;
  y: number;
  pw: number;
  svgH: number;
  ord?: number;
}

const RoofTooltip: React.FC<Props> = ({ panel, x, y, pw, svgH, ord }) => {
  const t = useT();
  const tw = 178, th = ord !== undefined ? 76 : 60;
  let tx = x + pw / 2 + 8, ty = y - th / 2;
  if (tx + tw > SVG_W - 4) tx = x - pw / 2 - tw - 8;
  if (ty < 4) ty = 4;
  if (ty + th > svgH - 4) ty = svgH - th - 4;
  const yRad = ord !== undefined ? 32 : 17;
  const yProd = ord !== undefined ? 48 : 33;
  const yCoord = ord !== undefined ? 64 : 49;

  return (
    <g>
      <rect
        x={tx} y={ty}
        width={tw} height={th}
        rx={6}
        fill="#111827"
        fillOpacity={0.95}
      />
      {ord !== undefined && (
        <text
          x={tx + 10} y={ty + 16}
          fill="#a5b4fc"
          fontSize={10.5}
          fontWeight={700}
          fontFamily="'JetBrains Mono', monospace"
        >
          #{ord} panel
        </text>
      )}
      <text
        x={tx + 10} y={ty + yRad}
        fill="#fbbf24"
        fontSize={11}
        fontWeight={600}
        fontFamily="'JetBrains Mono', monospace"
      >
        {panel.radiation_kwh_m2.toFixed(0)} kWh/m²
      </text>
      <text
        x={tx + 10} y={ty + yProd}
        fill="#d1d5db"
        fontSize={10}
        fontFamily="'JetBrains Mono', monospace"
      >
        {t('výroba')} {panel.annual_production_kwh.toFixed(0)} {t('kWh/rok')}
      </text>
      <text
        x={tx + 10} y={ty + yCoord}
        fill="#9ca3af"
        fontSize={10}
        fontFamily="'JetBrains Mono', monospace"
      >
        x {panel.center[0].toFixed(1)}  y {panel.center[1].toFixed(1)} m
      </text>
    </g>
  );
};

export default RoofTooltip;
