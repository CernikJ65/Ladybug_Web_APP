/**
 * PanelMapView v12 — Apple-clean s detailním vizuálem panelů.
 * - Sjednocená velikost karet (1 střecha = omezená šířka 520px, 2+ = grid)
 * - Větší plocha střechy (PAD 24), menší kompas (r 13) — lepší poměr
 * - Zachovaný 3D vizuál panelů (gradient, vnitřní linky, stín)
 * - Klasický kompas se S/J/V/Z pro jasnou orientaci
 * - Plná česká lokalizace včetně mapování názvů střech z HBJSON
 * - Rozměry střechy (šířka × hloubka) zobrazeny přímo nad/vedle plochy
 *
 * Soubor: ladybug_fe/src/components/analysis/solar/PanelMapView.tsx
 */
import React, { useMemo, useState } from 'react';

export interface WorldBounds {
  min_x: number; max_x: number; min_y: number; max_y: number;
  width_m: number; depth_m: number;
}
export interface RoofMeta {
  identifier: string; area_m2: number; tilt: number; azimuth: number;
  orientation: string; center: number[]; world_bounds?: WorldBounds;
}
interface Panel {
  id: number; roof_id: string; center: number[];
  tilt: number; azimuth: number; radiation_kwh_m2: number;
  annual_production_kwh: number; area_m2: number;
}
interface Props { panels: Panel[]; roofs?: RoofMeta[]; }

/* ───── Heat colors ───── */

