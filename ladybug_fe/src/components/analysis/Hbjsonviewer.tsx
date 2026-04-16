import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FaArrowLeft } from 'react-icons/fa';
import './HbjsonViewer.css';

/* ═══════════════════════════════════════════════════════════════
   TYPES – Honeybee JSON schema
   ═══════════════════════════════════════════════════════════════ */

interface HBGeometry {
  type: string;
  boundary: number[][];
  plane?: { n: number[]; o: number[]; x?: number[] };
}

interface HBFace {
  type: string;
  identifier: string;
  display_name?: string;
  geometry: HBGeometry;
  face_type?: string;
  boundary_condition?: { type: string; [key: string]: unknown };
}

interface HBRoom {
  type: string;
  identifier: string;
  display_name?: string;
  faces: HBFace[];
  user_data?: Record<string, unknown>;
}

interface HBShade {
  type: string;
  identifier?: string;
  display_name?: string;
  geometry: HBGeometry;
}

interface HBJSONData {
  type?: string;
  identifier?: string;
  display_name?: string;
  version?: string;
  units?: string;
  rooms?: HBRoom[];
  orphaned_shades?: HBShade[];
  shades?: HBShade[];
}

interface RoomInfo {
  id: number;
  name: string;
  vertexStart: number;
  vertexCount: number;
  faceCount: number;
  wallCount: number;
  floorCount: number;
  roofCount: number;
  area: number;
  height: number;
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
  center: THREE.Vector3;
  footprintEdges: Float32Array;
  roofPoints: Float32Array;
  roofWidth: number;
  roofLength: number;
  userBuildingId?: string;
}

interface BuildingInfo {
  id: number;
  name: string;
  roomIds: number[];
  faceCount: number;
  area: number;
  minZ: number;
  maxZ: number;
  height: number;
  minX: number; maxX: number;
  minY: number; maxY: number;
  roofWidth: number;
  roofLength: number;
  center: THREE.Vector3;
}

interface ModelStats {
  name: string;
  version: string;
  units: string;
  faceCount: number;
  roomCount: number;
  buildingCount: number;
  shadeCount: number;
  dimensions: { x: number; y: number; z: number };
}

type ViewMode = 'rooms' | 'buildings';

interface Props {
  onBack: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const HOVER_CLR = [1.0, 1.0, 0.15] as const;
const SELECT_CLR = [1.0, 0.45, 0.0] as const;
const BOX_CLR = [0.6, 0.2, 0.95] as const;

const ADJACENCY_TOL = 0.5;
const COLLINEAR_TOL = 0.3;
const ANGLE_SIN_TOL = 0.05;
const MIN_SHARED_LEN = 0.5;

function hbjsonToScreen(c: number[]): THREE.Vector3 {
  return new THREE.Vector3(c[0], c[2], -c[1]);
}

function triangulateBoundary(boundary: number[][]): number[][] | null {
  if (boundary.length < 3) return null;
  const tris: number[][] = [];
  for (let i = 1; i < boundary.length - 1; i++) {
    tris.push(boundary[0], boundary[i], boundary[i + 1]);
  }
  return tris;
}

function computeFaceArea(boundary: number[][]): number {
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

function orientedFootprintSize(xyPoints: Float32Array): { width: number; length: number } {
  if (xyPoints.length < 6) return { width: 0, length: 0 };

  const seen = new Set<string>();
  const pts: [number, number][] = [];
  for (let i = 0; i < xyPoints.length; i += 2) {
    const x = xyPoints[i], y = xyPoints[i + 1];
    const key = `${x.toFixed(3)},${y.toFixed(3)}`;
    if (!seen.has(key)) {
      seen.add(key);
      pts.push([x, y]);
    }
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

  let bestArea = Infinity;
  let bestW = 0, bestL = 0;
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i], p2 = hull[(i + 1) % hull.length];
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const ux = dx / len, uy = dy / len;
    const vx = -uy, vy = ux;

    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = ux * p[0] + uy * p[1];
      const v = vx * p[0] + vy * p[1];
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const along = maxU - minU;
    const across = maxV - minV;
    const area = along * across;
    if (area < bestArea) {
      bestArea = area;
      bestW = Math.min(along, across);
      bestL = Math.max(along, across);
    }
  }
  return { width: bestW, length: bestL };
}

function heightColor(z: number, minZ: number, maxZ: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (z - minZ) / (maxZ - minZ + 0.001)));
  const lightness = 0.45 + t * 0.35;
  return new THREE.Color().setHSL(0, 0, lightness);
}

/* ─── Shared-wall geometric clustering via Union-Find ──────── */

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

  const t1a = 0, t1b = len1;
  const t2a = ux * (bx1 - ax1) + uy * (by1 - ay1);
  const t2b = ux * (bx2 - ax1) + uy * (by2 - ay1);
  const t2lo = Math.min(t2a, t2b), t2hi = Math.max(t2a, t2b);

  return Math.max(0, Math.min(t1b, t2hi) - Math.max(t1a, t2lo));
}

