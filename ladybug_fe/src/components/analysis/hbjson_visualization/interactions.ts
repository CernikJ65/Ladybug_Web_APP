import * as THREE from 'three';
import type { RoomInfo, BuildingInfo, HBJSONData, HBShade, ViewMode } from './types';
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

/**
 * Sirka pasu kolem bboxu vybranych budov v metrech.
 * Polygony shadu (teren) se orezou na tento rozsireny bbox v XY.
 * Z souradnice se zachova nebo interpoluje pri orezani na hrane.
 */
const TERRAIN_PROXIMITY_M = 1.0;

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

/**
 * Sutherland-Hodgman clipping: orezne obecny 3D polygon proti
 * axis-aligned obdelniku v XY rovine. Z souradnice se linearne
 * interpoluje na hranach. Pokud byl vstupni polygon rovinny,
 * zustane rovinny i po orezani (vsechny pruseciky lezi v puvodni rovine).
 *
 * Vraci pole vrcholu — muze byt prazdne (polygon je cely mimo box),
 * mit min 3 vrcholy (mirny prekryv) nebo az 8 vrcholu (polygon obklopuje box).
 */
function clipPolygonToBoxXY(
  poly: number[][],
  minX: number, maxX: number, minY: number, maxY: number,
): number[][] {
  if (poly.length < 3) return [];

  // Ctyri orezavaci hrany. Pro kazdou:
  //   test(p)        — je vrchol uvnitr (vuci teto hrane)?
  //   intersect(a,b) — kde hrana polygonu (a→b) protina orezavaci hranu?
  // Z se vzdy interpoluje linearne.
  const edges: Array<{
    test: (p: number[]) => boolean;
    intersect: (a: number[], b: number[]) => number[];
  }> = [
    { // x >= minX
      test: p => p[0] >= minX,
      intersect: (a, b) => {
        const t = (minX - a[0]) / (b[0] - a[0]);
        return [minX, a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
      },
    },
    { // x <= maxX
      test: p => p[0] <= maxX,
      intersect: (a, b) => {
        const t = (maxX - a[0]) / (b[0] - a[0]);
        return [maxX, a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
      },
    },
    { // y >= minY
      test: p => p[1] >= minY,
      intersect: (a, b) => {
        const t = (minY - a[1]) / (b[1] - a[1]);
        return [a[0] + t * (b[0] - a[0]), minY, a[2] + t * (b[2] - a[2])];
      },
    },
    { // y <= maxY
      test: p => p[1] <= maxY,
      intersect: (a, b) => {
        const t = (maxY - a[1]) / (b[1] - a[1]);
        return [a[0] + t * (b[0] - a[0]), maxY, a[2] + t * (b[2] - a[2])];
      },
    },
  ];

  let output: number[][] = poly.slice();
  for (const edge of edges) {
    if (output.length === 0) break;
    const input = output;
    output = [];
    let s = input[input.length - 1];
    let sInside = edge.test(s);
    for (const e of input) {
      const eInside = edge.test(e);
      if (eInside) {
        if (!sInside) output.push(edge.intersect(s, e));
        output.push(e);
      } else if (sInside) {
        output.push(edge.intersect(s, e));
      }
      s = e;
      sInside = eInside;
    }
  }
  return output;
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

  // Spocitej spolecny axis-aligned bbox vybranych mistnosti v XY.
  // Z se neorezava — teren se necha ve svem Z rozsahu nezavisle na vysce budov.
  let bMinX = Infinity, bMaxX = -Infinity;
  let bMinY = Infinity, bMaxY = -Infinity;
  for (const rid of selRoomIds) {
    const r = refs.roomsDataRef.current[rid];
    if (!r) continue;
    if (r.minX < bMinX) bMinX = r.minX;
    if (r.maxX > bMaxX) bMaxX = r.maxX;
    if (r.minY < bMinY) bMinY = r.minY;
    if (r.maxY > bMaxY) bMaxY = r.maxY;
  }
  const bboxValid = bMinX !== Infinity;

  // Orezavaci box = bbox vybranych mistnosti rozsireny o TERRAIN_PROXIMITY_M
  // do vsech ctyr stran v XY.
  const clipMinX = bMinX - TERRAIN_PROXIMITY_M;
  const clipMaxX = bMaxX + TERRAIN_PROXIMITY_M;
  const clipMinY = bMinY - TERRAIN_PROXIMITY_M;
  const clipMaxY = bMaxY + TERRAIN_PROXIMITY_M;

  /**
   * Orezne shade polygon na clipping box. Vraci:
   *   - null pokud shade nema platnou geometrii nebo je cely mimo box
   *   - puvodni shade beze zmeny, pokud byl cely uvnitr (zachovani meta-dat)
   *   - novy shade s orezanou geometrii v ostatnich pripadech
   */
  const clipShade = (shade: HBShade): HBShade | null => {
    if (!bboxValid) return null;
    const b = shade.geometry?.boundary;
    if (!b || b.length < 3) return null;

    const clipped = clipPolygonToBoxXY(b, clipMinX, clipMaxX, clipMinY, clipMaxY);
    if (clipped.length < 3) return null;

    // Optimalizace: pokud orezani neprovedlo zadnou zmenu (vsechny vrcholy
    // jsou identicke), vratime puvodni shade beze zmeny — nezavedeme tim
    // floating-point drift do nezmenenych polygonu.
    if (clipped.length === b.length) {
      let identical = true;
      for (let i = 0; i < b.length; i++) {
        if (b[i][0] !== clipped[i][0] || b[i][1] !== clipped[i][1] || b[i][2] !== clipped[i][2]) {
          identical = false; break;
        }
      }
      if (identical) return shade;
    }

    return {
      ...shade,
      geometry: {
        ...shade.geometry,
        boundary: clipped,
      },
    };
  };

  const buildingCount = new Set(roomToBuildingName.values()).size;
  const label = `${buildingCount}_buildings_${exportRooms.length}_rooms`;

  // Zachovavame strukturu (orphaned_shades vs shades) z puvodnich dat.
  const exportData: HBJSONData = {
    ...orig,
    display_name: `${orig.display_name || 'Model'}_export_${label}`,
    rooms: exportRooms,
  };
  if (orig.orphaned_shades) {
    exportData.orphaned_shades = orig.orphaned_shades
      .map(clipShade)
      .filter((s): s is HBShade => s !== null);
  }
  if (orig.shades) {
    exportData.shades = orig.shades
      .map(clipShade)
      .filter((s): s is HBShade => s !== null);
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `export_${label}.hbjson`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}