import React, { useMemo, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

export interface WorldBounds {
  min_x: number; max_x: number; min_y: number; max_y: number;
  width_m: number; depth_m: number;
}
export interface RoofMeta {
  identifier: string; area_m2: number; tilt: number; azimuth: number;
  orientation: string; center: number[]; world_bounds?: WorldBounds;
  /** Vrcholy polygonu hrany střechy v XY (world). Z backendu — viz solar_response.roof_world_polygon. */
  world_polygon?: number[][];
}
interface Panel {
  id: number; roof_id: string; center: number[];
  tilt: number; azimuth: number; radiation_kwh_m2: number;
  annual_production_kwh: number; area_m2: number;
}
interface Props { panels: Panel[]; roofs?: RoofMeta[]; panelOrder?: Map<number, number>; }

/* ──────────────────────────────────────────────────────────────────────
 * Oriented bounding box přes Andrew's monotone chain + rotating calipers
 * (stejný algoritmus jako HbjsonViewer/geometry.ts:orientedFootprintSize,
 *  rozšířený o rohy, střed a úhel rotace).
 *
 * Používá se POUZE pro:
 *   - rotaci světa tak, aby delší osa OBB byla vodorovně v SVG
 *   - dimensions labels (length × width "footprint")
 *   - fallback geometrie, když chybí world_polygon
 * Strecha samotná se vykresluje z world_polygon (může být L-tvar, T-tvar atd.).
 * ────────────────────────────────────────────────────────────────────── */

interface OrientedBox {
  cornersWorld: Array<[number, number]>;
  center: [number, number];
  length: number;     // delší strana
  width: number;      // kratší strana
  angleRad: number;   // úhel delší strany vůči world +X
}

function computeOrientedBoundingBox(rawPoints: Array<[number, number]>): OrientedBox | null {
  if (rawPoints.length === 0) return null;

  const seen = new Set<string>();
  const pts: Array<[number, number]> = [];
  for (const [x, y] of rawPoints) {
    const key = `${x.toFixed(3)},${y.toFixed(3)}`;
    if (!seen.has(key)) { seen.add(key); pts.push([x, y]); }
  }

  if (pts.length < 3) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, h = maxY - minY;
    return {
      cornersWorld: [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]],
      center: [(minX + maxX) / 2, (minY + maxY) / 2],
      length: Math.max(w, h),
      width: Math.min(w, h),
      angleRad: w >= h ? 0 : Math.PI / 2,
    };
  }

  pts.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
  const cross = (O: [number, number], A: [number, number], B: [number, number]) =>
    (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);

  const lower: Array<[number, number]> = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Array<[number, number]> = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));

  if (hull.length < 3) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return {
      cornersWorld: [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]],
      center: [(minX + maxX) / 2, (minY + maxY) / 2],
      length: Math.max(maxX - minX, maxY - minY),
      width: Math.min(maxX - minX, maxY - minY),
      angleRad: 0,
    };
  }

  let best: OrientedBox | null = null;
  let bestArea = Infinity;

  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i], p2 = hull[(i + 1) % hull.length];
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const ux = dx / len, uy = dy / len;
    const vx = -uy, vy = ux;

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = ux * p[0] + uy * p[1];
      const v = vx * p[0] + vy * p[1];
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const along = maxU - minU, across = maxV - minV;
    const area = along * across;

    if (area < bestArea) {
      bestArea = area;
      const toWorld = (u: number, v: number): [number, number] =>
        [u * ux + v * vx, u * uy + v * vy];
      const cornersWorld: Array<[number, number]> = [
        toWorld(minU, minV),
        toWorld(maxU, minV),
        toWorld(maxU, maxV),
        toWorld(minU, maxV),
      ];
      const cw = toWorld((minU + maxU) / 2, (minV + maxV) / 2);

      let length: number, width: number, angleRad: number;
      if (along >= across) {
        length = along; width = across;
        angleRad = Math.atan2(uy, ux);
      } else {
        length = across; width = along;
        angleRad = Math.atan2(vy, vx);
      }
      best = { cornersWorld, center: cw, length, width, angleRad };
    }
  }
  return best;
}