function roomsShareWall(a: RoomInfo, b: RoomInfo): boolean {
  const ea = a.footprintEdges, eb = b.footprintEdges;
  for (let i = 0; i < ea.length; i += 4) {
    for (let j = 0; j < eb.length; j += 4) {
      const len = sharedSegmentLength(
        ea[i], ea[i + 1], ea[i + 2], ea[i + 3],
        eb[j], eb[j + 1], eb[j + 2], eb[j + 3]
      );
      if (len >= MIN_SHARED_LEN) return true;
    }
  }
  return false;
}

function clusterRoomsIntoBuildings(rooms: RoomInfo[]): BuildingInfo[] {
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
      let faceCount = 0, area = 0;
      let minZ = Infinity, maxZ = -Infinity;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
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
      out.push({
        id: bid, name, roomIds: memberIds,
        faceCount, area,
        minZ, maxZ, height: maxZ - minZ,
        minX, maxX, minY, maxY,
        roofWidth: obb.width, roofLength: obb.length,
        center: new THREE.Vector3(cx / k, cy / k, cz / k),
      });
      bid++;
    }
    return out;
  }

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const union = (i: number, j: number) => {
    const ri = find(i), rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!aabbsTouch(rooms[i], rooms[j], ADJACENCY_TOL)) continue;
      if (roomsShareWall(rooms[i], rooms[j])) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const buildings: BuildingInfo[] = [];
  let bid = 0;
  for (const memberIds of groups.values()) {
    let faceCount = 0, area = 0;
    let minZ = Infinity, maxZ = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let cx = 0, cy = 0, cz = 0;
    const mergedRoof: number[] = [];
    for (const rid of memberIds) {
      const r = rooms[rid];
      faceCount += r.faceCount;
      area += r.area;
      minZ = Math.min(minZ, r.minZ);
      maxZ = Math.max(maxZ, r.maxZ);
      minX = Math.min(minX, r.minX);
      maxX = Math.max(maxX, r.maxX);
      minY = Math.min(minY, r.minY);
      maxY = Math.max(maxY, r.maxY);
      cx += r.center.x; cy += r.center.y; cz += r.center.z;
      for (let k = 0; k < r.roofPoints.length; k++) mergedRoof.push(r.roofPoints[k]);
    }
    const k = memberIds.length;
    const obb = orientedFootprintSize(new Float32Array(mergedRoof));
    buildings.push({
      id: bid,
      name: `Budova_${bid + 1}`,
      roomIds: memberIds,
      faceCount,
      area,
      minZ,
      maxZ,
      height: maxZ - minZ,
      minX, maxX, minY, maxY,
      roofWidth: obb.width, roofLength: obb.length,
      center: new THREE.Vector3(cx / k, cy / k, cz / k),
    });
    bid++;
  }
  return buildings;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

