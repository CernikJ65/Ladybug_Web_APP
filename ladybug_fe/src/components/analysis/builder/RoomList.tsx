import React from 'react';
import type { Room } from './HbjsonBuilderTypes';

interface RoomListProps {
  floorId: string;
  rooms: Room[];
  selectedRoom: string | null;
  onSelectRoom: (roomId: string) => void;
  onAddRoom: () => void;
  onRemoveRoom: (roomId: string) => void;
  onUpdateRoom: (roomId: string, field: keyof Room, value: string | number) => void;
}

const RoomList: React.FC<RoomListProps> = ({
  rooms,
  selectedRoom,
  onSelectRoom,
  onAddRoom,
  onRemoveRoom,
  onUpdateRoom
}) => {
  return (
    <div className="builder-section">
      <div className="builder-section-header">
        <h3>Místnosti</h3>
        <button onClick={onAddRoom} className="btn-add">
          + Přidat místnost
        </button>
      </div>

      <div className="builder-list">
        {rooms.length === 0 ? (
          <div className="builder-empty">
            Žádné místnosti. Klikněte na "+ Přidat místnost" pro vytvoření.
          </div>
        ) : (
          rooms.map((room) => {
            const area = room.width * room.length;
            const volume = area * room.height;

            return (
              <div
                key={room.id}
                className={`builder-item ${selectedRoom === room.id ? 'selected' : ''}`}
                onClick={() => onSelectRoom(room.id)}
              >
                <div className="builder-item-header">
                  <span className="builder-item-title">{room.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRoom(room.id);
                    }}
                    className="btn-remove"
                    title="Odstranit místnost"
                  >
                    ×
                  </button>
                </div>

                <div className="builder-item-info">
                  {room.width}×{room.length}×{room.height}m | {area.toFixed(1)}m²
                </div>

                {selectedRoom === room.id && (
                  <div className="builder-item-details">
                    <div className="form-group">
                      <label>Název místnosti</label>
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => onUpdateRoom(room.id, 'name', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Název místnosti"
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Šířka (m)</label>
                        <input
                          type="number"
                          value={room.width}
                          onChange={(e) => onUpdateRoom(room.id, 'width', parseFloat(e.target.value) || 0)}
                          onClick={(e) => e.stopPropagation()}
                          step="0.1"
                          min="0.1"
                        />
                      </div>

                      <div className="form-group">
                        <label>Délka (m)</label>
                        <input
                          type="number"
                          value={room.length}
                          onChange={(e) => onUpdateRoom(room.id, 'length', parseFloat(e.target.value) || 0)}
                          onClick={(e) => e.stopPropagation()}
                          step="0.1"
                          min="0.1"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Výška stropu (m)</label>
                      <input
                        type="number"
                        value={room.height}
                        onChange={(e) => onUpdateRoom(room.id, 'height', parseFloat(e.target.value) || 0)}
                        onClick={(e) => e.stopPropagation()}
                        step="0.1"
                        min="2"
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Pozice X (m)</label>
                        <input
                          type="number"
                          value={room.positionX}
                          onChange={(e) => onUpdateRoom(room.id, 'positionX', parseFloat(e.target.value) || 0)}
                          onClick={(e) => e.stopPropagation()}
                          step="0.1"
                          min="0"
                        />
                      </div>

                      <div className="form-group">
                        <label>Pozice Y (m)</label>
                        <input
                          type="number"
                          value={room.positionY}
                          onChange={(e) => onUpdateRoom(room.id, 'positionY', parseFloat(e.target.value) || 0)}
                          onClick={(e) => e.stopPropagation()}
                          step="0.1"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="builder-info">
                      Plocha: {area.toFixed(1)} m² | Objem: {volume.toFixed(1)} m³ | Oken: {room.windows.length}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RoomList;