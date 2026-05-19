import React from 'react';
import type { Building } from './HbjsonBuilderTypes';
import { useT } from '../../../i18n/useT';

interface BuildingListProps {
  buildings: Building[];
  selectedBuilding: string | null;
  onSelectBuilding: (buildingId: string) => void;
  onAddBuilding: () => void;
  onRemoveBuilding: (buildingId: string) => void;
  onUpdateBuilding: (buildingId: string, field: keyof Building, value: string | number) => void;
}

const BuildingList: React.FC<BuildingListProps> = ({
  buildings,
  selectedBuilding,
  onSelectBuilding,
  onAddBuilding,
  onRemoveBuilding,
  onUpdateBuilding
}) => {
  const t = useT();
  return (
    <div className="builder-section">
      <div className="builder-section-header">
        <h3>{t('Budovy')}</h3>
        <button onClick={onAddBuilding} className="btn-add">
          {t('+ Přidat budovu')}
        </button>
      </div>

      <div className="builder-list">
        {buildings.length === 0 ? (
          <div className="builder-empty">
            {t('Žádné budovy. Klikněte na "+ Přidat budovu" pro vytvoření.')}
          </div>
        ) : (
          buildings.map((building) => (
            <div
              key={building.id}
              className={`builder-item ${selectedBuilding === building.id ? 'selected' : ''}`}
              onClick={() => onSelectBuilding(building.id)}
            >
              <div className="builder-item-header">
                <span className="builder-item-title">{building.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveBuilding(building.id);
                  }}
                  className="btn-remove"
                  title={t('Odstranit budovu')}
                >
                  ×
                </button>
              </div>

              <div className="builder-item-info">
                {t('Pater')}: {building.floors.length}
              </div>

              {selectedBuilding === building.id && (
                <div className="builder-item-details">
                  <div className="form-group">
                    <label>{t('Název budovy')}</label>
                    <input
                      type="text"
                      value={building.name}
                      onChange={(e) => onUpdateBuilding(building.id, 'name', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={t('Název budovy')}
                    />
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

export default BuildingList;