function heatColor(t: number): string {
  const S: [number, number, number][] = [
    [99, 102, 241],   // indigo
    [16, 185, 129],   // emerald
    [234, 179, 8],    // yellow
    [249, 115, 22],   // orange
  ];
  const c = Math.max(0, Math.min(1, t)), s = c * (S.length - 1);
  const i = Math.min(Math.floor(s), S.length - 2), f = s - i, a = S[i], b = S[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

function heatColorLight(t: number): string {
  const S: [number, number, number][] = [
    [165, 180, 252],
    [110, 231, 183],
    [253, 224, 71],
    [253, 186, 116],
  ];
  const c = Math.max(0, Math.min(1, t)), s = c * (S.length - 1);
  const i = Math.min(Math.floor(s), S.length - 2), f = s - i, a = S[i], b = S[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

/* ───── Lokalizace ───── */

const CD = ['sever', 'severovýchod', 'východ', 'jihovýchod', 'jih', 'jihozápad', 'západ', 'severozápad'];
function azL(az: number) {
  return CD[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}

function orientationLabel(meta: RoofMeta | undefined, fallbackAz: number, tilt: number): string {
  if (tilt < 5) return 'plochá';
  if (meta?.orientation && meta.orientation !== 'Horizontal') {
    const map: Record<string, string> = {
      'North': 'sever', 'North-East': 'severovýchod', 'East': 'východ',
      'South-East': 'jihovýchod', 'South': 'jih', 'South-West': 'jihozápad',
      'West': 'západ', 'North-West': 'severozápad',
    };
    return map[meta.orientation] ?? azL(meta.azimuth);
  }
  return azL(meta?.azimuth ?? fallbackAz);
}

/* ───── Konstanty ───── */

const PW = 1.0, PH = 1.7;
const SVG_W = 420;
const SVG_H = 240;
const PAD = 24;

interface RVP {
  roofId: string; panels: Panel[]; roofMeta?: RoofMeta;
  gMinR: number; gMaxR: number;
}

const RoofView: React.FC<RVP> = ({ roofId, panels, roofMeta, gMinR, gMaxR }) => {
  const [hov, setHov] = useState<number | null>(null);

  const L = useMemo(() => {
    if (!panels.length) return null;
    let x0: number, x1: number, y0: number, y1: number;
    if (roofMeta?.world_bounds && roofMeta.world_bounds.width_m > 0) {
      x0 = roofMeta.world_bounds.min_x; x1 = roofMeta.world_bounds.max_x;
      y0 = roofMeta.world_bounds.min_y; y1 = roofMeta.world_bounds.max_y;
    } else {
      const xs = panels.map(p => p.center[0]), ys = panels.map(p => p.center[1]);
      const px = Math.max(2, (Math.max(...xs) - Math.min(...xs)) * 0.25);
      const py = Math.max(2, (Math.max(...ys) - Math.min(...ys)) * 0.25);
      x0 = Math.min(...xs) - px; x1 = Math.max(...xs) + px;
      y0 = Math.min(...ys) - py; y1 = Math.max(...ys) + py;
    }
    const wM = x1 - x0, hM = y1 - y0;
    const aW = SVG_W - 2 * PAD, aH = SVG_H - 2 * PAD;
    const sc = Math.min(aW / wM, aH / hM);
    const dW = wM * sc, dH = hM * sc;
    const ox = (SVG_W - dW) / 2, oy = (SVG_H - dH) / 2;
    const toS = (wx: number, wy: number) => ({ x: ox + (wx - x0) * sc, y: oy + (y1 - wy) * sc });
    const tr = (panels[0]?.tilt ?? 0) * Math.PI / 180;
    const pw = PW * sc, ph = PH * Math.cos(tr) * sc;
    const tP = panels.reduce((s, p) => s + p.annual_production_kwh, 0);
    const aR = panels.reduce((s, p) => s + p.radiation_kwh_m2, 0) / panels.length;
    return { ox, oy, dW, dH, wM, hM, toS, pw, ph, tP, aR };
  }, [panels, roofMeta]);

  if (!L) return null;
  const { ox, oy, dW, dH, wM, hM, toS, pw, ph, tP, aR } = L;
  const fmt = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });
  const tilt = roofMeta?.tilt ?? panels[0]?.tilt ?? 0;
  const ori = orientationLabel(roofMeta, panels[0]?.azimuth ?? 180, tilt);
  const uid = roofId.replace(/[^a-zA-Z0-9]/g, '_');

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid rgba(0,0,0,0.05)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}>
          <span style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: '#111827',
            letterSpacing: '-0.01em',
          }}>
            {panels.length} {panels.length === 1 ? 'panel' : panels.length < 5 ? 'panely' : 'panelů'}
          </span>
          <span style={{
            fontSize: 13,
            color: '#111827',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            textAlign: 'right',
          }}>
            {tilt < 5 ? 'plochá střecha' : `sklon ${tilt.toFixed(0)}°, orientace na ${ori}`}
          </span>
        </div>
      </div>

      {/* SVG mapa */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
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

        {/* Plocha střechy */}
        <rect
          x={ox} y={oy} width={dW} height={dH}
          fill="#fff"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth={1}
          rx={3}
          filter={`url(#shadow-${uid})`}
        />

        {/* Jemné vnitřní čárkované ohraničení (oddělení vnitřní pracovní plochy) */}
        <rect
          x={ox + 3} y={oy + 3} width={dW - 6} height={dH - 6}
          fill="none"
          stroke="rgba(99,102,241,0.18)"
          strokeWidth={0.5}
          strokeDasharray="3 3"
          rx={2}
        />

        {/* Panely */}
        {panels.map(p => {
          const t = gMaxR > gMinR ? (p.radiation_kwh_m2 - gMinR) / (gMaxR - gMinR) : 0.5;
          const { x, y } = toS(p.center[0], p.center[1]);
          const isH = hov === p.id;
          const col = heatColor(t);
          const px1 = x - pw / 2, py1 = y - ph / 2;
          return (
            <g
              key={p.id}
              onMouseEnter={() => setHov(p.id)}
              onMouseLeave={() => setHov(null)}
              style={{ cursor: 'pointer' }}
            >
              {isH && (
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
                fill={`url(#p-${uid}-${p.id})`}
                stroke={isH ? '#111827' : 'rgba(0,0,0,0.18)'}
                strokeWidth={isH ? 1.2 : 0.5}
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
        })}

        {/* Tooltip */}
        {hov !== null && (() => {
          const p = panels.find(pp => pp.id === hov);
          if (!p) return null;
          const { x, y } = toS(p.center[0], p.center[1]);
          const tw = 152, th = 44;
          let tx = x + pw / 2 + 8, ty = y - th / 2;
          if (tx + tw > SVG_W - 4) tx = x - pw / 2 - tw - 8;
          if (ty < 4) ty = 4;
          if (ty + th > SVG_H - 4) ty = SVG_H - th - 4;
          return (
            <g>
              <rect
                x={tx} y={ty}
                width={tw} height={th}
                rx={6}
                fill="#111827"
                fillOpacity={0.95}
              />
              <text
                x={tx + 10} y={ty + 17}
                fill="#fbbf24"
                fontSize={11}
                fontWeight={600}
                fontFamily="'JetBrains Mono', monospace"
              >
                {p.radiation_kwh_m2.toFixed(0)} kWh/m²
              </text>
              <text
                x={tx + 10} y={ty + 33}
                fill="#d1d5db"
                fontSize={10}
                fontFamily="'JetBrains Mono', monospace"
              >
                výroba {p.annual_production_kwh.toFixed(0)} kWh/rok
              </text>
            </g>
          );
        })()}

        {/* Rozměrový popisek šířky — pod plochou */}
        <text
          x={ox + dW / 2}
          y={oy + dH + 16}
          fill="#9ca3af"
          fontSize={9}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={500}
        >
          {wM.toFixed(1)} m
        </text>

        {/* Rozměrový popisek hloubky — vlevo od plochy */}
        <text
          x={ox - 10}
          y={oy + dH / 2}
          fill="#9ca3af"
          fontSize={9}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={500}
          transform={`rotate(-90, ${ox - 10}, ${oy + dH / 2})`}
        >
          {hM.toFixed(1)} m
        </text>

        {/* Kompas — kruhový terčík se 4 světovými stranami */}
        {(() => {
          const cx = SVG_W - 22, cy = 22, r = 13;
          return (
            <g>
              {/* Vnější kruh */}
              <circle
                cx={cx} cy={cy} r={r}
                fill="rgba(255,255,255,0.92)"
                stroke="rgba(0,0,0,0.1)"
                strokeWidth={0.7}
              />

              {/* Jemné křížové vodítko */}
              <line
                x1={cx - r + 3} y1={cy} x2={cx + r - 3} y2={cy}
                stroke="rgba(0,0,0,0.06)" strokeWidth={0.4}
              />
              <line
                x1={cx} y1={cy - r + 3} x2={cx} y2={cy + r - 3}
                stroke="rgba(0,0,0,0.06)" strokeWidth={0.4}
              />

              {/* Sever — červená šipka */}
              <polygon
                points={`${cx},${cy - r + 2.5} ${cx - 2.5},${cy - 0.5} ${cx + 2.5},${cy - 0.5}`}
                fill="#ef4444"
              />
              {/* Jih — šedá šipka */}
              <polygon
                points={`${cx},${cy + r - 2.5} ${cx - 2.5},${cy + 0.5} ${cx + 2.5},${cy + 0.5}`}
                fill="#cbd5e1"
              />

              {/* Písmena světových stran */}
              <text
                x={cx} y={cy - r + 0.5}
                fill="#ef4444"
                fontSize={6.5}
                fontWeight={700}
                textAnchor="middle"
                fontFamily="'Sora', sans-serif"
                dominantBaseline="auto"
              >
                S
              </text>
              <text
                x={cx} y={cy + r + 5}
                fill="#9ca3af"
                fontSize={6.5}
                fontWeight={600}
                textAnchor="middle"
                fontFamily="'Sora', sans-serif"
              >
                J
              </text>
              <text
                x={cx + r + 4} y={cy + 2.5}
                fill="#9ca3af"
                fontSize={6.5}
                fontWeight={600}
                textAnchor="middle"
                fontFamily="'Sora', sans-serif"
              >
                V
              </text>
              <text
                x={cx - r - 4} y={cy + 2.5}
                fill="#9ca3af"
                fontSize={6.5}
                fontWeight={600}
                textAnchor="middle"
                fontFamily="'Sora', sans-serif"
              >
                Z
              </text>

              {/* Středový bod */}
              <circle cx={cx} cy={cy} r={0.8} fill="#6b7280" />
            </g>
          );
        })()}
      </svg>

      {/* Footer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        borderTop: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ padding: '11px 16px' }}>
          <div style={{
            fontSize: 9,
            color: '#9ca3af',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 2,
          }}>
            Solární potenciál
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#111827',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '-0.01em',
          }}>
            {aR.toFixed(0)}
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: '#9ca3af',
              marginLeft: 4,
            }}>
              kWh/m²
            </span>
          </div>
        </div>
        <div style={{ padding: '11px 16px', textAlign: 'right' }}>
          <div style={{
            fontSize: 9,
            color: '#9ca3af',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 2,
          }}>
            Roční výroba
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#111827',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '-0.01em',
          }}>
            {fmt(tP)}
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: '#9ca3af',
              marginLeft: 4,
            }}>
              kWh
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const INITIAL_VISIBLE = 4;

const PanelMapView: React.FC<Props> = ({ panels, roofs }) => {
  const [showAll, setShowAll] = useState(false);

  const data = useMemo(() => {
    if (!panels.length) return null;
    const gMinR = Math.min(...panels.map(p => p.radiation_kwh_m2));
    const gMaxR = Math.max(...panels.map(p => p.radiation_kwh_m2));
    const tP = panels.reduce((s, p) => s + p.annual_production_kwh, 0);
    const rI = new Map<string, RoofMeta>();
    (roofs ?? []).forEach(r => rI.set(r.identifier, r));
    const rM = new Map<string, Panel[]>();
    panels.forEach(p => { if (!rM.has(p.roof_id)) rM.set(p.roof_id, []); rM.get(p.roof_id)!.push(p); });
    const gr = [...rM.entries()].sort((a, b) =>
      b[1].reduce((s, p) => s + p.annual_production_kwh, 0) -
      a[1].reduce((s, p) => s + p.annual_production_kwh, 0));
    return { gr, gMinR, gMaxR, tP, rI };
  }, [panels, roofs]);

  if (!data) return null;
  const { gr, tP } = data;
  const fmt = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });

  const needsPaging = gr.length > INITIAL_VISIBLE;
  const visible = showAll ? gr : gr.slice(0, INITIAL_VISIBLE);
  const hiddenCount = gr.length - INITIAL_VISIBLE;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid rgba(0,0,0,0.06)',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Hlavička panelu */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding: '16px 20px 14px',
      }}>
        <div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.015em',
          }}>
            Rozmístění panelů
          </div>
          <div style={{
            fontSize: 11,
            color: '#9ca3af',
            marginTop: 2,
            fontWeight: 400,
          }}>
            {panels.length} {panels.length === 1 ? 'panel' : panels.length < 5 ? 'panely' : 'panelů'} na {gr.length} {gr.length === 1 ? 'střeše' : gr.length < 5 ? 'střechách' : 'střechách'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#111827',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}>
            {fmt(tP)}
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              color: '#9ca3af',
              marginLeft: 4,
            }}>
              kWh
            </span>
          </div>
          <div style={{
            fontSize: 9,
            color: '#9ca3af',
            marginTop: 2,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            celková roční výroba
          </div>
        </div>
      </div>

      {/* Grid střech — pro 1 střechu omezíme šířku, pro 2+ klasický grid */}
      <div style={{
        padding: '4px 14px 14px',
        display: 'grid',
        gridTemplateColumns: gr.length === 1
          ? 'minmax(0, 520px)'
          : 'repeat(2, 1fr)',
        justifyContent: gr.length === 1 ? 'center' : 'stretch',
        gap: 12,
      }}>
        {visible.map(([rid, rp]) => (
          <RoofView
            key={rid}
            roofId={rid}
            panels={rp}
            roofMeta={data.rI.get(rid)}
            gMinR={data.gMinR}
            gMaxR={data.gMaxR}
          />
        ))}
      </div>

      {/* Stránkování */}
      {needsPaging && (
        <div style={{ padding: '0 14px 14px' }}>
          <button
            onClick={() => setShowAll(s => !s)}
            style={{
              width: '100%',
              padding: '9px 16px',
              background: '#fafbfc',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 500,
              color: '#374151',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              letterSpacing: '-0.005em',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#fafbfc';
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
            }}
          >
            {showAll
              ? `Skrýt ${hiddenCount} ${hiddenCount === 1 ? 'střechu' : hiddenCount < 5 ? 'střechy' : 'střech'}`
              : `Zobrazit ${hiddenCount} ${hiddenCount === 1 ? 'další střechu' : hiddenCount < 5 ? 'další střechy' : 'dalších střech'}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default PanelMapView;