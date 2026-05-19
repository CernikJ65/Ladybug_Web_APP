import React from 'react';
import type { Window } from './HbjsonBuilderTypes';
import { useT } from '../../../i18n/useT';

interface WindowListProps {
  roomId: string;
  windows: Window[];
  onAddWindow: () => void;
  onRemoveWindow: (windowId: string) => void;
  onUpdateWindow: (windowId: string, field: keyof Window, value: string | number) => void;
}

const WindowList: React.FC<WindowListProps> = ({
  windows,
  onAddWindow,
  onRemoveWindow,
  onUpdateWindow
}) => {
  const t = useT();
  return (
    <div className="builder-subsection">
      <div className="builder-subsection-header">
        <h4>{t('Okna')}</h4>
        <button onClick={onAddWindow} className="btn-add-small">
          {t('+ Přidat okno')}
        </button>
      </div>

      <div className="builder-list">
        {windows.length === 0 ? (
          <div className="builder-empty-small">
            {t('Žádná okna. Klikněte na "+ Přidat okno".')}
          </div>
        ) : (
          windows.map((window, index) => {
            const area = window.width * window.height;

            return (
              <div key={window.id} className="builder-subitem">
                <div className="builder-subitem-header">
                  <span className="builder-subitem-title">
                    {t('Okno {{n}} ({{wall}})', { n: index + 1, wall: window.wall })}
                  </span>
                  <button
                    onClick={() => onRemoveWindow(window.id)}
                    className="btn-remove-small"
                    title={t('Odstranit okno')}
                  >
                    ×
                  </button>
                </div>

                <div className="builder-subitem-info">
                  {window.width}×{window.height}m | {area.toFixed(2)}m²
                </div>

                <div className="form-group">
                  <label>{t('Stěna')}</label>
                  <select
                    value={window.wall}
                    onChange={(e) => onUpdateWindow(window.id, 'wall', e.target.value as 'north' | 'south' | 'east' | 'west')}
                  >
                    <option value="north">{t('Sever')}</option>
                    <option value="south">{t('Jih')}</option>
                    <option value="east">{t('Východ')}</option>
                    <option value="west">{t('Západ')}</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{t('Šířka (m)')}</label>
                    <input
                      type="number"
                      value={window.width}
                      onChange={(e) => onUpdateWindow(window.id, 'width', parseFloat(e.target.value) || 0)}
                      step="0.1"
                      min="0.1"
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('Výška (m)')}</label>
                    <input
                      type="number"
                      value={window.height}
                      onChange={(e) => onUpdateWindow(window.id, 'height', parseFloat(e.target.value) || 0)}
                      step="0.1"
                      min="0.1"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{t('Pozice od kraje (m)')}</label>
                    <input
                      type="number"
                      value={window.positionX}
                      onChange={(e) => onUpdateWindow(window.id, 'positionX', parseFloat(e.target.value) || 0)}
                      step="0.1"
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('Výška od podlahy (m)')}</label>
                    <input
                      type="number"
                      value={window.positionZ}
                      onChange={(e) => onUpdateWindow(window.id, 'positionZ', parseFloat(e.target.value) || 0)}
                      step="0.1"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WindowList;