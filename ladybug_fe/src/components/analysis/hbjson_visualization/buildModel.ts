import * as THREE from 'three';
import type { HBJSONData, RoomInfo, BuildingInfo, ModelStats } from './types';
import { hbjsonToScreen, triangulateBoundary, computeFaceArea, orientedFootprintSize, heightColor } from './geometry';
import { clusterRoomsIntoBuildings } from './clustering';

export interface BuildModelRefs {
  solidMeshRef: React.RefObject<THREE.Mesh | null>;
  originalColorsRef: React.RefObject<Float32Array | null>;
  triangleToRoomRef: React.RefObject<Int32Array>;
  roomsDataRef: React.RefObject<RoomInfo[]>;
  buildingsDataRef: React.RefObject<BuildingInfo[]>;
  roomToBuildingRef: React.RefObject<Int32Array>;
  originalDataRef: React.RefObject<HBJSONData | null>;
  selectedIdsRef: React.RefObject<Set<number>>;
  hoveredIdRef: React.RefObject<number | null>;
  opacityRef: React.RefObject<number>;
  groundRef: React.RefObject<THREE.Mesh | null>;
  gridRef: React.RefObject<THREE.GridHelper | null>;
}

export interface BuildModelSetters {
  setSelectedIds: (v: Set<number>) => void;
  setHoveredId: (v: number | null) => void;
  setRooms: (v: RoomInfo[]) => void;
  setBuildings: (v: BuildingInfo[]) => void;
  setStats: (v: ModelStats | null) => void;
}

