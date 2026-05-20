import type { OrientedBox } from './panelMapTypes';

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

export function computeOrientedBoundingBox(rawPoints: Array<[number, number]>): OrientedBox | null {
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
