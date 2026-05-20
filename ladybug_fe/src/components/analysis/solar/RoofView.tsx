import React, { useState } from 'react';
import type { RoofViewProps } from './panelMapTypes';
import { heatColor, heatColorLight, orientationLabel } from './panelMapColors';
import { SVG_W } from './panelMapConstants';
import { useRoofLayout } from './useRoofLayout';
import RoofViewHeader from './RoofViewHeader';
import RoofViewFooter from './RoofViewFooter';
import RoofPanelRect from './RoofPanelRect';
import RoofCompass from './RoofCompass';
import RoofTooltip from './RoofTooltip';

const RoofView: React.FC<RoofViewProps> = ({
  roofId, panels, roofMeta, gMinR, gMaxR, panelOrder,
}) => {
  const [hov, setHov] = useState<number | null>(null);
  const L = useRoofLayout(panels, roofMeta);

  if (!L) return null;
  const {
    worldToS, pw, ph, tP, aR,
    svgPolyPoints, bboxTopLeft, bboxBotRight,
    realLength, realWidth, dimsAreReal,
    compassRotateDeg, svgH,
  } = L;

  const tilt = roofMeta?.tilt ?? panels[0]?.tilt ?? 0;
  const ori = orientationLabel(roofMeta, panels[0]?.azimuth ?? 180, tilt);
  const uid = roofId.replace(/[^a-zA-Z0-9]/g, '_');
  const hovered = hov !== null ? panels.find(pp => pp.id === hov) : null;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid rgba(0,0,0,0.05)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <RoofViewHeader
        roofId={roofId}
        panelsCount={panels.length}
        tilt={tilt}
        orientation={ori}
      />

      <svg
        viewBox={`0 0 ${SVG_W} ${svgH}`}
        width="100%"
        style={{
          display: 'block',
          background: '#fafbfc',
        }}
      >
        <defs>
          <filter id={`shadow-${uid}`}>
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.05" />
          </filter>
          {panels.map(p => {
            const t = gMaxR > gMinR ? (p.radiation_kwh_m2 - gMinR) / (gMaxR - gMinR) : 0.5;
            return (
              <linearGradient key={p.id} id={`p-${uid}-${p.id}`} x1="0" y1="0" x2="0.2" y2="1">
                <stop offset="0%" stopColor={heatColorLight(t)} stopOpacity={0.7} />
                <stop offset="100%" stopColor={heatColor(t)} stopOpacity={0.95} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Strecha kreslena jako polygon — respektuje skutecny tvar (L, T, obdelnik, ...) */}
        <polygon
          points={svgPolyPoints}
          fill="#fff"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth={1}
          strokeLinejoin="round"
          filter={`url(#shadow-${uid})`}
        />

        {panels.map(p => {
          const t = gMaxR > gMinR ? (p.radiation_kwh_m2 - gMinR) / (gMaxR - gMinR) : 0.5;
          const { x, y } = worldToS(p.center[0], p.center[1]);
          return (
            <RoofPanelRect
              key={p.id}
              panel={p}
              uid={uid}
              pw={pw}
              ph={ph}
              x={x}
              y={y}
              isHovered={hov === p.id}
              t={t}
              onHover={setHov}
            />
          );
        })}

        {/* Dimension popisky vedle bbox polygonu — ukazuji "footprint" rozmery (OBB).
            U L-tvaru oba rozmery 12 m (= velikost obalove bounding boxu). */}
        <text
          x={(bboxTopLeft.x + bboxBotRight.x) / 2}
          y={bboxBotRight.y + 14}
          fill="#9ca3af"
          fontSize={9.5}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={500}
        >
          {realLength.toFixed(1)} m{!dimsAreReal ? ' *' : ''}
        </text>
        <text
          x={bboxTopLeft.x - 12}
          y={(bboxTopLeft.y + bboxBotRight.y) / 2}
          fill="#9ca3af"
          fontSize={9.5}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={500}
          transform={`rotate(-90, ${bboxTopLeft.x - 12}, ${(bboxTopLeft.y + bboxBotRight.y) / 2})`}
        >
          {realWidth.toFixed(1)} m{!dimsAreReal ? ' *' : ''}
        </text>

        {/* Kompas — rotován o úhel orientace střechy. S ukazuje do skutečného světa. */}
        <RoofCompass compassRotateDeg={compassRotateDeg} />

        {hovered && (() => {
          const { x, y } = worldToS(hovered.center[0], hovered.center[1]);
          return (
            <RoofTooltip
              panel={hovered}
              x={x}
              y={y}
              pw={pw}
              svgH={svgH}
              ord={panelOrder?.get(hovered.id)}
            />
          );
        })()}
      </svg>

      <RoofViewFooter avgRadiation={aR} totalProduction={tP} />
    </div>
  );
};

export default RoofView;