const HbjsonViewer: React.FC<Props> = ({ onBack }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const solidMeshRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const groundRef = useRef<THREE.Mesh | null>(null);

  const originalColorsRef = useRef<Float32Array | null>(null);
  const triangleToRoomRef = useRef<Int32Array>(new Int32Array(0));
  const roomsDataRef = useRef<RoomInfo[]>([]);
  const buildingsDataRef = useRef<BuildingInfo[]>([]);
  const roomToBuildingRef = useRef<Int32Array>(new Int32Array(0));
  const originalDataRef = useRef<HBJSONData | null>(null);

  const selectedIdsRef = useRef<Set<number>>(new Set());
  const hoveredIdRef = useRef<number | null>(null);
  const viewModeRef = useRef<ViewMode>('buildings');

  const raycasterRef = useRef(new THREE.Raycaster());
  const cameraTargetRef = useRef(new THREE.Vector3());
  const targetZoomRef = useRef(500);
  const initialCamRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const mouseDownTimeRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  const lastRaycastRef = useRef(0);

  const isBoxSelectingRef = useRef(false);
  const boxStartRef = useRef({ x: 0, y: 0 });
  const boxEndRef = useRef({ x: 0, y: 0 });
  const boxElRef = useRef<HTMLDivElement | null>(null);

  const opacityRef = useRef(85);
  const highlightHoverRef = useRef(true);

  const buildModelFnRef = useRef<((data: HBJSONData) => void) | null>(null);
  const clearSelectionFnRef = useRef<(() => void) | null>(null);
  const selectByIdFnRef = useRef<((id: number, additive: boolean) => void) | null>(null);
  const exportSelectedFnRef = useRef<(() => void) | null>(null);

  const [stats, setStats] = useState<ModelStats | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [buildings, setBuildings] = useState<BuildingInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [opacity, setOpacity] = useState(85);
  const [showGrid, setShowGrid] = useState(true);
  const [highlightHover, setHighlightHover] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('buildings');
  const [panelOpen, setPanelOpen] = useState(true);

  /* ─── Color buffer helpers ─────────────────────────────────── */

  const paintRoomVertices = useCallback((roomId: number, r: number, g: number, b: number) => {
    const mesh = solidMeshRef.current;
    if (!mesh) return;
    const attr = mesh.geometry.attributes.color as THREE.BufferAttribute;
    const room = roomsDataRef.current[roomId];
    if (!room) return;
    const arr = attr.array as Float32Array;
    const end = room.vertexStart + room.vertexCount;
    for (let i = room.vertexStart; i < end; i++) {
      arr[i * 3] = r; arr[i * 3 + 1] = g; arr[i * 3 + 2] = b;
    }
    attr.needsUpdate = true;
  }, []);

  const restoreRoomVertices = useCallback((roomId: number) => {
    const mesh = solidMeshRef.current;
    const orig = originalColorsRef.current;
    if (!mesh || !orig) return;
    const attr = mesh.geometry.attributes.color as THREE.BufferAttribute;
    const room = roomsDataRef.current[roomId];
    if (!room) return;
    const arr = attr.array as Float32Array;
    const end = room.vertexStart + room.vertexCount;
    for (let i = room.vertexStart; i < end; i++) {
      arr[i * 3] = orig[i * 3]; arr[i * 3 + 1] = orig[i * 3 + 1]; arr[i * 3 + 2] = orig[i * 3 + 2];
    }
    attr.needsUpdate = true;
  }, []);

  const paintEntity = useCallback((entityId: number, r: number, g: number, b: number) => {
    if (viewModeRef.current === 'buildings') {
      const b_ = buildingsDataRef.current[entityId];
      if (!b_) return;
      for (const rid of b_.roomIds) paintRoomVertices(rid, r, g, b);
    } else {
      paintRoomVertices(entityId, r, g, b);
    }
  }, [paintRoomVertices]);

  const restoreEntity = useCallback((entityId: number) => {
    if (viewModeRef.current === 'buildings') {
      const b_ = buildingsDataRef.current[entityId];
      if (!b_) return;
      for (const rid of b_.roomIds) restoreRoomVertices(rid);
    } else {
      restoreRoomVertices(entityId);
    }
  }, [restoreRoomVertices]);

  /* ─── Main Three.js effect ─────────────────────────────────── */

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 2000, 6000);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.5, 15000);
    camera.position.set(500, 300, 500);
    camera.lookAt(cameraTargetRef.current);
    cameraRef.current = camera;
    targetZoomRef.current = camera.position.distanceTo(cameraTargetRef.current);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(500, 800, 500);
    sun.castShadow = true;
    sun.shadow.camera.left = -1000; sun.shadow.camera.right = 1000;
    sun.shadow.camera.top = 1000; sun.shadow.camera.bottom = -1000;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-400, 200, -400);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0x888888, 0x444444, 0.35));

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(5000, 5000),
      new THREE.MeshLambertMaterial({ color: 0x0a0a0a, side: THREE.DoubleSide })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    groundRef.current = ground;

    const grid = new THREE.GridHelper(2000, 100, 0x333333, 0x1a1a1a);
    grid.position.y = 0.1;
    scene.add(grid);
    gridRef.current = grid;

    const boxEl = document.createElement('div');
    boxEl.className = 'hbjson-viewer__box-select';
    container.appendChild(boxEl);
    boxElRef.current = boxEl;

    /* ─── Build model from HBJSON data ─────────────────────── */

    const buildModel = (data: HBJSONData) => {
      originalDataRef.current = data;

      if (solidMeshRef.current) {
        solidMeshRef.current.geometry.dispose();
        (solidMeshRef.current.material as THREE.Material).dispose();
        scene.remove(solidMeshRef.current);
        solidMeshRef.current = null;
      }

      selectedIdsRef.current.clear();
      hoveredIdRef.current = null;
      setSelectedIds(new Set());
      setHoveredId(null);

      const hbRooms = data.rooms || [];
      const hbShades = data.orphaned_shades || data.shades || [];

      if (hbRooms.length === 0 && hbShades.length === 0) {
        setStats(null);
        setRooms([]);
        setBuildings([]);
        return;
      }

      let globalMinZ = Infinity, globalMaxZ = -Infinity;
      const scanBoundary = (b: number[][]) => {
        for (const c of b) { globalMinZ = Math.min(globalMinZ, c[2]); globalMaxZ = Math.max(globalMaxZ, c[2]); }
      };
      for (const room of hbRooms) for (const f of room.faces) scanBoundary(f.geometry.boundary);
      for (const s of hbShades) scanBoundary(s.geometry.boundary);

      const positions: number[] = [];
      const normals: number[] = [];
      const colors: number[] = [];
      const triToRoom: number[] = [];
      const roomInfos: RoomInfo[] = [];

      let totalFaces = 0;

      const addFace = (boundary: number[][], _faceType: string | undefined, roomId: number) => {
        if (boundary.length < 3) return;
        const tris = triangulateBoundary(boundary);
        if (!tris) return;

        const avgZ = boundary.reduce((s, c) => s + c[2], 0) / boundary.length;
        const clr = heightColor(avgZ, globalMinZ, globalMaxZ);

        const p0 = hbjsonToScreen(boundary[0]);
        const p1 = hbjsonToScreen(boundary[1]);
        const p2 = hbjsonToScreen(boundary[2]);
        const faceNormal = new THREE.Vector3()
          .crossVectors(p1.clone().sub(p0), p2.clone().sub(p0));
        if (faceNormal.lengthSq() < 1e-8) return;
        faceNormal.normalize();

        for (let t = 0; t < tris.length; t += 3) {
          const a = hbjsonToScreen(tris[t]);
          const b = hbjsonToScreen(tris[t + 1]);
          const c = hbjsonToScreen(tris[t + 2]);
          const triArea = new THREE.Vector3()
            .crossVectors(b.clone().sub(a), c.clone().sub(a)).length();
          if (triArea < 1e-6) continue;
          positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
          normals.push(
            faceNormal.x, faceNormal.y, faceNormal.z,
            faceNormal.x, faceNormal.y, faceNormal.z,
            faceNormal.x, faceNormal.y, faceNormal.z
          );
          colors.push(clr.r, clr.g, clr.b, clr.r, clr.g, clr.b, clr.r, clr.g, clr.b);
          triToRoom.push(roomId);
        }

        totalFaces++;
      };

      for (let ri = 0; ri < hbRooms.length; ri++) {
        const room = hbRooms[ri];
        const vertStart = positions.length / 3;
        let area = 0, wallC = 0, floorC = 0, roofC = 0;
        let rMinX = Infinity, rMaxX = -Infinity;
        let rMinY = Infinity, rMaxY = -Infinity;
        let rMinZ = Infinity, rMaxZ = -Infinity;
        let cx = 0, cy = 0, cz = 0, ptCount = 0;

        const fpEdges: number[] = [];
        const roofPts: number[] = [];

        for (const face of room.faces) {
          const b = face.geometry.boundary;
          if (b.length < 3) continue;
          addFace(b, face.face_type, ri);
          area += computeFaceArea(b);
          if (face.face_type === 'Wall') wallC++;
          else if (face.face_type === 'Floor') {
            floorC++;
            if (fpEdges.length === 0) {
              for (let k = 0; k < b.length; k++) {
                const p1 = b[k], p2 = b[(k + 1) % b.length];
                fpEdges.push(p1[0], p1[1], p2[0], p2[1]);
              }
            }
            for (const c of b) roofPts.push(c[0], c[1]);
          }
          else if (face.face_type === 'RoofCeiling') roofC++;
          for (const c of b) {
            rMinX = Math.min(rMinX, c[0]); rMaxX = Math.max(rMaxX, c[0]);
            rMinY = Math.min(rMinY, c[1]); rMaxY = Math.max(rMaxY, c[1]);
            rMinZ = Math.min(rMinZ, c[2]); rMaxZ = Math.max(rMaxZ, c[2]);
            cx += c[0]; cy += c[1]; cz += c[2]; ptCount++;
          }
        }

        if (fpEdges.length === 0) {
          for (const face of room.faces) {
            if (face.face_type !== 'Wall') continue;
            const b = face.geometry.boundary;
            const sorted = [...b].sort((u, v) => u[2] - v[2]);
            if (sorted.length >= 2) {
              fpEdges.push(sorted[0][0], sorted[0][1], sorted[1][0], sorted[1][1]);
            }
          }
        }

        const vertCount = positions.length / 3 - vertStart;
        const ud = (room.user_data || {}) as Record<string, unknown>;
        const ubid = typeof ud['building_id'] === 'string' ? (ud['building_id'] as string) : undefined;
        const fpArr = new Float32Array(fpEdges);
        const roofPtsArr = new Float32Array(roofPts);
        const obb = orientedFootprintSize(roofPtsArr);
        roomInfos.push({
          id: ri,
          name: room.display_name || room.identifier || `Room_${ri}`,
          vertexStart: vertStart,
          vertexCount: vertCount,
          faceCount: room.faces.length,
          wallCount: wallC,
          floorCount: floorC,
          roofCount: roofC,
          area,
          height: rMaxZ - rMinZ,
          minX: rMinX, maxX: rMaxX,
          minY: rMinY, maxY: rMaxY,
          minZ: rMinZ, maxZ: rMaxZ,
          center: ptCount > 0
            ? new THREE.Vector3(cx / ptCount, cz / ptCount, -cy / ptCount)
            : new THREE.Vector3(),
          footprintEdges: fpArr,
          roofPoints: roofPtsArr,
          roofWidth: obb.width,
          roofLength: obb.length,
          userBuildingId: ubid,
        });
      }

      for (const shade of hbShades) {
        addFace(shade.geometry.boundary, undefined, -1);
      }

      const posArr = new Float32Array(positions);
      const normArr = new Float32Array(normals);
      const colArr = new Float32Array(colors);

      originalColorsRef.current = new Float32Array(colArr);
      triangleToRoomRef.current = new Int32Array(triToRoom);
      roomsDataRef.current = roomInfos;

      const buildingsList = clusterRoomsIntoBuildings(roomInfos);
      buildingsDataRef.current = buildingsList;

      const r2b = new Int32Array(roomInfos.length);
      for (const b of buildingsList) {
        for (const rid of b.roomIds) r2b[rid] = b.id;
      }
      roomToBuildingRef.current = r2b;

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      geom.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

      const op = opacityRef.current / 100;
      const solidMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: op < 1,
        opacity: op
      });
      const solid = new THREE.Mesh(geom, solidMat);
      solid.castShadow = totalFaces < 5000;
      solid.receiveShadow = true;
      scene.add(solid);
      solidMeshRef.current = solid;

      const box = new THREE.Box3().setFromBufferAttribute(geom.attributes.position as THREE.BufferAttribute);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = maxDim / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.8;

      cameraTargetRef.current.copy(center);
      if (groundRef.current) groundRef.current.position.y = box.min.y - 1;
      if (gridRef.current) gridRef.current.position.y = box.min.y - 0.9;

      const angle = Math.PI / 4;
      camera.position.set(
        center.x + dist * Math.cos(angle),
        center.y + dist * 0.6,
        center.z + dist * Math.sin(angle)
      );
      camera.lookAt(center);
      camera.near = Math.max(0.5, dist * 0.001);
      camera.far = Math.max(15000, dist * 10);
      camera.updateProjectionMatrix();
      targetZoomRef.current = camera.position.distanceTo(center);
      initialCamRef.current = { pos: camera.position.clone(), target: center.clone() };

      setRooms([...roomInfos]);
      setBuildings([...buildingsList]);
      setStats({
        name: data.display_name || data.identifier || 'Model',
        version: data.version || '?',
        units: data.units || 'Meters',
        faceCount: totalFaces,
        roomCount: hbRooms.length,
        buildingCount: buildingsList.length,
        shadeCount: hbShades.length,
        dimensions: { x: size.x, y: size.y, z: size.z },
      });
    };

    /* ─── Selection logic ──────────────────────────────────── */

    const selectEntity = (entityId: number, additive: boolean) => {
      const prev = selectedIdsRef.current;

      if (!additive) {
        prev.forEach(id => restoreEntity(id));
        prev.clear();
      }

      if (prev.has(entityId)) {
        prev.delete(entityId);
        restoreEntity(entityId);
      } else {
        prev.add(entityId);
        paintEntity(entityId, ...SELECT_CLR);
      }

      const next = new Set(prev);
      selectedIdsRef.current = next;
      setSelectedIds(next);
    };

    const clearSelection = () => {
      selectedIdsRef.current.forEach(id => restoreEntity(id));
      selectedIdsRef.current.clear();
      setSelectedIds(new Set());
    };

    const boxSelect = () => {
      if (!cameraRef.current || !containerRef.current) return;
      const w = container.clientWidth, h = container.clientHeight;
      const minX = Math.min(boxStartRef.current.x, boxEndRef.current.x);
      const maxX = Math.max(boxStartRef.current.x, boxEndRef.current.x);
      const minY = Math.min(boxStartRef.current.y, boxEndRef.current.y);
      const maxY = Math.max(boxStartRef.current.y, boxEndRef.current.y);
      const rect = container.getBoundingClientRect();

      clearSelection();
      const newSel = new Set<number>();

      const entities = viewModeRef.current === 'buildings'
        ? buildingsDataRef.current.map(b => ({ id: b.id, center: b.center }))
        : roomsDataRef.current.map(r => ({ id: r.id, center: r.center }));

      for (const ent of entities) {
        const projected = ent.center.clone().project(camera);
        const sx = (projected.x + 1) / 2 * w + rect.left;
        const sy = (-projected.y + 1) / 2 * h + rect.top;
        if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
          newSel.add(ent.id);
          paintEntity(ent.id, ...BOX_CLR);
        }
      }

      selectedIdsRef.current = newSel;
      setSelectedIds(new Set(newSel));
    };

    const hoverEntity = (entityId: number | null) => {
      if (hoveredIdRef.current === entityId) return;

      const prev = hoveredIdRef.current;
      if (prev !== null && !selectedIdsRef.current.has(prev)) {
        restoreEntity(prev);
      }

      hoveredIdRef.current = entityId;
      setHoveredId(entityId);

      if (entityId !== null && !selectedIdsRef.current.has(entityId)) {
        paintEntity(entityId, ...HOVER_CLR);
      }
    };

    const resetView = () => {
      if (initialCamRef.current) {
        camera.position.copy(initialCamRef.current.pos);
        cameraTargetRef.current.copy(initialCamRef.current.target);
        camera.lookAt(cameraTargetRef.current);
        targetZoomRef.current = camera.position.distanceTo(cameraTargetRef.current);
      }
    };

    /* ─── Export: pass-through + building_id ──────────────── */

    const exportSelected = () => {
      const orig = originalDataRef.current;
      if (!orig || selectedIdsRef.current.size === 0) return;

      const roomToBuildingName = new Map<number, string>();
      const selRoomIds = new Set<number>();

      if (viewModeRef.current === 'buildings') {
        for (const bid of selectedIdsRef.current) {
          const b = buildingsDataRef.current[bid];
          if (!b) continue;
          for (const rid of b.roomIds) {
            selRoomIds.add(rid);
            roomToBuildingName.set(rid, b.name);
          }
        }
      } else {
        for (const rid of selectedIdsRef.current) {
          selRoomIds.add(rid);
          const bid = roomToBuildingRef.current[rid];
          const bn = buildingsDataRef.current[bid]?.name ?? `Budova_${bid + 1}`;
          roomToBuildingName.set(rid, bn);
        }
      }

      const exportRooms = (orig.rooms || [])
        .map((r, i) => ({ r, i }))
        .filter(({ i }) => selRoomIds.has(i))
        .map(({ r, i }) => ({
          ...r,
          user_data: {
            ...(r.user_data || {}),
            building_id: roomToBuildingName.get(i) ?? `Budova_${i + 1}`,
          },
        }));

      const buildingCount = new Set(roomToBuildingName.values()).size;
      const label = `${buildingCount}_buildings_${exportRooms.length}_rooms`;

      const exportData = {
        ...orig,
        display_name: `${orig.display_name || 'Model'}_export_${label}`,
        rooms: exportRooms,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${label}.hbjson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    /* ─── Event handlers ───────────────────────────────────── */

    const canvas = renderer.domElement;

    const triHitToEntityId = (faceIndex: number): number => {
      const roomId = triangleToRoomRef.current[faceIndex];
      if (roomId < 0) return -1;
      if (viewModeRef.current === 'buildings') {
        return roomToBuildingRef.current[roomId] ?? -1;
      }
      return roomId;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && e.shiftKey) {
        isBoxSelectingRef.current = true;
        boxStartRef.current = { x: e.clientX, y: e.clientY };
        boxEndRef.current = { x: e.clientX, y: e.clientY };
        if (boxElRef.current) {
          boxElRef.current.style.display = 'block';
          boxElRef.current.style.left = e.clientX + 'px';
          boxElRef.current.style.top = e.clientY + 'px';
          boxElRef.current.style.width = '0';
          boxElRef.current.style.height = '0';
        }
        e.preventDefault();
        return;
      }
      isDraggingRef.current = true;
      isPanningRef.current = e.button === 2;
      mouseDownTimeRef.current = Date.now();
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
      targetZoomRef.current = camera.position.distanceTo(cameraTargetRef.current);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isBoxSelectingRef.current && boxElRef.current) {
        boxEndRef.current = { x: e.clientX, y: e.clientY };
        const l = Math.min(boxStartRef.current.x, e.clientX);
        const t = Math.min(boxStartRef.current.y, e.clientY);
        boxElRef.current.style.left = l + 'px';
        boxElRef.current.style.top = t + 'px';
        boxElRef.current.style.width = Math.abs(e.clientX - boxStartRef.current.x) + 'px';
        boxElRef.current.style.height = Math.abs(e.clientY - boxStartRef.current.y) + 'px';
        return;
      }

      if (!isDraggingRef.current && highlightHoverRef.current && solidMeshRef.current) {
        const now = Date.now();
        if (now - lastRaycastRef.current < 80) return;
        lastRaycastRef.current = now;

        const rect = container.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycasterRef.current.setFromCamera(mouse, camera);
        const hits = raycasterRef.current.intersectObject(solidMeshRef.current);

        if (hits.length > 0 && hits[0].faceIndex != null) {
          const eid = triHitToEntityId(hits[0].faceIndex!);
          if (eid >= 0) {
            hoverEntity(eid);
            canvas.style.cursor = 'pointer';
            return;
          }
        }
        hoverEntity(null);
        canvas.style.cursor = 'grab';
        return;
      }

      if (!isDraggingRef.current) return;
      canvas.style.cursor = 'grabbing';

      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;

      if (isPanningRef.current) {
        const panSpeed = Math.max(0.5, camera.position.distanceTo(cameraTargetRef.current) * 0.001);
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const right = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        const offset = right.clone().multiplyScalar(-dx * panSpeed)
          .add(camera.up.clone().multiplyScalar(dy * panSpeed));
        cameraTargetRef.current.add(offset);
        camera.position.add(offset);
      } else {
        const offset = camera.position.clone().sub(cameraTargetRef.current);
        const sph = new THREE.Spherical().setFromVector3(offset);
        sph.theta -= dx * 0.01;
        sph.phi += dy * 0.01;
        sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi));
        offset.setFromSpherical(sph);
        camera.position.copy(cameraTargetRef.current).add(offset);
      }
      camera.lookAt(cameraTargetRef.current);
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      if (isBoxSelectingRef.current) {
        boxSelect();
        isBoxSelectingRef.current = false;
        if (boxElRef.current) boxElRef.current.style.display = 'none';
        return;
      }
      isDraggingRef.current = false;
      isPanningRef.current = false;
      canvas.style.cursor = 'grab';
    };

    const onClick = (e: MouseEvent) => {
      if (e.shiftKey) return;
      if (Date.now() - mouseDownTimeRef.current > 200) return;
      if (!solidMeshRef.current) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(mouse, camera);
      const hits = raycasterRef.current.intersectObject(solidMeshRef.current);

      if (hits.length > 0 && hits[0].faceIndex != null) {
        const eid = triHitToEntityId(hits[0].faceIndex!);
        if (eid >= 0) {
          selectEntity(eid, e.ctrlKey || e.metaKey);
          return;
        }
      }
      clearSelection();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 40;
      else if (e.deltaMode === 2) d *= 800;
      targetZoomRef.current *= d > 0 ? 1.2 : 0.8;
      targetZoomRef.current = Math.max(10, Math.min(5000, targetZoomRef.current));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        keysRef.current.add(k);
        e.preventDefault();
      }
      if (k === 'r') resetView();
      if (k === 'escape') clearSelection();
    };

    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    /* ─── Animation loop ───────────────────────────────────── */

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (keysRef.current.size > 0) {
        const sp = Math.max(2, camera.position.distanceTo(cameraTargetRef.current) * 0.01);
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        const right = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        const off = new THREE.Vector3();
        if (keysRef.current.has('arrowright') || keysRef.current.has('d')) off.add(right.clone().multiplyScalar(sp));
        if (keysRef.current.has('arrowleft') || keysRef.current.has('a')) off.add(right.clone().multiplyScalar(-sp));
        if (keysRef.current.has('arrowup') || keysRef.current.has('w')) off.add(camera.up.clone().multiplyScalar(sp));
        if (keysRef.current.has('arrowdown') || keysRef.current.has('s')) off.add(camera.up.clone().multiplyScalar(-sp));
        cameraTargetRef.current.add(off);
        camera.position.add(off);
      }

      const cur = camera.position.distanceTo(cameraTargetRef.current);
      if (Math.abs(cur - targetZoomRef.current) > 0.05) {
        const nd = THREE.MathUtils.lerp(cur, targetZoomRef.current, 0.1);
        const d = camera.position.clone().sub(cameraTargetRef.current).normalize();
        camera.position.copy(cameraTargetRef.current).add(d.multiplyScalar(nd));
      }

      renderer.render(scene, camera);
    };
    animate();

    buildModelFnRef.current = buildModel;
    clearSelectionFnRef.current = clearSelection;
    selectByIdFnRef.current = selectEntity;
    exportSelectedFnRef.current = exportSelected;

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (boxElRef.current && container.contains(boxElRef.current)) container.removeChild(boxElRef.current);
      renderer.dispose();
      scene.clear();
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [paintEntity, restoreEntity]);

  /* ─── UI handlers ────────────────────────────────────────── */

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      requestAnimationFrame(() => {
        try {
          const data = JSON.parse(ev.target?.result as string) as HBJSONData;
          buildModelFnRef.current?.(data);
        } catch (err) {
          alert('Chyba při načítání: ' + (err as Error).message);
        } finally {
          setIsLoading(false);
        }
      });
    };
    reader.readAsText(file);
  }, []);

  const handleOpacity = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value);
    setOpacity(v);
    opacityRef.current = v;
    const mesh = solidMeshRef.current;
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshLambertMaterial;
    mat.opacity = v / 100;
    mat.transparent = v < 100;
    mat.needsUpdate = true;
  }, []);

  const handleGrid = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setShowGrid(e.target.checked);
    if (gridRef.current) gridRef.current.visible = e.target.checked;
  }, []);

  const handleHighlight = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHighlightHover(e.target.checked);
    highlightHoverRef.current = e.target.checked;
  }, []);

  const handleViewMode = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value as ViewMode;
    clearSelectionFnRef.current?.();
    viewModeRef.current = mode;
    setViewMode(mode);
    hoveredIdRef.current = null;
    setHoveredId(null);
  }, []);

  const selCount = selectedIds.size;
  const selRoom = (viewMode === 'rooms' && selCount === 1)
    ? roomsDataRef.current[Array.from(selectedIds)[0]]
    : null;
  const selBuilding = (viewMode === 'buildings' && selCount === 1)
    ? buildingsDataRef.current[Array.from(selectedIds)[0]]
    : null;

  /* ─── JSX ────────────────────────────────────────────────── */

  return (
    <div className="hbjson-viewer">
      <button
        className="hbjson-viewer__back"
        onClick={onBack}
        aria-label="Zpět"
      >
        <FaArrowLeft /> Zpět
      </button>

      <button
        className={`hbjson-viewer__toggle${panelOpen ? ' open' : ''}`}
        onClick={() => setPanelOpen(p => !p)}
        aria-label={panelOpen ? 'Skrýt panel' : 'Zobrazit panel'}
      >
        {panelOpen ? '×' : '☰'}
      </button>

      <div className={`hbjson-viewer__panel${panelOpen ? '' : ' collapsed'}`}>
        <h3>HBJSON Viewer</h3>

        <div className="hbjson-viewer__file-input">
          <input type="file" id="fileInput" accept=".hbjson,.json" onChange={handleFile} />
          <label htmlFor="fileInput" className="hbjson-viewer__file-label">Načíst HBJSON soubor</label>
        </div>

        <div className="hbjson-viewer__controls">
          <div className="hbjson-viewer__field">
            <label>Pohled</label>
            <select value={viewMode} onChange={handleViewMode}>
              <option value="buildings">Budovy</option>
              <option value="rooms">Místnosti</option>
            </select>
          </div>

          <div className="hbjson-viewer__field">
            <label>Průhlednost <span className="hbjson-viewer__val">{opacity}%</span></label>
            <input type="range" min="10" max="100" value={opacity} onChange={handleOpacity} />
          </div>

          <div className="hbjson-viewer__row">
            <button onClick={() => clearSelectionFnRef.current?.()}>
              Zrušit výběr
            </button>
            <button
              disabled={selCount === 0}
              onClick={() => exportSelectedFnRef.current?.()}
            >
              Export ({selCount})
            </button>
          </div>

          <div className="hbjson-viewer__checks">
            <label><input type="checkbox" checked={showGrid} onChange={handleGrid} /> Mřížka</label>
            <label><input type="checkbox" checked={highlightHover} onChange={handleHighlight} /> Hover</label>
          </div>
        </div>

        {selCount > 0 && (
          <div className="hbjson-viewer__selection">
            <h4>
              {viewMode === 'buildings'
                ? (selCount === 1 ? 'Vybraná budova' : `Výběr: ${selCount} budov`)
                : (selCount === 1 ? 'Vybraná místnost' : `Výběr: ${selCount} místností`)}
            </h4>

            {selRoom && (
              <div className="hbjson-viewer__sel-detail">
                <span><b>Název:</b> {selRoom.name}</span>
                <span><b>Ploch:</b> {selRoom.faceCount} (W:{selRoom.wallCount} F:{selRoom.floorCount} R:{selRoom.roofCount})</span>
                <span><b>Výška:</b> {selRoom.height.toFixed(1)} m</span>
                <span><b>Rozměr střechy:</b> {selRoom.roofLength.toFixed(1)} × {selRoom.roofWidth.toFixed(1)} m</span>
              </div>
            )}

            {selBuilding && (
              <div className="hbjson-viewer__sel-detail">
                <span><b>Název:</b> {selBuilding.name}</span>
                <span><b>Místností:</b> {selBuilding.roomIds.length}</span>
                <span><b>Ploch:</b> {selBuilding.faceCount}</span>
                <span><b>Výška:</b> {selBuilding.height.toFixed(1)} m</span>
                <span><b>Rozměr střechy:</b> {selBuilding.roofLength.toFixed(1)} × {selBuilding.roofWidth.toFixed(1)} m</span>
              </div>
            )}

            {!selRoom && !selBuilding && (
              <div className="hbjson-viewer__sel-detail">
                {viewMode === 'buildings' ? (
                  <>
                    <span><b>Budov:</b> {selCount}</span>
                    <span><b>Místností:</b> {Array.from(selectedIds).reduce((s: number, id) => s + (buildingsDataRef.current[id]?.roomIds.length || 0), 0)}</span>
                  </>
                ) : (
                  <>
                    <span><b>Místností:</b> {selCount}</span>
                    <span><b>Ploch:</b> {Array.from(selectedIds).reduce((s: number, id) => s + (roomsDataRef.current[id]?.faceCount || 0), 0)}</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {stats && (
          <div className="hbjson-viewer__stats">
            <span><b>Model:</b> {stats.name} <small>v{stats.version}</small></span>
            <span><b>Budov:</b> {stats.buildingCount} &nbsp; <b>Místností:</b> {stats.roomCount} &nbsp; <b>Terén:</b> {stats.shadeCount}</span>
            <span><b>Ploch:</b> {stats.faceCount.toLocaleString()}</span>
            <span><b>Rozměr:</b> {stats.dimensions.x.toFixed(0)}×{stats.dimensions.z.toFixed(0)}×{stats.dimensions.y.toFixed(0)} m</span>
          </div>
        )}

        {viewMode === 'buildings' && buildings.length > 0 && (
          <div className="hbjson-viewer__room-list-wrap">
            <h4>Budovy ({buildings.length})</h4>
            <div className="hbjson-viewer__room-list">
              {buildings.slice(0, 200).map(b => (
                <div
                  key={b.id}
                  className={`hbjson-viewer__room-item${selectedIds.has(b.id) ? ' sel' : ''}${hoveredId === b.id ? ' hov' : ''}`}
                  onClick={(e) => selectByIdFnRef.current?.(b.id, e.ctrlKey || e.metaKey)}
                >
                  <span className="hbjson-viewer__room-name">{b.name}</span>
                  <span className="hbjson-viewer__room-meta">{b.roomIds.length}m · {b.height.toFixed(0)}m</span>
                </div>
              ))}
              {buildings.length > 200 && <div className="hbjson-viewer__room-more">…a dalších {buildings.length - 200}</div>}
            </div>
          </div>
        )}

        {viewMode === 'rooms' && rooms.length > 0 && (
          <div className="hbjson-viewer__room-list-wrap">
            <h4>Místnosti ({rooms.length})</h4>
            <div className="hbjson-viewer__room-list">
              {rooms.slice(0, 200).map(r => (
                <div
                  key={r.id}
                  className={`hbjson-viewer__room-item${selectedIds.has(r.id) ? ' sel' : ''}${hoveredId === r.id ? ' hov' : ''}`}
                  onClick={(e) => selectByIdFnRef.current?.(r.id, e.ctrlKey || e.metaKey)}
                >
                  <span className="hbjson-viewer__room-name">{r.name}</span>
                  <span className="hbjson-viewer__room-meta">{r.faceCount}f · {r.height.toFixed(0)}m</span>
                </div>
              ))}
              {rooms.length > 200 && <div className="hbjson-viewer__room-more">…a dalších {rooms.length - 200}</div>}
            </div>
          </div>
        )}

        <div className="hbjson-viewer__help">
          <b>Ovládání</b>
          Klik = výběr {viewMode === 'buildings' ? 'budovy' : 'místnosti'} · Ctrl+klik = přidat do výběru<br />
          Shift + tažení = box select<br />
          Tažení = rotace · Pravé tl. = posuv · Kolečko = zoom<br />
          Šipky / WASD = pohyb · R = reset · Esc = zrušit
        </div>
      </div>

      {isLoading && (
        <div className="hbjson-viewer__loading">
          <div className="hbjson-viewer__spinner" />
          <span>Načítám model…</span>
        </div>
      )}

      <div ref={containerRef} className="hbjson-viewer__canvas" />
    </div>
  );
};

export default HbjsonViewer;