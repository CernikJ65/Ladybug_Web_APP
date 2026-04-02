import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
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
}

interface HBRoom {
  type: string;
  identifier: string;
  display_name?: string;
  faces: HBFace[];
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
  minZ: number;
  maxZ: number;
  center: THREE.Vector3;
}

interface ModelStats {
  name: string;
  version: string;
  units: string;
  faceCount: number;
  roomCount: number;
  shadeCount: number;
  dimensions: { x: number; y: number; z: number };
  totalArea: number;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const HOVER_CLR = [1.0, 1.0, 0.15] as const;
const SELECT_CLR = [1.0, 0.45, 0.0] as const;
const BOX_CLR = [0.6, 0.2, 0.95] as const;

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

function heightColor(z: number, minZ: number, maxZ: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (z - minZ) / (maxZ - minZ + 0.001)));
  const lightness = 0.45 + t * 0.35;
  return new THREE.Color().setHSL(0, 0, lightness);
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

const HbjsonViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const solidMeshRef = useRef<THREE.Mesh | null>(null);
  const wireMeshRef = useRef<THREE.LineSegments | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const groundRef = useRef<THREE.Mesh | null>(null);

  const originalColorsRef = useRef<Float32Array | null>(null);
  const triangleToRoomRef = useRef<Int32Array>(new Int32Array(0));
  const roomsDataRef = useRef<RoomInfo[]>([]);
  const originalDataRef = useRef<HBJSONData | null>(null);

  const selectedRoomIdsRef = useRef<Set<number>>(new Set());
  const hoveredRoomIdRef = useRef<number | null>(null);

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
  const selectRoomFnRef = useRef<((id: number, additive: boolean) => void) | null>(null);
  const exportSelectedFnRef = useRef<(() => void) | null>(null);

  const [stats, setStats] = useState<ModelStats | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [renderMode, setRenderMode] = useState<'solid' | 'wireframe' | 'both'>('solid');
  const [opacity, setOpacity] = useState(85);
  const [showGrid, setShowGrid] = useState(true);
  const [highlightHover, setHighlightHover] = useState(true);

  /* ─── Color buffer helpers ─────────────────────────────────── */

  const setRoomColor = useCallback((roomId: number, r: number, g: number, b: number) => {
    const mesh = solidMeshRef.current;
    if (!mesh) return;
    const attr = mesh.geometry.attributes.color as THREE.BufferAttribute;
    const room = roomsDataRef.current[roomId];
    if (!room) return;
    const arr = attr.array as Float32Array;
    const end = room.vertexStart + room.vertexCount;
    for (let i = room.vertexStart; i < end; i++) {
      arr[i * 3] = r;
      arr[i * 3 + 1] = g;
      arr[i * 3 + 2] = b;
    }
    attr.needsUpdate = true;
  }, []);

  const restoreRoomColor = useCallback((roomId: number) => {
    const mesh = solidMeshRef.current;
    const orig = originalColorsRef.current;
    if (!mesh || !orig) return;
    const attr = mesh.geometry.attributes.color as THREE.BufferAttribute;
    const room = roomsDataRef.current[roomId];
    if (!room) return;
    const arr = attr.array as Float32Array;
    const end = room.vertexStart + room.vertexCount;
    for (let i = room.vertexStart; i < end; i++) {
      arr[i * 3] = orig[i * 3];
      arr[i * 3 + 1] = orig[i * 3 + 1];
      arr[i * 3 + 2] = orig[i * 3 + 2];
    }
    attr.needsUpdate = true;
  }, []);

  const restoreAllColors = useCallback(() => {
    const mesh = solidMeshRef.current;
    const orig = originalColorsRef.current;
    if (!mesh || !orig) return;
    const attr = mesh.geometry.attributes.color as THREE.BufferAttribute;
    (attr.array as Float32Array).set(orig);
    attr.needsUpdate = true;
  }, []);

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
      if (wireMeshRef.current) {
        wireMeshRef.current.geometry.dispose();
        (wireMeshRef.current.material as THREE.Material).dispose();
        scene.remove(wireMeshRef.current);
        wireMeshRef.current = null;
      }

      selectedRoomIdsRef.current.clear();
      hoveredRoomIdRef.current = null;
      setSelectedIds(new Set());
      setHoveredId(null);

      const hbRooms = data.rooms || [];
      const hbShades = data.orphaned_shades || data.shades || [];

      if (hbRooms.length === 0 && hbShades.length === 0) {
        setStats(null);
        setRooms([]);
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
      const wirePositions: number[] = [];
      const triToRoom: number[] = [];
      const roomInfos: RoomInfo[] = [];

      let totalArea = 0;
      let totalFaces = 0;

      const addFace = (boundary: number[][], faceType: string | undefined, roomId: number) => {
        if (boundary.length < 3) return;
        const tris = triangulateBoundary(boundary);
        if (!tris) return;

        const avgZ = boundary.reduce((s, c) => s + c[2], 0) / boundary.length;
        const clr = heightColor(avgZ, globalMinZ, globalMaxZ);

        // Compute ONE normal for the entire face from first 3 boundary points
        // This prevents non-planar faces from looking "twisted"
        const p0 = hbjsonToScreen(boundary[0]);
        const p1 = hbjsonToScreen(boundary[1]);
        const p2 = hbjsonToScreen(boundary[2]);
        const faceNormal = new THREE.Vector3()
          .crossVectors(p1.clone().sub(p0), p2.clone().sub(p0));
        if (faceNormal.lengthSq() < 1e-8) return; // degenerate face
        faceNormal.normalize();

        for (let t = 0; t < tris.length; t += 3) {
          const a = hbjsonToScreen(tris[t]);
          const b = hbjsonToScreen(tris[t + 1]);
          const c = hbjsonToScreen(tris[t + 2]);

          // Skip degenerate triangles
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

        for (let i = 0; i < boundary.length; i++) {
          const p1 = hbjsonToScreen(boundary[i]);
          const p2 = hbjsonToScreen(boundary[(i + 1) % boundary.length]);
          wirePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }

        totalArea += computeFaceArea(boundary);
        totalFaces++;
      };

      for (let ri = 0; ri < hbRooms.length; ri++) {
        const room = hbRooms[ri];
        const vertStart = positions.length / 3;
        let area = 0, wallC = 0, floorC = 0, roofC = 0;
        let rMinZ = Infinity, rMaxZ = -Infinity;
        let cx = 0, cy = 0, cz = 0, ptCount = 0;

        for (const face of room.faces) {
          const b = face.geometry.boundary;
          if (b.length < 3) continue;
          addFace(b, face.face_type, ri);
          area += computeFaceArea(b);
          if (face.face_type === 'Wall') wallC++;
          else if (face.face_type === 'Floor') floorC++;
          else if (face.face_type === 'RoofCeiling') roofC++;
          for (const c of b) {
            rMinZ = Math.min(rMinZ, c[2]); rMaxZ = Math.max(rMaxZ, c[2]);
            cx += c[0]; cy += c[1]; cz += c[2]; ptCount++;
          }
        }

        const vertCount = positions.length / 3 - vertStart;
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
          minZ: rMinZ,
          maxZ: rMaxZ,
          center: ptCount > 0
            ? new THREE.Vector3(cx / ptCount, cz / ptCount, -cy / ptCount)
            : new THREE.Vector3()
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

      const wireGeom = new THREE.BufferGeometry();
      wireGeom.setAttribute('position', new THREE.Float32BufferAttribute(wirePositions, 3));
      const wire = new THREE.LineSegments(wireGeom,
        new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.25 })
      );
      wire.visible = false;
      scene.add(wire);
      wireMeshRef.current = wire;

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
      setStats({
        name: data.display_name || data.identifier || 'Model',
        version: data.version || '?',
        units: data.units || 'Meters',
        faceCount: totalFaces,
        roomCount: hbRooms.length,
        shadeCount: hbShades.length,
        dimensions: { x: size.x, y: size.y, z: size.z },
        totalArea
      });
    };

    /* ─── Selection logic ──────────────────────────────────── */

    const selectRoom = (roomId: number, additive: boolean) => {
      const prev = selectedRoomIdsRef.current;

      if (!additive) {
        prev.forEach(id => restoreRoomColor(id));
        prev.clear();
      }

      if (prev.has(roomId)) {
        prev.delete(roomId);
        restoreRoomColor(roomId);
      } else {
        prev.add(roomId);
        setRoomColor(roomId, ...SELECT_CLR);
      }

      const next = new Set(prev);
      selectedRoomIdsRef.current = next;
      setSelectedIds(next);
    };

    const clearSelection = () => {
      selectedRoomIdsRef.current.forEach(id => restoreRoomColor(id));
      selectedRoomIdsRef.current.clear();
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

      for (const room of roomsDataRef.current) {
        const projected = room.center.clone().project(camera);
        const sx = (projected.x + 1) / 2 * w + rect.left;
        const sy = (-projected.y + 1) / 2 * h + rect.top;
        if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
          newSel.add(room.id);
          setRoomColor(room.id, ...BOX_CLR);
        }
      }

      selectedRoomIdsRef.current = newSel;
      setSelectedIds(new Set(newSel));
    };

    const hoverRoom = (roomId: number | null) => {
      if (hoveredRoomIdRef.current === roomId) return;

      const prev = hoveredRoomIdRef.current;
      if (prev !== null && !selectedRoomIdsRef.current.has(prev)) {
        restoreRoomColor(prev);
      }

      hoveredRoomIdRef.current = roomId;
      setHoveredId(roomId);

      if (roomId !== null && !selectedRoomIdsRef.current.has(roomId)) {
        setRoomColor(roomId, ...HOVER_CLR);
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

    /* ─── Export ────────────────────────────────────────────── */

    const exportSelected = () => {
      const orig = originalDataRef.current;
      if (!orig || selectedRoomIdsRef.current.size === 0) return;

      const selIds = selectedRoomIdsRef.current;
      const exportRooms = (orig.rooms || []).filter((_, i) => selIds.has(i));
      const exportData: HBJSONData = {
        ...orig,
        display_name: `${orig.display_name || 'Model'}_export_${exportRooms.length}_rooms`,
        rooms: exportRooms,
        orphaned_shades: []
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${exportRooms.length}_rooms.hbjson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    /* ─── Event handlers ───────────────────────────────────── */

    const canvas = renderer.domElement;

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
          const roomId = triangleToRoomRef.current[hits[0].faceIndex!];
          if (roomId >= 0) {
            hoverRoom(roomId);
            canvas.style.cursor = 'pointer';
            return;
          }
        }
        hoverRoom(null);
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
        const roomId = triangleToRoomRef.current[hits[0].faceIndex!];
        if (roomId >= 0) {
          selectRoom(roomId, e.ctrlKey || e.metaKey);
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

    /* ─── Expose functions via typed refs for UI handlers ──── */

    buildModelFnRef.current = buildModel;
    clearSelectionFnRef.current = clearSelection;
    selectRoomFnRef.current = selectRoom;
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
  }, [setRoomColor, restoreRoomColor, restoreAllColors]);

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

  const handleRenderMode = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value as typeof renderMode;
    setRenderMode(mode);
    if (solidMeshRef.current) solidMeshRef.current.visible = mode !== 'wireframe';
    if (wireMeshRef.current) wireMeshRef.current.visible = mode !== 'solid';
  }, []);

  const handleGrid = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setShowGrid(e.target.checked);
    if (gridRef.current) gridRef.current.visible = e.target.checked;
  }, []);

  const handleHighlight = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHighlightHover(e.target.checked);
    highlightHoverRef.current = e.target.checked;
  }, []);

  const selCount = selectedIds.size;
  const selRoom = selCount === 1 ? roomsDataRef.current[Array.from(selectedIds)[0]] : null;

  /* ─── JSX ────────────────────────────────────────────────── */

  return (
    <div className="hbjson-viewer">
      <div className="hbjson-viewer__panel">
        <h3>HBJSON Viewer</h3>

        <div className="hbjson-viewer__file-input">
          <input type="file" id="fileInput" accept=".hbjson,.json" onChange={handleFile} />
          <label htmlFor="fileInput" className="hbjson-viewer__file-label">Načíst HBJSON soubor</label>
        </div>

        <div className="hbjson-viewer__controls">
          <div className="hbjson-viewer__field">
            <label>Zobrazení</label>
            <select value={renderMode} onChange={handleRenderMode}>
              <option value="solid">Plné plochy</option>
              <option value="wireframe">Drátěný model</option>
              <option value="both">Kombinované</option>
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
            <h4>{selCount === 1 ? 'Vybraná budova' : `Výběr: ${selCount} budov`}</h4>
            {selRoom ? (
              <div className="hbjson-viewer__sel-detail">
                <span><b>Název:</b> {selRoom.name}</span>
                <span><b>Ploch:</b> {selRoom.faceCount} (W:{selRoom.wallCount} F:{selRoom.floorCount} R:{selRoom.roofCount})</span>
                <span><b>Plocha:</b> {selRoom.area.toFixed(1)} m²</span>
                <span><b>Výška:</b> {selRoom.height.toFixed(1)} m ({selRoom.minZ.toFixed(1)}–{selRoom.maxZ.toFixed(1)})</span>
              </div>
            ) : (
              <div className="hbjson-viewer__sel-detail">
                <span><b>Budov:</b> {selCount}</span>
                <span><b>Ploch:</b> {Array.from(selectedIds).reduce((s, id) => s + (roomsDataRef.current[id]?.faceCount || 0), 0)}</span>
                <span><b>Plocha:</b> {Array.from(selectedIds).reduce((s, id) => s + (roomsDataRef.current[id]?.area || 0), 0).toFixed(0)} m²</span>
              </div>
            )}
          </div>
        )}

        {stats && (
          <div className="hbjson-viewer__stats">
            <span><b>Model:</b> {stats.name} <small>v{stats.version}</small></span>
            <span><b>Budov:</b> {stats.roomCount} &nbsp; <b>Terén:</b> {stats.shadeCount}</span>
            <span><b>Ploch:</b> {stats.faceCount.toLocaleString()} &nbsp; <b>Plocha:</b> {stats.totalArea.toFixed(0)} m²</span>
            <span><b>Rozměr:</b> {stats.dimensions.x.toFixed(0)}×{stats.dimensions.z.toFixed(0)}×{stats.dimensions.y.toFixed(0)} m</span>
          </div>
        )}

        {rooms.length > 0 && (
          <div className="hbjson-viewer__room-list-wrap">
            <h4>Budovy ({rooms.length})</h4>
            <div className="hbjson-viewer__room-list">
              {rooms.slice(0, 200).map(r => (
                <div
                  key={r.id}
                  className={`hbjson-viewer__room-item${selectedIds.has(r.id) ? ' sel' : ''}${hoveredId === r.id ? ' hov' : ''}`}
                  onClick={(e) => selectRoomFnRef.current?.(r.id, e.ctrlKey || e.metaKey)}
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
          Klik = výběr budovy · Ctrl+klik = přidat do výběru<br />
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