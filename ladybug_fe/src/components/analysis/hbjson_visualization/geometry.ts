import * as THREE from 'three';

export const HOVER_CLR = [1.0, 1.0, 0.15] as const;
export const SELECT_CLR = [1.0, 0.45, 0.0] as const;
export const BOX_CLR = [0.6, 0.2, 0.95] as const;

export function hbjsonToScreen(c: number[]): THREE.Vector3 {
  return new THREE.Vector3(c[0], c[2], -c[1]);
}

export function triangulateBoundary(boundary: number[][]): number[][] | null {
  if (boundary.length < 3) return null;
  const tris: number[][] = [];
  for (let i = 1; i < boundary.length - 1; i++) {
    tris.push(boundary[0], boundary[i], boundary[i + 1]);
  }
  return tris;
}

export function computeFaceArea(boundary: number[][]): number {
  let area = 0;
  const o = boundary[0];
  for (let i = 1; i < boundary.length - 1; i++) {
    const ax = boundary[i][0] - o[0], ay = boundary[i][1] - o[1], az = boundary[i][2] - o[2];
    const bx = boundary[i + 1][0] - o[0], by = boundary[i + 1][1] - o[1], bz = boundary[i + 1][2] - o[2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    area += Math.sqrt(cx * cx + cy * cy + cz * cz) * 0.5;
  }
  return area;
}

export function orientedFootprintSize(xyPoints: Float32Array): { width: number; length: number } {
  if (xyPoints.length < 6) return { width: 0, length: 0 };

  const seen = new Set<string>();
  const pts: [number, number][] = [];
  for (let i = 0; i < xyPoints.length; i += 2) {
    const x = xyPoints[i], y = xyPoints[i + 1];
    const key = `${x.toFixed(3)},${y.toFixed(3)}`;
    if (!seen.has(key)) { seen.add(key); pts.push([x, y]); }
  }
  if (pts.length < 3) return { width: 0, length: 0 };

  pts.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
  const cross = (O: [number, number], A: [number, number], B: [number, number]) =>
    (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);

  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));

  if (hull.length < 3) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
    }
    const w = maxX - minX, l = maxY - minY;
    return { width: Math.min(w, l), length: Math.max(w, l) };
  }

  let bestArea = Infinity, bestW = 0, bestL = 0;
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
    if (area < bestArea) { bestArea = area; bestW = Math.min(along, across); bestL = Math.max(along, across); }
  }
  return { width: bestW, length: bestL };
}

export function heightColor(z: number, minZ: number, maxZ: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (z - minZ) / (maxZ - minZ + 0.001)));
  const lightness = 0.45 + t * 0.35;
  return new THREE.Color().setHSL(0, 0, lightness);
}
