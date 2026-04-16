import * as THREE from 'three';
import type { RoomInfo, BuildingInfo } from './types';
import { orientedFootprintSize } from './geometry';

const ADJACENCY_TOL = 0.5;
const COLLINEAR_TOL = 0.3;
const ANGLE_SIN_TOL = 0.05;
const MIN_SHARED_LEN = 0.5;

function aabbsTouch(a: RoomInfo, b: RoomInfo, tol: number): boolean {
  return (
    a.maxX >= b.minX - tol && a.minX <= b.maxX + tol &&
    a.maxY >= b.minY - tol && a.minY <= b.maxY + tol &&
    a.maxZ >= b.minZ - tol && a.minZ <= b.maxZ + tol
  );
}

function sharedSegmentLength(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number
): number {
  const dx1 = ax2 - ax1, dy1 = ay2 - ay1;
  const len1 = Math.hypot(dx1, dy1);
  if (len1 < 1e-6) return 0;
  const ux = dx1 / len1, uy = dy1 / len1;
  const dx2 = bx2 - bx1, dy2 = by2 - by1;
  const len2 = Math.hypot(dx2, dy2);
  if (len2 < 1e-6) return 0;
  const vx = dx2 / len2, vy = dy2 / len2;
  const cross = Math.abs(ux * vy - uy * vx);
  if (cross > ANGLE_SIN_TOL) return 0;
  const px = bx1 - ax1, py = by1 - ay1;
  const perpDist = Math.abs(-uy * px + ux * py);
  if (perpDist > COLLINEAR_TOL) return 0;
  const t1b = len1;
  const t2a = ux * (bx1 - ax1) + uy * (by1 - ay1);
  const t2b = ux * (bx2 - ax1) + uy * (by2 - ay1);
  const t2lo = Math.min(t2a, t2b), t2hi = Math.max(t2a, t2b);
  return Math.max(0, Math.min(t1b, t2hi) - Math.max(0, t2lo));
}

function roomsShareWall(a: RoomInfo, b: RoomInfo): boolean {
  const ea = a.footprintEdges, eb = b.footprintEdges;
  for (let i = 0; i < ea.length; i += 4) {
    for (let j = 0; j < eb.length; j += 4) {
      if (sharedSegmentLength(ea[i], ea[i+1], ea[i+2], ea[i+3], eb[j], eb[j+1], eb[j+2], eb[j+3]) >= MIN_SHARED_LEN) return true;
    }
  }
  return false;
}

function buildBuildingFromGroup(memberIds: number[], rooms: RoomInfo[], bid: number, name: string): BuildingInfo {
  let faceCount = 0, area = 0;
  let minZ = Infinity, maxZ = -Infinity, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let cx = 0, cy = 0, cz = 0;
  const mergedRoof: number[] = [];
  for (const rid of memberIds) {
    const r = rooms[rid];
    faceCount += r.faceCount; area += r.area;
    minZ = Math.min(minZ, r.minZ); maxZ = Math.max(maxZ, r.maxZ);
    minX = Math.min(minX, r.minX); maxX = Math.max(maxX, r.maxX);
    minY = Math.min(minY, r.minY); maxY = Math.max(maxY, r.maxY);
    cx += r.center.x; cy += r.center.y; cz += r.center.z;
    for (let k = 0; k < r.roofPoints.length; k++) mergedRoof.push(r.roofPoints[k]);
  }
  const k = memberIds.length;
  const obb = orientedFootprintSize(new Float32Array(mergedRoof));
  return {
    id: bid, name, roomIds: memberIds, faceCount, area,
    minZ, maxZ, height: maxZ - minZ, minX, maxX, minY, maxY,
    roofWidth: obb.width, roofLength: obb.length,
    center: new THREE.Vector3(cx / k, cy / k, cz / k),
  };
}

export function clusterRoomsIntoBuildings(rooms: RoomInfo[]): BuildingInfo[] {
  const n = rooms.length;
  const allHaveId = n > 0 && rooms.every(r => typeof r.userBuildingId === 'string' && r.userBuildingId.length > 0);

  if (allHaveId) {
    const groupsById = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const id = rooms[i].userBuildingId!;
      if (!groupsById.has(id)) groupsById.set(id, []);
      groupsById.get(id)!.push(i);
    }
    const out: BuildingInfo[] = [];
    let bid = 0;
    for (const [name, memberIds] of groupsById.entries()) {
      out.push(buildBuildingFromGroup(memberIds, rooms, bid++, name));
    }
    return out;
  }

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const union = (i: number, j: number) => { const ri = find(i), rj = find(j); if (ri !== rj) parent[ri] = rj; };

  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (aabbsTouch(rooms[i], rooms[j], ADJACENCY_TOL) && roomsShareWall(rooms[i], rooms[j])) union(i, j);

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const buildings: BuildingInfo[] = [];
  let bid = 0;
  for (const memberIds of groups.values()) {
    buildings.push(buildBuildingFromGroup(memberIds, rooms, bid, `Budova_${bid + 1}`));
    bid++;
  }
  return buildings;
}
