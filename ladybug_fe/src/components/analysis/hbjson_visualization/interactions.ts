import * as THREE from 'three';
import type { RoomInfo, BuildingInfo, HBJSONData, ViewMode } from './types';
import { SELECT_CLR, HOVER_CLR, BOX_CLR } from './geometry';

export interface InteractionRefs {
  solidMeshRef: React.RefObject<THREE.Mesh | null>;
  originalColorsRef: React.RefObject<Float32Array | null>;
  roomsDataRef: React.RefObject<RoomInfo[]>;
  buildingsDataRef: React.RefObject<BuildingInfo[]>;
  roomToBuildingRef: React.RefObject<Int32Array>;
  originalDataRef: React.RefObject<HBJSONData | null>;
  selectedIdsRef: React.RefObject<Set<number>>;
  hoveredIdRef: React.RefObject<number | null>;
  viewModeRef: React.RefObject<ViewMode>;
}

function paintRoomVertices(roomId: number, r: number, g: number, b: number, refs: InteractionRefs): void {
  const mesh = refs.solidMeshRef.current;
  if (!mesh) return;
  const attr = mesh.geometry.attributes.color as THREE.BufferAttribute;
  const room = refs.roomsDataRef.current[roomId];
  if (!room) return;
  const arr = attr.array as Float32Array;
  const end = room.vertexStart + room.vertexCount;
  for (let i = room.vertexStart; i < end; i++) { arr[i*3] = r; arr[i*3+1] = g; arr[i*3+2] = b; }
  attr.needsUpdate = true;
}

function restoreRoomVertices(roomId: number, refs: InteractionRefs): void {
  const mesh = refs.solidMeshRef.current;
  const orig = refs.originalColorsRef.current;
  if (!mesh || !orig) return;
  const attr = mesh.geometry.attributes.color as THREE.BufferAttribute;
  const room = refs.roomsDataRef.current[roomId];
  if (!room) return;
  const arr = attr.array as Float32Array;
  const end = room.vertexStart + room.vertexCount;
  for (let i = room.vertexStart; i < end; i++) { arr[i*3] = orig[i*3]; arr[i*3+1] = orig[i*3+1]; arr[i*3+2] = orig[i*3+2]; }
  attr.needsUpdate = true;
}

export function paintEntity(entityId: number, r: number, g: number, b: number, refs: InteractionRefs): void {
  if (refs.viewModeRef.current === 'buildings') {
    const bld = refs.buildingsDataRef.current[entityId];
    if (!bld) return;
    for (const rid of bld.roomIds) paintRoomVertices(rid, r, g, b, refs);
  } else {
    paintRoomVertices(entityId, r, g, b, refs);
  }
}

export function restoreEntity(entityId: number, refs: InteractionRefs): void {
  if (refs.viewModeRef.current === 'buildings') {
    const bld = refs.buildingsDataRef.current[entityId];
    if (!bld) return;
    for (const rid of bld.roomIds) restoreRoomVertices(rid, refs);
  } else {
    restoreRoomVertices(entityId, refs);
  }
}

export function selectEntity(
  entityId: number, additive: boolean,
  refs: InteractionRefs,
  setSelectedIds: (v: Set<number>) => void
): void {
  const prev = refs.selectedIdsRef.current;
  if (!additive) { prev.forEach(id => restoreEntity(id, refs)); prev.clear(); }
  if (prev.has(entityId)) {
    prev.delete(entityId);
    restoreEntity(entityId, refs);
  } else {
    prev.add(entityId);
    paintEntity(entityId, ...SELECT_CLR, refs);
  }
  const next = new Set(prev);
  refs.selectedIdsRef.current = next;
  setSelectedIds(next);
}

export function clearSelection(refs: InteractionRefs, setSelectedIds: (v: Set<number>) => void): void {
  refs.selectedIdsRef.current.forEach(id => restoreEntity(id, refs));
  refs.selectedIdsRef.current.clear();
  setSelectedIds(new Set());
}

export function hoverEntity(
  entityId: number | null,
  refs: InteractionRefs,
  setHoveredId: (v: number | null) => void
): void {
  if (refs.hoveredIdRef.current === entityId) return;
  const prev = refs.hoveredIdRef.current;
  if (prev !== null && !refs.selectedIdsRef.current.has(prev)) restoreEntity(prev, refs);
  refs.hoveredIdRef.current = entityId;
  setHoveredId(entityId);
  if (entityId !== null && !refs.selectedIdsRef.current.has(entityId)) paintEntity(entityId, ...HOVER_CLR, refs);
}

export function boxSelect(
  boxStart: { x: number; y: number },
  boxEnd: { x: number; y: number },
  container: HTMLDivElement,
  camera: THREE.PerspectiveCamera,
  refs: InteractionRefs,
  setSelectedIds: (v: Set<number>) => void
): void {
  clearSelection(refs, setSelectedIds);
  const w = container.clientWidth, h = container.clientHeight;
  const minX = Math.min(boxStart.x, boxEnd.x), maxX = Math.max(boxStart.x, boxEnd.x);
  const minY = Math.min(boxStart.y, boxEnd.y), maxY = Math.max(boxStart.y, boxEnd.y);
  const rect = container.getBoundingClientRect();
  const newSel = new Set<number>();
  const entities = refs.viewModeRef.current === 'buildings'
    ? refs.buildingsDataRef.current.map(b => ({ id: b.id, center: b.center }))
    : refs.roomsDataRef.current.map(r => ({ id: r.id, center: r.center }));
  for (const ent of entities) {
    const proj = ent.center.clone().project(camera);
    const sx = (proj.x + 1) / 2 * w + rect.left;
    const sy = (-proj.y + 1) / 2 * h + rect.top;
    if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
      newSel.add(ent.id);
      paintEntity(ent.id, ...BOX_CLR, refs);
    }
  }
  refs.selectedIdsRef.current = newSel;
  setSelectedIds(new Set(newSel));
}

export function exportSelected(refs: InteractionRefs): void {
  const orig = refs.originalDataRef.current;
  if (!orig || refs.selectedIdsRef.current.size === 0) return;
  const roomToBuildingName = new Map<number, string>();
  const selRoomIds = new Set<number>();
  if (refs.viewModeRef.current === 'buildings') {
    for (const bid of refs.selectedIdsRef.current) {
      const b = refs.buildingsDataRef.current[bid];
      if (!b) continue;
      for (const rid of b.roomIds) { selRoomIds.add(rid); roomToBuildingName.set(rid, b.name); }
    }
  } else {
    for (const rid of refs.selectedIdsRef.current) {
      selRoomIds.add(rid);
      const bid = refs.roomToBuildingRef.current[rid];
      roomToBuildingName.set(rid, refs.buildingsDataRef.current[bid]?.name ?? `Budova_${bid + 1}`);
    }
  }
  const exportRooms = (orig.rooms || [])
    .map((r, i) => ({ r, i })).filter(({ i }) => selRoomIds.has(i))
    .map(({ r, i }) => ({ ...r, user_data: { ...(r.user_data || {}), building_id: roomToBuildingName.get(i) ?? `Budova_${i+1}` } }));
  const buildingCount = new Set(roomToBuildingName.values()).size;
  const label = `${buildingCount}_buildings_${exportRooms.length}_rooms`;
  const exportData = { ...orig, display_name: `${orig.display_name || 'Model'}_export_${label}`, rooms: exportRooms };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `export_${label}.hbjson`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
