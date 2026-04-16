import React, { useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FaArrowLeft } from 'react-icons/fa';
import './HBJSONViewer.css';

import type { HBJSONData, RoomInfo, BuildingInfo, ModelStats, ViewMode } from './types';
import { useViewerEngine } from './useViewerEngine';
import ViewerPanel from './ViewerPanel';

interface Props { onBack: () => void; }

const HbjsonViewer: React.FC<Props> = ({ onBack }) => {
  const containerRef = useRef<HTMLDivElement>(null);
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

  const {
    solidMeshRef, gridRef, opacityRef, highlightHoverRef,
    viewModeRef, hoveredIdRef, roomsDataRef, buildingsDataRef,
    buildModelFn, clearSelFn, selectByIdFn, exportFn,
  } = useViewerEngine(containerRef, { setSelectedIds, setHoveredId, setRooms, setBuildings, setStats });

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      requestAnimationFrame(() => {
        try { buildModelFn.current?.(JSON.parse(ev.target?.result as string) as HBJSONData); }
        catch (err) { alert('Chyba při načítání: ' + (err as Error).message); }
        finally { setIsLoading(false); }
      });
    };
    reader.readAsText(file);
  }, [buildModelFn]);

  const handleOpacity = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value);
    setOpacity(v); opacityRef.current = v;
    const mesh = solidMeshRef.current;
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshLambertMaterial;
    mat.opacity = v / 100; mat.transparent = v < 100; mat.needsUpdate = true;
  }, [opacityRef, solidMeshRef]);

  const handleGrid = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setShowGrid(e.target.checked);
    if (gridRef.current) gridRef.current.visible = e.target.checked;
  }, [gridRef]);

  const handleHighlight = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHighlightHover(e.target.checked); highlightHoverRef.current = e.target.checked;
  }, [highlightHoverRef]);

  const handleViewMode = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value as ViewMode;
    clearSelFn.current?.(); viewModeRef.current = mode; setViewMode(mode);
    hoveredIdRef.current = null; setHoveredId(null);
  }, [clearSelFn, viewModeRef, hoveredIdRef]);

  const selCount = selectedIds.size;
  const firstId = selCount === 1 ? Array.from(selectedIds)[0] : -1;
  const selRoom = (viewMode === 'rooms' && firstId >= 0) ? roomsDataRef.current[firstId] : null;
  const selBuilding = (viewMode === 'buildings' && firstId >= 0) ? buildingsDataRef.current[firstId] : null;
  const multiSelRoomCount = (viewMode === 'buildings' && selCount > 1)
    ? Array.from(selectedIds).reduce((s, id) => s + (buildingsDataRef.current[id]?.roomIds.length || 0), 0) : 0;
  const multiSelFaceCount = (viewMode === 'rooms' && selCount > 1)
    ? Array.from(selectedIds).reduce((s, id) => s + (roomsDataRef.current[id]?.faceCount || 0), 0) : 0;

  return (
    <div className="hbjson-viewer">
      <button className="hbjson-viewer__back" onClick={onBack} aria-label="Zpět"><FaArrowLeft /> Zpět</button>
      <button className={`hbjson-viewer__toggle${panelOpen ? ' open' : ''}`} onClick={() => setPanelOpen(p => !p)} aria-label={panelOpen ? 'Skrýt panel' : 'Zobrazit panel'}>{panelOpen ? '×' : '☰'}</button>
      <div className={`hbjson-viewer__panel${panelOpen ? '' : ' collapsed'}`}>
        <ViewerPanel
          viewMode={viewMode} opacity={opacity} showGrid={showGrid} highlightHover={highlightHover}
          stats={stats} rooms={rooms} buildings={buildings} selectedIds={selectedIds} hoveredId={hoveredId}
          selRoom={selRoom} selBuilding={selBuilding}
          multiSelRoomCount={multiSelRoomCount} multiSelFaceCount={multiSelFaceCount}
          onFile={handleFile} onViewMode={handleViewMode} onOpacity={handleOpacity}
          onGrid={handleGrid} onHighlight={handleHighlight}
          onClearSelection={() => clearSelFn.current?.()}
          onExport={() => exportFn.current?.()}
          onSelectById={(id, additive) => selectByIdFn.current?.(id, additive)}
        />
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
