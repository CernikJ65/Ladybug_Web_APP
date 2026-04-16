import React from 'react';
import type { RoomInfo, BuildingInfo, ModelStats, ViewMode } from './types';

interface Props {
  viewMode: ViewMode;
  opacity: number;
  showGrid: boolean;
  highlightHover: boolean;
  stats: ModelStats | null;
  rooms: RoomInfo[];
  buildings: BuildingInfo[];
  selectedIds: Set<number>;
  hoveredId: number | null;
  selRoom: RoomInfo | null;
  selBuilding: BuildingInfo | null;
  multiSelRoomCount: number;
  multiSelFaceCount: number;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onViewMode: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onOpacity: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGrid: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHighlight: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSelection: () => void;
  onExport: () => void;
  onSelectById: (id: number, additive: boolean) => void;
}

const ViewerPanel: React.FC<Props> = ({
  viewMode, opacity, showGrid, highlightHover,
  stats, rooms, buildings, selectedIds, hoveredId,
  selRoom, selBuilding, multiSelRoomCount, multiSelFaceCount,
  onFile, onViewMode, onOpacity, onGrid, onHighlight,
  onClearSelection, onExport, onSelectById,
}) => {
  const selCount = selectedIds.size;
  return (
    <>
      <h3>HBJSON Viewer</h3>
      <div className="hbjson-viewer__file-input">
        <input type="file" id="fileInput" accept=".hbjson,.json" onChange={onFile} />
        <label htmlFor="fileInput" className="hbjson-viewer__file-label">Načíst HBJSON soubor</label>
      </div>
      <div className="hbjson-viewer__controls">
        <div className="hbjson-viewer__field">
          <label>Pohled</label>
          <select value={viewMode} onChange={onViewMode}>
            <option value="buildings">Budovy</option>
            <option value="rooms">Místnosti</option>
          </select>
        </div>
        <div className="hbjson-viewer__field">
          <label>Průhlednost <span className="hbjson-viewer__val">{opacity}%</span></label>
          <input type="range" min="10" max="100" value={opacity} onChange={onOpacity} />
        </div>
        <div className="hbjson-viewer__row">
          <button onClick={onClearSelection}>Zrušit výběr</button>
          <button disabled={selCount === 0} onClick={onExport}>Export ({selCount})</button>
        </div>
        <div className="hbjson-viewer__checks">
          <label><input type="checkbox" checked={showGrid} onChange={onGrid} /> Mřížka</label>
          <label><input type="checkbox" checked={highlightHover} onChange={onHighlight} /> Hover</label>
        </div>
      </div>

      {selCount > 0 && (
        <div className="hbjson-viewer__selection">
          <h4>{viewMode === 'buildings' ? (selCount === 1 ? 'Vybraná budova' : `Výběr: ${selCount} budov`) : (selCount === 1 ? 'Vybraná místnost' : `Výběr: ${selCount} místností`)}</h4>
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
                <><span><b>Budov:</b> {selCount}</span><span><b>Místností:</b> {multiSelRoomCount}</span></>
              ) : (
                <><span><b>Místností:</b> {selCount}</span><span><b>Ploch:</b> {multiSelFaceCount}</span></>
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
              <div key={b.id} className={`hbjson-viewer__room-item${selectedIds.has(b.id) ? ' sel' : ''}${hoveredId === b.id ? ' hov' : ''}`} onClick={(e) => onSelectById(b.id, e.ctrlKey || e.metaKey)}>
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
              <div key={r.id} className={`hbjson-viewer__room-item${selectedIds.has(r.id) ? ' sel' : ''}${hoveredId === r.id ? ' hov' : ''}`} onClick={(e) => onSelectById(r.id, e.ctrlKey || e.metaKey)}>
                <span className="hbjson-viewer__room-name">{r.name}</span>
                <span className="hbjson-viewer__room-meta">{r.faceCount}f · {r.height.toFixed(0)}m</span>
              </div>
            ))}
            {rooms.length > 200 && <div className="hbjson-viewer__room-more">…a dalších {rooms.length - 200}</div>}
          </div>
        </div>
      )}

      <div className="hbjson-viewer__help">
        <b>Ovládání</b><br />
        Klik = výběr {viewMode === 'buildings' ? 'budovy' : 'místnosti'} · Ctrl+klik = přidat do výběru<br />
        Shift + tažení = box select<br />
        Tažení = rotace · Pravé tl. = posuv · Kolečko = zoom<br />
        Šipky / WASD = pohyb · R = reset · Esc = zrušit
      </div>
    </>
  );
};

export default ViewerPanel;
