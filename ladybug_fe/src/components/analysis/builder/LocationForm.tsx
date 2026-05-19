import React from 'react';
import type { Location } from './HbjsonBuilderTypes';
import { useT } from '../../../i18n/useT';

interface LocationFormProps {
  location: Location;
  onUpdateLocation: (field: keyof Location, value: string | number) => void;
}

const LocationForm: React.FC<LocationFormProps> = ({ location, onUpdateLocation }) => {
  const t = useT();
  return (
    <div className="builder-section">
      <div className="builder-section-header">
        <h3>{t('Lokalita projektu')}</h3>
      </div>

      <div className="builder-form">
        <div className="form-group">
          <label>{t('Město')}</label>
          <input
            type="text"
            value={location.city}
            onChange={(e) => onUpdateLocation('city', e.target.value)}
            placeholder={t('Název města')}
          />
        </div>

        <div className="form-group">
          <label>{t('Zeměpisná šířka')}</label>
          <input
            type="number"
            value={location.latitude}
            onChange={(e) => onUpdateLocation('latitude', parseFloat(e.target.value) || 0)}
            step="0.0001"
            placeholder="50.0755"
          />
        </div>

        <div className="form-group">
          <label>{t('Zeměpisná délka')}</label>
          <input
            type="number"
            value={location.longitude}
            onChange={(e) => onUpdateLocation('longitude', parseFloat(e.target.value) || 0)}
            step="0.0001"
            placeholder="14.4378"
          />
        </div>

        <div className="form-group">
          <label>{t('Časová zóna')}</label>
          <input
            type="text"
            value={location.timezone}
            onChange={(e) => onUpdateLocation('timezone', e.target.value)}
            placeholder="Europe/Prague"
          />
        </div>
      </div>
    </div>
  );
};

export default LocationForm;