export function buildModel(
  data: HBJSONData,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  refs: BuildModelRefs,
  setters: BuildModelSetters
): { center: THREE.Vector3; dist: number } | null {
  refs.originalDataRef.current = data;

  if (refs.solidMeshRef.current) {
    refs.solidMeshRef.current.geometry.dispose();
    (refs.solidMeshRef.current.material as THREE.Material).dispose();
    scene.remove(refs.solidMeshRef.current);
    refs.solidMeshRef.current = null;
  }

  refs.selectedIdsRef.current.clear();
  refs.hoveredIdRef.current = null;
  setters.setSelectedIds(new Set());
  setters.setHoveredId(null);

  const hbRooms = data.rooms || [];
  const hbShades = data.orphaned_shades || data.shades || [];

  if (hbRooms.length === 0 && hbShades.length === 0) {
    setters.setStats(null); setters.setRooms([]); setters.setBuildings([]);
    return null;
  }

  let globalMinZ = Infinity, globalMaxZ = -Infinity;
  const scanBoundary = (b: number[][]) => {
    for (const c of b) { globalMinZ = Math.min(globalMinZ, c[2]); globalMaxZ = Math.max(globalMaxZ, c[2]); }
  };
  for (const room of hbRooms) for (const f of room.faces) scanBoundary(f.geometry.boundary);
  for (const s of hbShades) scanBoundary(s.geometry.boundary);

  const positions: number[] = [], normals: number[] = [], colors: number[] = [];
  const triToRoom: number[] = [];
  const roomInfos: RoomInfo[] = [];
  let totalFaces = 0;

  const addFace = (boundary: number[][], roomId: number) => {
    if (boundary.length < 3) return;
    const tris = triangulateBoundary(boundary);
    if (!tris) return;
    const avgZ = boundary.reduce((s, c) => s + c[2], 0) / boundary.length;
    const clr = heightColor(avgZ, globalMinZ, globalMaxZ);
    const p0 = hbjsonToScreen(boundary[0]), p1 = hbjsonToScreen(boundary[1]), p2 = hbjsonToScreen(boundary[2]);
    const faceNormal = new THREE.Vector3().crossVectors(p1.clone().sub(p0), p2.clone().sub(p0));
    if (faceNormal.lengthSq() < 1e-8) return;
    faceNormal.normalize();
    for (let t = 0; t < tris.length; t += 3) {
      const a = hbjsonToScreen(tris[t]), b = hbjsonToScreen(tris[t+1]), c = hbjsonToScreen(tris[t+2]);
      if (new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).length() < 1e-6) continue;
      positions.push(a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z);
      normals.push(faceNormal.x,faceNormal.y,faceNormal.z, faceNormal.x,faceNormal.y,faceNormal.z, faceNormal.x,faceNormal.y,faceNormal.z);
      colors.push(clr.r,clr.g,clr.b, clr.r,clr.g,clr.b, clr.r,clr.g,clr.b);
      triToRoom.push(roomId);
    }
    totalFaces++;
  };

  for (let ri = 0; ri < hbRooms.length; ri++) {
    const room = hbRooms[ri];
    const vertStart = positions.length / 3;
    let area = 0, wallC = 0, floorC = 0, roofC = 0;
    let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity, rMinZ = Infinity, rMaxZ = -Infinity;
    let cx = 0, cy = 0, cz = 0, ptCount = 0;
    const fpEdges: number[] = [], roofPts: number[] = [];

    for (const face of room.faces) {
      const b = face.geometry.boundary;
      if (b.length < 3) continue;
      addFace(b, ri);
      area += computeFaceArea(b);
      if (face.face_type === 'Wall') wallC++;
      else if (face.face_type === 'Floor') {
        floorC++;
        if (fpEdges.length === 0)
          for (let k = 0; k < b.length; k++) { const p1 = b[k], p2 = b[(k+1)%b.length]; fpEdges.push(p1[0],p1[1],p2[0],p2[1]); }
        for (const c of b) roofPts.push(c[0], c[1]);
      } else if (face.face_type === 'RoofCeiling') roofC++;
      for (const c of b) {
        rMinX = Math.min(rMinX,c[0]); rMaxX = Math.max(rMaxX,c[0]);
        rMinY = Math.min(rMinY,c[1]); rMaxY = Math.max(rMaxY,c[1]);
        rMinZ = Math.min(rMinZ,c[2]); rMaxZ = Math.max(rMaxZ,c[2]);
        cx += c[0]; cy += c[1]; cz += c[2]; ptCount++;
      }
    }

    if (fpEdges.length === 0) {
      for (const face of room.faces) {
        if (face.face_type !== 'Wall') continue;
        const sorted = [...face.geometry.boundary].sort((u, v) => u[2] - v[2]);
        if (sorted.length >= 2) fpEdges.push(sorted[0][0],sorted[0][1],sorted[1][0],sorted[1][1]);
      }
    }

    const roofPtsArr = new Float32Array(roofPts);
    const obb = orientedFootprintSize(roofPtsArr);
    const ud = (room.user_data || {}) as Record<string, unknown>;
    roomInfos.push({
      id: ri, name: room.display_name || room.identifier || `Room_${ri}`,
      vertexStart: vertStart, vertexCount: positions.length / 3 - vertStart,
      faceCount: room.faces.length, wallCount: wallC, floorCount: floorC, roofCount: roofC,
      area, height: rMaxZ - rMinZ,
      minX: rMinX, maxX: rMaxX, minY: rMinY, maxY: rMaxY, minZ: rMinZ, maxZ: rMaxZ,
      center: ptCount > 0 ? new THREE.Vector3(cx/ptCount, cz/ptCount, -cy/ptCount) : new THREE.Vector3(),
      footprintEdges: new Float32Array(fpEdges), roofPoints: roofPtsArr,
      roofWidth: obb.width, roofLength: obb.length,
      userBuildingId: typeof ud['building_id'] === 'string' ? ud['building_id'] as string : undefined,
    });
  }

  for (const shade of hbShades) addFace(shade.geometry.boundary, -1);

  const colArr = new Float32Array(colors);
  refs.originalColorsRef.current = new Float32Array(colArr);
  refs.triangleToRoomRef.current = new Int32Array(triToRoom);
  refs.roomsDataRef.current = roomInfos;

  const buildingsList = clusterRoomsIntoBuildings(roomInfos);
  refs.buildingsDataRef.current = buildingsList;
  const r2b = new Int32Array(roomInfos.length);
  for (const b of buildingsList) for (const rid of b.roomIds) r2b[rid] = b.id;
  refs.roomToBuildingRef.current = r2b;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

  const op = refs.opacityRef.current / 100;
  const solid = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: op < 1, opacity: op }));
  solid.castShadow = totalFaces < 5000;
  solid.receiveShadow = true;
  scene.add(solid);
  refs.solidMeshRef.current = solid;

  const box = new THREE.Box3().setFromBufferAttribute(geom.attributes.position as THREE.BufferAttribute);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const dist = Math.max(size.x, size.y, size.z) / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.8;

  if (refs.groundRef.current) refs.groundRef.current.position.y = box.min.y - 1;
  if (refs.gridRef.current) refs.gridRef.current.position.y = box.min.y - 0.9;

  const angle = Math.PI / 4;
  camera.position.set(center.x + dist * Math.cos(angle), center.y + dist * 0.6, center.z + dist * Math.sin(angle));
  camera.lookAt(center);
  camera.near = Math.max(0.5, dist * 0.001);
  camera.far = Math.max(15000, dist * 10);
  camera.updateProjectionMatrix();

  setters.setRooms([...roomInfos]);
  setters.setBuildings([...buildingsList]);
  setters.setStats({
    name: data.display_name || data.identifier || 'Model',
    version: data.version || '?', units: data.units || 'Meters',
    faceCount: totalFaces, roomCount: hbRooms.length,
    buildingCount: buildingsList.length, shadeCount: hbShades.length,
    dimensions: { x: size.x, y: size.y, z: size.z },
  });

  return { center, dist };
}
