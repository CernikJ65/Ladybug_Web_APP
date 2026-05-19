import React from 'react';
import type { RoomInfo, BuildingInfo, ModelStats, ViewMode } from './types';
import { useT } from '../../../i18n/useT';

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
  const t = useT();
  const selCount = selectedIds.size;
  return (
    <>
      <h3>HBJSON Viewer</h3>
      <div className="hbjson-viewer__file-input">
        <input type="file" id="fileInput" accept=".hbjson,.json" onChange={onFile} />
        <label htmlFor="fileInput" className="hbjson-viewer__file-label">{t('Načíst HBJSON soubor')}</label>
      </div>
      <div className="hbjson-viewer__controls">
        <div className="hbjson-viewer__field">
          <label>{t('Pohled')}</label>
          <select value={viewMode} onChange={onViewMode}>
            <option value="buildings">{t('Budovy')}</option>
            <option value="rooms">{t('Místnosti')}</option>
          </select>
        </div>
        <div className="hbjson-viewer__field">
          <label>{t('Průhlednost')} <span className="hbjson-viewer__val">{opacity}%</span></label>
          <input type="range" min="10" max="100" value={opacity} onChange={onOpacity} />
        </div>
        <div className="hbjson-viewer__row">
          <button onClick={onClearSelection}>{t('Zrušit výběr')}</button>
          <button disabled={selCount === 0} onClick={onExport}>{t('Export')} ({selCount})</button>
        </div>
        <div className="hbjson-viewer__checks">
          <label><input type="checkbox" checked={showGrid} onChange={onGrid} /> {t('Mřížka')}</label>
          <label><input type="checkbox" checked={highlightHover} onChange={onHighlight} /> {t('Hover')}</label>
        </div>
      </div>

      {selCount > 0 && (
        <div className="hbjson-viewer__selection">
          <h4>{viewMode === 'buildings' ? (selCount === 1 ? t('Vybraná budova') : t('Výběr: {{n}} budov', { n: selCount })) : (selCount === 1 ? t('Vybraná místnost') : t('Výběr: {{n}} místností', { n: selCount }))}</h4>
          {selRoom && (
            <div className="hbjson-viewer__sel-detail">
              <span><b>{t('Název:')}</b> {selRoom.name}</span>
              <span><b>{t('Ploch:')}</b> {selRoom.faceCount} (W:{selRoom.wallCount} F:{selRoom.floorCount} R:{selRoom.roofCount})</span>
              <span><b>{t('Výška:')}</b> {selRoom.height.toFixed(1)} m</span>
              <span><b>{t('Rozměr střechy:')}</b> {selRoom.roofLength.toFixed(1)} × {selRoom.roofWidth.toFixed(1)} m</span>
            </div>
          )}
          {selBuilding && (
            <div className="hbjson-viewer__sel-detail">
              <span><b>{t('Název:')}</b> {selBuilding.name}</span>
              <span><b>{t('Místností:')}</b> {selBuilding.roomIds.length}</span>
              <span><b>{t('Ploch:')}</b> {selBuilding.faceCount}</span>
              <span><b>{t('Výška:')}</b> {selBuilding.height.toFixed(1)} m</span>
              <span><b>{t('Rozměr střechy:')}</b> {selBuilding.roofLength.toFixed(1)} × {selBuilding.roofWidth.toFixed(1)} m</span>
            </div>
          )}
          {!selRoom && !selBuilding && (
            <div className="hbjson-viewer__sel-detail">
              {viewMode === 'buildings' ? (
                <><span><b>{t('Budov:')}</b> {selCount}</span><span><b>{t('Místností:')}</b> {multiSelRoomCount}</span></>
              ) : (
                <><span><b>{t('Místností:')}</b> {selCount}</span><span><b>{t('Ploch:')}</b> {multiSelFaceCount}</span></>
              )}
            </div>
          )}
        </div>
      )}

      {stats && (
        <div className="hbjson-viewer__stats">
          <span><b>{t('Model:')}</b> {stats.name} <small>v{stats.version}</small></span>
          <span><b>{t('Budov:')}</b> {stats.buildingCount} &nbsp; <b>{t('Místností:')}</b> {stats.roomCount} &nbsp; <b>{t('Terén:')}</b> {stats.shadeCount}</span>
          <span><b>{t('Ploch:')}</b> {stats.faceCount.toLocaleString()}</span>
          <span><b>{t('Rozměr:')}</b> {stats.dimensions.x.toFixed(0)}×{stats.dimensions.z.toFixed(0)}×{stats.dimensions.y.toFixed(0)} m</span>
        </div>
      )}

      {viewMode === 'buildings' && buildings.length > 0 && (
        <div className="hbjson-viewer__room-list-wrap">
          <h4>{t('Budovy')} ({buildings.length})</h4>
          <div className="hbjson-viewer__room-list">
            {buildings.slice(0, 200).map(b => (
              <div key={b.id} className={`hbjson-viewer__room-item${selectedIds.has(b.id) ? ' sel' : ''}${hoveredId === b.id ? ' hov' : ''}`} onClick={(e) => onSelectById(b.id, e.ctrlKey || e.metaKey)}>
                <span className="hbjson-viewer__room-name">{b.name}</span>
                <span className="hbjson-viewer__room-meta">{b.roomIds.length}m · {b.height.toFixed(0)}m</span>
              </div>
            ))}
            {buildings.length > 200 && <div className="hbjson-viewer__room-more">{t('…a dalších {{n}}', { n: buildings.length - 200 })}</div>}
          </div>
        </div>
      )}

      {viewMode === 'rooms' && rooms.length > 0 && (
        <div className="hbjson-viewer__room-list-wrap">
          <h4>{t('Místnosti')} ({rooms.length})</h4>
          <div className="hbjson-viewer__room-list">
            {rooms.slice(0, 200).map(r => (
              <div key={r.id} className={`hbjson-viewer__room-item${selectedIds.has(r.id) ? ' sel' : ''}${hoveredId === r.id ? ' hov' : ''}`} onClick={(e) => onSelectById(r.id, e.ctrlKey || e.metaKey)}>
                <span className="hbjson-viewer__room-name">{r.name}</span>
                <span className="hbjson-viewer__room-meta">{r.faceCount}f · {r.height.toFixed(0)}m</span>
              </div>
            ))}
            {rooms.length > 200 && <div className="hbjson-viewer__room-more">{t('…a dalších {{n}}', { n: rooms.length - 200 })}</div>}
          </div>
        </div>
      )}

      <div className="hbjson-viewer__help">
        <b>{t('Ovládání')}</b><br />
        {t('Klik = výběr')} {viewMode === 'buildings' ? t('budovy') : t('místnosti')} · {t('Ctrl+klik = přidat do výběru')}<br />
        {t('Shift + tažení = box select')}<br />
        {t('Tažení = rotace · Pravé tl. = posuv · Kolečko = zoom')}<br />
        {t('Šipky / WASD = pohyb · R = reset · Esc = zrušit')}
      </div>
    </>
  );
};

export default ViewerPanel;
