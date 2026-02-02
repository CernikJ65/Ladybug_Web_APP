import React from 'react';
import type { Floor } from './HbjsonBuilderTypes';

interface FloorListProps {
  buildingId: string;
  floors: Floor[];
  selectedFloor: string | null;
  onSelectFloor: (floorId: string) => void;
  onAddFloor: () => void;
  onRemoveFloor: (floorId: string) => void;
  onUpdateFloor: (floorId: string, field: keyof Floor, value: string | number) => void;
}

const FloorList: React.FC<FloorListProps> = ({
  floors,
  selectedFloor,
  onSelectFloor,
  onAddFloor,
  onRemoveFloor,
  onUpdateFloor
}) => {
  return (
    <div className="builder-section">
      <div className="builder-section-header">
        <h3>Patra</h3>
        <button onClick={onAddFloor} className="btn-add">
          + Přidat patro
        </button>
      </div>

      <div className="builder-list">
        {floors.length === 0 ? (
          <div className="builder-empty">
            Žádná patra. Klikněte na "+ Přidat patro" pro vytvoření.
          </div>
        ) : (
          floors.map((floor) => (
            <div
              key={floor.id}
              className={`builder-item ${selectedFloor === floor.id ? 'selected' : ''}`}
              onClick={() => onSelectFloor(floor.id)}
            >
              <div className="builder-item-header">
                <span className="builder-item-title">{floor.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFloor(floor.id);
                  }}
                  className="btn-remove"
                  title="Odstranit patro"
                >
                  ×
                </button>
              </div>

              {selectedFloor === floor.id && (
                <div className="builder-item-details">
                  <div className="form-group">
                    <label>Název patra</label>
                    <input
                      type="text"
                      value={floor.name}
                      onChange={(e) => onUpdateFloor(floor.id, 'name', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Název patra"
                    />
                  </div>

                  <div className="form-group">
                    <label>Výška podlaží (m)</label>
                    <input
                      type="number"
                      value={floor.elevation}
                      onChange={(e) => onUpdateFloor(floor.id, 'elevation', parseFloat(e.target.value) || 0)}
                      onClick={(e) => e.stopPropagation()}
                      step="0.1"
                      min="0"
                    />
                  </div>

                  <div className="builder-info">
                    Počet místností: {floor.rooms.length}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FloorList;