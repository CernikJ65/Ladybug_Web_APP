import { useMemo } from 'react';
import { computeOrientedBoundingBox } from './panelMapGeometry';
import type { OrientedBox, Panel, RoofMeta } from './panelMapTypes';
import {
  PW, PH, SVG_W, PAD,
  SVG_ASPECT_MIN, SVG_ASPECT_MAX,
  VISUAL_PAD_M, PANELS_FALLBACK_PAD_M,
} from './panelMapConstants';

export interface RoofLayout {
  worldToS: (wx: number, wy: number) => { x: number; y: number };
  pw: number;
  ph: number;
  tP: number;
  aR: number;
  svgPolyPoints: string;
  bboxTopLeft: { x: number; y: number };
  bboxBotRight: { x: number; y: number };
  realLength: number;
  realWidth: number;
  dimsAreReal: boolean;
  compassRotateDeg: number;
  svgH: number;
}

export function useRoofLayout(panels: Panel[], roofMeta?: RoofMeta): RoofLayout | null {
  return useMemo(() => {
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
}
