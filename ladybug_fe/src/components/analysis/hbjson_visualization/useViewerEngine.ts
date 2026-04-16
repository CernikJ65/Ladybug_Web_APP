import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { HBJSONData, RoomInfo, BuildingInfo, ModelStats, ViewMode } from './types';
import { buildModel } from './buildModel';
import { selectEntity, clearSelection, hoverEntity, boxSelect, exportSelected } from './interactions';
import type { InteractionRefs } from './interactions';
import { createScene } from './sceneSetup';
import { attachInputHandlers } from './inputHandlers';

export interface ViewerSetters {
  setSelectedIds: (v: Set<number>) => void;
  setHoveredId: (v: number | null) => void;
  setRooms: (v: RoomInfo[]) => void;
  setBuildings: (v: BuildingInfo[]) => void;
  setStats: (v: ModelStats | null) => void;
}

export function useViewerEngine(
  containerRef: React.RefObject<HTMLDivElement | null>,
  setters: ViewerSetters,
) {
  const settersRef = useRef(setters);
  settersRef.current = setters;

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
  const clearSelFnRef = useRef<(() => void) | null>(null);
  const selectByIdFnRef = useRef<((id: number, additive: boolean) => void) | null>(null);
  const exportFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const { scene, camera, renderer, ground, grid } = createScene(container, cameraTargetRef.current);
    groundRef.current = ground;
    gridRef.current = grid;
    targetZoomRef.current = camera.position.distanceTo(cameraTargetRef.current);

    const boxEl = document.createElement('div');
    boxEl.className = 'hbjson-viewer__box-select';
    container.appendChild(boxEl); boxElRef.current = boxEl;

    const iRefs: InteractionRefs = {
      solidMeshRef, originalColorsRef, roomsDataRef, buildingsDataRef,
      roomToBuildingRef, originalDataRef, selectedIdsRef, hoveredIdRef, viewModeRef,
    };

    const doSelectEntity = (id: number, additive: boolean) => selectEntity(id, additive, iRefs, settersRef.current.setSelectedIds);
    const doClearSelection = () => clearSelection(iRefs, settersRef.current.setSelectedIds);
    const doHoverEntity = (id: number | null) => hoverEntity(id, iRefs, settersRef.current.setHoveredId);
    const doBoxSelect2 = () => boxSelect(boxStartRef.current, boxEndRef.current, container, camera, iRefs, settersRef.current.setSelectedIds);
    const doExport = () => exportSelected(iRefs);
    const resetView = () => {
      if (initialCamRef.current) {
        camera.position.copy(initialCamRef.current.pos);
        cameraTargetRef.current.copy(initialCamRef.current.target);
        camera.lookAt(cameraTargetRef.current);
        targetZoomRef.current = camera.position.distanceTo(cameraTargetRef.current);
      }
    };

    const doBuildModel = (data: HBJSONData) => {
      const result = buildModel(data, scene, camera, {
        solidMeshRef, originalColorsRef, triangleToRoomRef, roomsDataRef, buildingsDataRef,
        roomToBuildingRef, originalDataRef, selectedIdsRef, hoveredIdRef, opacityRef, groundRef, gridRef,
      }, settersRef.current);
      if (result) {
        cameraTargetRef.current.copy(result.center);
        const pos = camera.position.clone();
        initialCamRef.current = { pos, target: result.center.clone() };
        targetZoomRef.current = pos.distanceTo(result.center);
      }
    };

    const triHitToEntityId = (faceIndex: number): number => {
      const roomId = triangleToRoomRef.current[faceIndex];
      if (roomId < 0) return -1;
      return viewModeRef.current === 'buildings' ? (roomToBuildingRef.current[roomId] ?? -1) : roomId;
    };

    const cleanupInput = attachInputHandlers(scene, camera, renderer, container, {
      raycaster: raycasterRef, cameraTarget: cameraTargetRef, targetZoom: targetZoomRef,
      initialCam: initialCamRef, isDragging: isDraggingRef, isPanning: isPanningRef,
      prevMouse: prevMouseRef, mouseDownTime: mouseDownTimeRef, keys: keysRef,
      lastRaycast: lastRaycastRef, isBoxSelecting: isBoxSelectingRef, boxStart: boxStartRef,
      boxEnd: boxEndRef, boxEl: boxElRef, highlightHover: highlightHoverRef, solidMesh: solidMeshRef,
    }, { triHitToEntityId, doSelectEntity, doClearSelection, doHoverEntity, doBoxSelect: doBoxSelect2, resetView });

    buildModelFnRef.current = doBuildModel;
    clearSelFnRef.current = doClearSelection;
    selectByIdFnRef.current = doSelectEntity;
    exportFnRef.current = doExport;

    return () => {
      cleanupInput();
      if (boxElRef.current && container.contains(boxElRef.current)) container.removeChild(boxElRef.current);
      renderer.dispose(); scene.clear();
      const canvas = renderer.domElement;
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    solidMeshRef, gridRef, opacityRef, highlightHoverRef,
    viewModeRef, hoveredIdRef, roomsDataRef, buildingsDataRef,
    buildModelFn: buildModelFnRef, clearSelFn: clearSelFnRef,
    selectByIdFn: selectByIdFnRef, exportFn: exportFnRef,
  };
}
