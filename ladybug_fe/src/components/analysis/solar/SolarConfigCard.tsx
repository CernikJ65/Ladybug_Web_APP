import React from 'react';
import {
  FaSolarPanel, FaCog, FaSun, FaSpinner, FaArrowRight,
} from 'react-icons/fa';
import type { TFn } from '../../../i18n/useT';
import SolarSlider from './SolarSlider';
import AppleSelect from './AppleSelect';
import { PV_EFF_MIN, PV_EFF_MAX } from './solarConstants';

interface Props {
  numPanels: number;
  pvEff: number;
  maxTilt: number;
  mountType: string;
  loading: boolean;
  disabled: boolean;
  onNumPanelsChange: (v: number) => void;
  onPvEffChange: (v: number) => void;
  onMaxTiltChange: (v: number) => void;
  onMountTypeChange: (v: string) => void;
  onRun: () => void;
  t: TFn;
}

const SolarConfigCard: React.FC<Props> = ({
  numPanels, pvEff, maxTilt, mountType,
  loading, disabled,
  onNumPanelsChange, onPvEffChange, onMaxTiltChange, onMountTypeChange,
  onRun, t,
}) => {
  const MOUNT_TYPE_OPTIONS = [
    { value: 'FixedOpenRack',    label: t('Otevřená konstrukce') },
    { value: 'FixedRoofMounted', label: t('Střešní montáž') },
  ];

  return (
    <div className="saa-card saa-config-card">
      <div className="saa-card-head">
        <span className="saa-card-icon"><FaSolarPanel /></span>
        <div>
          <h2>{t('Konfigurace simulace')}</h2>
          <p className="saa-card-sub">{t('Počet panelů a parametry simulace')}</p>
        </div>
      </div>

      <div className="saa-stepper">
        <span className="saa-stepper-label"><FaSolarPanel /> {t('Počet panelů')}</span>
        <div className="saa-stepper-control">
          <button
            type="button"
            className="saa-stepper-btn"
            onClick={() => onNumPanelsChange(Math.max(1, numPanels - 1))}
          >−</button>
          <input
            type="number"
            className="saa-stepper-val"
            min={1}
            max={500}
            value={numPanels}
            onChange={e => onNumPanelsChange(Math.max(1, +e.target.value))}
          />
          <button
            type="button"
            className="saa-stepper-btn"
            onClick={() => onNumPanelsChange(Math.min(500, numPanels + 1))}
          >+</button>
        </div>
      </div>

      <details className="saa-params">
        <summary><FaCog /> {t('Pokročilé parametry')}</summary>
        <div className="saa-params-body">
          <SolarSlider
            label={t('Účinnost panelu')}
            value={pvEff}
            min={PV_EFF_MIN}
            max={PV_EFF_MAX}
            unit="%"
            hint=""
            onChange={onPvEffChange}
          />
          <SolarSlider
            label={t('Maximální sklon střechy')}
            value={maxTilt}
            min={30}
            max={90}
            unit="°"
            hint={t('Plochy nad tímto sklonem se přeskočí')}
            onChange={onMaxTiltChange}
          />
          <div className="saa-select-row">
            <label>{t('Typ montáže')}</label>
            <AppleSelect
              value={mountType}
              options={MOUNT_TYPE_OPTIONS}
              onChange={onMountTypeChange}
              ariaLabel={t('Typ montáže')}
            />
          </div>
        </div>
      </details>

      <button
        onClick={onRun}
        disabled={disabled}
        className="saa-run"
      >
        <span className="saa-run-mark">
          {loading ? <FaSpinner className="saa-spin" /> : <FaSun />}
        </span>
        <span className="saa-run-copy">
          {loading ? t('Počítám pvlib + Radiance…') : t('Spustit optimalizaci')}
        </span>
        {!loading && <FaArrowRight className="saa-run-arrow" />}
      </button>
    </div>
  );
};

export default SolarConfigCard;