/* ────────────────────────────────────────────────────────────────────── */

function heatColor(t: number): string {
  const S: [number, number, number][] = [
    [99, 102, 241],
    [16, 185, 129],
    [234, 179, 8],
    [249, 115, 22],
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

const PW = 1.0, PH = 1.7;
const SVG_W = 420;
const PAD = 30;
const ROOFS_PER_PAGE = 2;

// Clamp aspect ratio pro adaptivni vysku SVG.
// Ctvercova strecha (aspect ≈ 1) by mela ploche SVG 1.2:1 (= 350px vysky pri 420 width).
// Protahla strecha (aspect ≥ 2.5) ma 2.5:1 (= 168px vysky).
// Tim se panely vzdy vykresli ve spravnych proporcich (PW × PH × Math.cos(tilt))
// a karty nejsou bud zbytecne vysoke (u dlouhych strech) nebo zmackle (u ctvercu).
const SVG_ASPECT_MIN = 1.2;
const SVG_ASPECT_MAX = 2.5;

// Vizuální mezera kolem polygonu v metrech (jen aby kompas/popisky neseděly přesně na hraně).
const VISUAL_PAD_M = 0.8;

// Fallback padding pro OBB ze středů panelů (kdyby chyběl world_polygon).
const PANELS_FALLBACK_PAD_M = 1.0;

interface RVP {
  roofId: string; panels: Panel[]; roofMeta?: RoofMeta;
  gMinR: number; gMaxR: number;
  panelOrder?: Map<number, number>;
}

const RoofView: React.FC<RVP> = ({ roofId, panels, roofMeta, gMinR, gMaxR, panelOrder }) => {
  const [hov, setHov] = useState<number | null>(null);

  const L = useMemo(() => {
    if (!panels.length) return null;

    // 1) OBB ze skutečných hran střechy (z backendu), s fallbackem na panel centers.
    //    OBB pouzivame VYHRADNE pro:
    //      - rotaci sveta tak, aby delsi osa byla vodorovne
    //      - dimensions labels (footprint length × width)
    //      - fallback obdelnik, kdyby chybel world_polygon
    let obb: OrientedBox | null = null;
    let dimsAreReal = false;
    let worldPolygonRaw: Array<[number, number]> | null = null;
    const wp = roofMeta?.world_polygon;

    if (wp && wp.length >= 3) {
      const polyPts: Array<[number, number]> = wp
        .filter(p => Array.isArray(p) && p.length >= 2)
        .map(p => [p[0], p[1]]);
      obb = computeOrientedBoundingBox(polyPts);
      dimsAreReal = obb !== null;
      worldPolygonRaw = polyPts;
    }

    if (!obb) {
      // Fallback — OBB z panel centers (rozmery budou menší než skutečná střecha)
      const panelPts: Array<[number, number]> = panels.map(p => [p.center[0], p.center[1]]);
      const obbRaw = computeOrientedBoundingBox(panelPts);
      if (obbRaw) {
        const ca0 = Math.cos(obbRaw.angleRad), sa0 = Math.sin(obbRaw.angleRad);
        const halfL0 = obbRaw.length / 2 + PANELS_FALLBACK_PAD_M;
        const halfW0 = obbRaw.width / 2 + PANELS_FALLBACK_PAD_M;
        const [cx0, cy0] = obbRaw.center;
        const cornersFallback: Array<[number, number]> = [
          [cx0 - halfL0 * ca0 + halfW0 * sa0, cy0 - halfL0 * sa0 - halfW0 * ca0],
          [cx0 + halfL0 * ca0 + halfW0 * sa0, cy0 + halfL0 * sa0 - halfW0 * ca0],
          [cx0 + halfL0 * ca0 - halfW0 * sa0, cy0 + halfL0 * sa0 + halfW0 * ca0],
          [cx0 - halfL0 * ca0 - halfW0 * sa0, cy0 - halfL0 * sa0 + halfW0 * ca0],
        ];
        obb = {
          cornersWorld: cornersFallback,
          center: obbRaw.center,
          length: obbRaw.length + 2 * PANELS_FALLBACK_PAD_M,
          width: obbRaw.width + 2 * PANELS_FALLBACK_PAD_M,
          angleRad: obbRaw.angleRad,
        };
        // Fallback polygon = OBB samotny (obdelnik)
        worldPolygonRaw = cornersFallback;
      }
    }
    if (!obb || !worldPolygonRaw) return null;

    // 2) Transformace world → rotated (rotace o -angle kolem středu OBB).
    //    V "rotated" world space je delší osa polygonu vodorovně.
    const [cx, cy] = obb.center;
    const ca = Math.cos(-obb.angleRad);
    const sa = Math.sin(-obb.angleRad);
    const worldToRotated = (wx: number, wy: number): [number, number] => {
      const dx = wx - cx, dy = wy - cy;
      return [dx * ca - dy * sa, dx * sa + dy * ca];
    };

    // 3) Polygon v rotovanych souradnicich
    const rotatedPolygon: Array<[number, number]> = worldPolygonRaw.map(
      ([wx, wy]) => worldToRotated(wx, wy)
    );

    // 4) Skutecny bbox rotovaneho polygonu (muze se lisit od OBB u L-tvaru — pak ne).
    //    Pro L-tvar (12x12 OBB) je polyBbox také 12x12. Pro obdelnik 30x5 oba 30x5.
    const rxs = rotatedPolygon.map(p => p[0]);
    const rys = rotatedPolygon.map(p => p[1]);
    const polyMinX = Math.min(...rxs), polyMaxX = Math.max(...rxs);
    const polyMinY = Math.min(...rys), polyMaxY = Math.max(...rys);
    const polyW = polyMaxX - polyMinX;
    const polyH = polyMaxY - polyMinY;

    // 5) Adaptivni vyska SVG — aspect ratio strechy clampovany na [SVG_ASPECT_MIN, SVG_ASPECT_MAX].
    //    Ctvercova strecha dostane 420x350 (1.2:1), protahla dostane 420x168 (2.5:1).
    //    Panely uvnitr maji vzdy uniformni meritko (jeden scale faktor pro X i Y),
    //    takze zustavaji ve spravnych proporcich 1.0x1.7 m.
    const rawAspect = polyH > 0 ? polyW / polyH : SVG_ASPECT_MIN;
    const displayAspect = Math.max(SVG_ASPECT_MIN, Math.min(SVG_ASPECT_MAX, rawAspect));
    const svgH = Math.round(SVG_W / displayAspect);

    // 6) Fitting polygonu do SVG s vizualnim paddingem v metrech kolem
    const fitW = polyW + 2 * VISUAL_PAD_M;
    const fitH = polyH + 2 * VISUAL_PAD_M;
    const aW = SVG_W - 2 * PAD, aH = svgH - 2 * PAD;
    const sc = Math.min(aW / fitW, aH / fitH);
    const dW = fitW * sc, dH = fitH * sc;
    const ox = (SVG_W - dW) / 2, oy = (svgH - dH) / 2;

    // 7) Mapovani rotated coords → SVG (Y flip kvuli SVG konvenci)
    const rotToS = (rx: number, ry: number) => ({
      x: ox + (rx - polyMinX + VISUAL_PAD_M) * sc,
      y: oy + (polyMaxY - ry + VISUAL_PAD_M) * sc,
    });
    const worldToS = (wx: number, wy: number) => {
      const [rx, ry] = worldToRotated(wx, wy);
      return rotToS(rx, ry);
    };

    // 8) SVG polygon points string — skutecny tvar strechy (L, T, obdelnik, ...)
    const svgPolyPoints = rotatedPolygon
      .map(([rx, ry]) => {
        const { x, y } = rotToS(rx, ry);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

    // 9) Bbox polygonu v SVG souradnicich — pro umisteni dimension labelu
    const bboxTopLeft = rotToS(polyMinX, polyMaxY);
    const bboxBotRight = rotToS(polyMaxX, polyMinY);

    const tr = (panels[0]?.tilt ?? 0) * Math.PI / 180;
    const pw = PW * sc, ph = PH * Math.cos(tr) * sc;
    const tP = panels.reduce((s, p) => s + p.annual_production_kwh, 0);
    const aR = panels.reduce((s, p) => s + p.radiation_kwh_m2, 0) / panels.length;

    // Kompas rotace v SVG (stupne, CW): rotace o +angle CCW sveta = +angle CW v SVG
    const compassRotateDeg = obb.angleRad * 180 / Math.PI;

    return {
      worldToS, pw, ph, tP, aR,
      svgPolyPoints,
      bboxTopLeft,
      bboxBotRight,
      realLength: obb.length,
      realWidth: obb.width,
      dimsAreReal,
      compassRotateDeg,
      svgH,
    };
  }, [panels, roofMeta]);

  if (!L) return null;
  const {
    worldToS, pw, ph, tP, aR,
    svgPolyPoints, bboxTopLeft, bboxBotRight,
    realLength, realWidth, dimsAreReal,
    compassRotateDeg, svgH,
  } = L;
  const fmt = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });
  const tilt = roofMeta?.tilt ?? panels[0]?.tilt ?? 0;
  const ori = orientationLabel(roofMeta, panels[0]?.azimuth ?? 180, tilt);
  const uid = roofId.replace(/[^a-zA-Z0-9]/g, '_');
  const roofNames = roofId.split('+').map(s => s.trim()).filter(Boolean);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid rgba(0,0,0,0.05)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {roofNames.map((name, idx) => (
                <span
                  key={`${name}-${idx}`}
                  title={name}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#111827',
                    letterSpacing: '-0.01em',
                    fontFamily: "'JetBrains Mono', monospace",
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
            <span style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: '#6b7280',
              letterSpacing: '-0.005em',
            }}>
              {panels.length} {panels.length === 1 ? 'panel' : panels.length < 5 ? 'panely' : 'panelů'}
            </span>
          </div>
          <span style={{
            fontSize: 13,
            color: '#111827',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            textAlign: 'right',
            paddingTop: 1,
          }}>
            {tilt < 5 ? 'plochá střecha' : `sklon ${tilt.toFixed(0)}°, orientace na ${ori}`}
          </span>
        </div>
      </div>

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
        {(() => {
          const cx = SVG_W - 22, cy = 22, r = 13;
          return (
            <g transform={`rotate(${compassRotateDeg.toFixed(2)}, ${cx}, ${cy})`}>
              <circle
                cx={cx} cy={cy} r={r}
                fill="rgba(255,255,255,0.92)"
                stroke="rgba(0,0,0,0.1)"
                strokeWidth={0.7}
              />
              <line
                x1={cx - r + 3} y1={cy} x2={cx + r - 3} y2={cy}
                stroke="rgba(0,0,0,0.06)" strokeWidth={0.4}
              />
              <line
                x1={cx} y1={cy - r + 3} x2={cx} y2={cy + r - 3}
                stroke="rgba(0,0,0,0.06)" strokeWidth={0.4}
              />
              <polygon
                points={`${cx},${cy - r + 2.5} ${cx - 2.5},${cy - 0.5} ${cx + 2.5},${cy - 0.5}`}
                fill="#ef4444"
              />
              <polygon
                points={`${cx},${cy + r - 2.5} ${cx - 2.5},${cy + 0.5} ${cx + 2.5},${cy + 0.5}`}
                fill="#cbd5e1"
              />
              {/* Counter-rotace textů, aby zůstaly čitelné */}
              <g transform={`rotate(${(-compassRotateDeg).toFixed(2)}, ${cx}, ${cy - r + 0.5})`}>
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
              </g>
              <g transform={`rotate(${(-compassRotateDeg).toFixed(2)}, ${cx}, ${cy + r + 5})`}>
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
              </g>
              <g transform={`rotate(${(-compassRotateDeg).toFixed(2)}, ${cx + r + 4}, ${cy + 2.5})`}>
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
              </g>
              <g transform={`rotate(${(-compassRotateDeg).toFixed(2)}, ${cx - r - 4}, ${cy + 2.5})`}>
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
              </g>
              <circle cx={cx} cy={cy} r={0.8} fill="#6b7280" />
            </g>
          );
        })()}

        {hov !== null && (() => {
          const p = panels.find(pp => pp.id === hov);
          if (!p) return null;
          const { x, y } = worldToS(p.center[0], p.center[1]);
          const ord = panelOrder?.get(p.id);
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
                {p.radiation_kwh_m2.toFixed(0)} kWh/m²
              </text>
              <text
                x={tx + 10} y={ty + yProd}
                fill="#d1d5db"
                fontSize={10}
                fontFamily="'JetBrains Mono', monospace"
              >
                výroba {p.annual_production_kwh.toFixed(0)} kWh/rok
              </text>
              <text
                x={tx + 10} y={ty + yCoord}
                fill="#9ca3af"
                fontSize={10}
                fontFamily="'JetBrains Mono', monospace"
              >
                x {p.center[0].toFixed(1)}  y {p.center[1].toFixed(1)} m
              </text>
            </g>
          );
        })()}
      </svg>

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

const PanelMapView: React.FC<Props> = ({ panels, roofs, panelOrder }) => {
  const [page, setPage] = useState(0);

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

  const pageCount = Math.ceil(gr.length / ROOFS_PER_PAGE);
  const needsPaging = gr.length > ROOFS_PER_PAGE;
  const safePage = Math.min(page, pageCount - 1);
  const visible = gr.slice(safePage * ROOFS_PER_PAGE, (safePage + 1) * ROOFS_PER_PAGE);

  const goPrev = () => setPage(p => Math.max(0, p - 1));
  const goNext = () => setPage(p => Math.min(pageCount - 1, p + 1));

  return (
    <div
      data-tour="panel-map"
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid rgba(0,0,0,0.06)',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
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

      <div style={{
        padding: '4px 14px 14px',
        display: 'grid',
        gridTemplateColumns: visible.length === 1
          ? 'minmax(0, 520px)'
          : 'repeat(2, 1fr)',
        justifyContent: visible.length === 1 ? 'center' : 'stretch',
        alignItems: 'start',
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
            panelOrder={panelOrder}
          />
        ))}
      </div>

      {needsPaging && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '4px 14px 16px',
        }}>
          <PagerButton
            disabled={safePage === 0}
            onClick={goPrev}
            ariaLabel="Předchozí stránka"
            icon={<FaChevronLeft />}
          />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 600,
            color: '#6b7280',
            letterSpacing: '-0.005em',
            minWidth: 56,
            textAlign: 'center',
          }}>
            <span style={{ color: '#111827' }}>{safePage + 1}</span>
            <span style={{ margin: '0 6px', color: '#cbd5e1' }}>/</span>
            <span>{pageCount}</span>
          </span>
          <PagerButton
            disabled={safePage === pageCount - 1}
            onClick={goNext}
            ariaLabel="Další stránka"
            icon={<FaChevronRight />}
          />
        </div>
      )}
    </div>
  );
};

const PagerButton: React.FC<{
  disabled: boolean;
  onClick: () => void;
  ariaLabel: string;
  icon: React.ReactNode;
}> = ({ disabled, onClick, ariaLabel, icon }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    style={{
      width: 32,
      height: 32,
      display: 'grid',
      placeItems: 'center',
      padding: 0,
      background: disabled ? '#f3f4f6' : '#fafbfc',
      border: '1px solid rgba(0, 0, 0, 0.06)',
      borderRadius: '50%',
      color: disabled ? '#cbd5e1' : '#374151',
      cursor: disabled ? 'default' : 'pointer',
      transition: 'all .15s',
      fontSize: 11,
    }}
    onMouseEnter={e => {
      if (disabled) return;
      e.currentTarget.style.background = '#f1f5f9';
      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.12)';
      e.currentTarget.style.color = '#111827';
    }}
    onMouseLeave={e => {
      if (disabled) return;
      e.currentTarget.style.background = '#fafbfc';
      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.06)';
      e.currentTarget.style.color = '#374151';
    }}
  >
    {icon}
  </button>
);

export default PanelMapView;