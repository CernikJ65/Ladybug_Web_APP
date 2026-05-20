/**
 * Formulář PED optimalizátoru — jeden kontejner, 4 číslované sekce.
 * Sjednoceno s heatpump-real layoutem (form-step pattern),
 * file-box ze solar-advanced, vertikální Apple-style stepper pro ceny i rozpočet.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedForm.tsx
 */
import React, { useState, useEffect } from 'react';
import {
  FaFile, FaCloudUploadAlt, FaCheckCircle, FaTimes,
  FaSpinner, FaArrowRight, FaPlay,
} from 'react-icons/fa';
import type { MountingType } from './pedTypes';
import { useT } from '../../../i18n/useT';

interface Props {
  hbjson: File | null; epw: File | null;
  budget: number; heatingSetpoint: number;
  ashpCost: number; gshpCost: number;
  pvCostPerPanel: number; pvEfficiency: number;
  mountingType: MountingType; loading: boolean;
  onHbjson: (f: File | null) => void;
  onEpw: (f: File | null) => void;
  onBudget: (v: number) => void;
  onHeatingSetpoint: (v: number) => void;
  onAshpCost: (v: number) => void;
  onGshpCost: (v: number) => void;
  onPvCostPerPanel: (v: number) => void;
  onPvEfficiency: (v: number) => void;
  onMountingType: (v: MountingType) => void;
  onRun: () => void;
}

function useNumberField(value: number, onChange: (v: number) => void) {
  const [raw, setRaw] = useState<string>(String(value));
  useEffect(() => { setRaw(String(value)); }, [value]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const r = e.target.value;
    setRaw(r);
    if (r !== '') {
      const n = Number(r);
      if (!Number.isNaN(n)) onChange(n);
    }
  };
  const handleBlur = () => {
    if (raw === '' || Number.isNaN(Number(raw))) setRaw(String(value));
  };
  return { raw, handleChange, handleBlur };
}

interface FileBoxProps {
  id: string;
  file: File | null;
  accept: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  onChange: (f: File | null) => void;
}

const FileBox: React.FC<FileBoxProps> = ({
  id, file, accept, label, sub, icon, onChange,
}) => {
  const t = useT();
  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(null);
  };
  return (
    <div className={`ped-file-box ${file ? 'has-file' : ''}`}>
      <label htmlFor={`ped-${id}`}>
        <div className="ped-file-inner">
          <div className="ped-file-icon">{icon}</div>
          <div className="ped-file-text">
            <h4>{label}</h4>
            <p>{sub}</p>
          </div>
        </div>
        <input
          id={`ped-${id}`}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])}
        />
        {file && (
          <div className="ped-file-ok">
            <FaCheckCircle />
            <span className="ped-file-ok-name">{file.name}</span>
            <button
              type="button"
              className="ped-file-clear"
              onClick={handleClear}
              aria-label={t('Odstranit soubor')}
              title={t('Odstranit soubor')}
            >
              <FaTimes />
            </button>
          </div>
        )}
      </label>
    </div>
  );
};

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (v: number) => void;
}

const Slider: React.FC<SliderProps> = ({
  label, value, min, max, step = 1, display, onChange,
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="ped-field">
      <label>{label}</label>
      <div className="ped-slider-wrap">
        <div className="ped-slider-track">
          <div
            className="ped-slider-fill"
            style={{ width: `${pct}%` }}
          />
          <input
            type="range"
            className="ped-slider"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(+e.target.value)}
          />
        </div>
        <span className="ped-slider-val">{display}</span>
      </div>
    </div>
  );
};

/* ── PriceField — Apple-style vertikální stepper ── */

interface PriceFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max?: number;
  step: number;
  unit: string;
}

const PriceField: React.FC<PriceFieldProps> = ({
  label, value, onChange, min, max, step, unit,
}) => {
  const t = useT();
  const { raw, handleChange, handleBlur } = useNumberField(value, onChange);
  const stepUp = () => {
    const next = value + step;
    if (max !== undefined && next > max) return;
    onChange(next);
  };
  const stepDown = () => {
    onChange(Math.max(min, value - step));
  };
  return (
    <div className="ped-field">
      <label>{label}</label>
      <div className="ped-pricefield">
        <input
          className="ped-pricefield-input"
          type="number"
          min={min}
          max={max}
          step={step}
          value={raw}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <span className="ped-pricefield-unit">{unit}</span>
        <div className="ped-pricefield-steps">
          <button
            type="button"
            className="ped-pricefield-step ped-pricefield-step--up"
            onClick={stepUp}
            aria-label={t('Zvýšit o {{step}}', { step })}
            tabIndex={-1}
          />
          <button
            type="button"
            className="ped-pricefield-step ped-pricefield-step--down"
            onClick={stepDown}
            aria-label={t('Snížit o {{step}}', { step })}
            tabIndex={-1}
          />
        </div>
      </div>
    </div>
  );
};

/* ── BudgetField (zvýrazněný řádek + Apple-style stepper) ── */

const BUDGET_STEP = 10_000;
const BUDGET_MIN = 10_000;

const BudgetField: React.FC<{
  value: number; onChange: (v: number) => void;
}> = ({ value, onChange }) => {
  const t = useT();
  const { raw, handleChange, handleBlur } = useNumberField(value, onChange);
  const stepDown = () => onChange(Math.max(BUDGET_MIN, value - BUDGET_STEP));
  const stepUp = () => onChange(value + BUDGET_STEP);
  return (
    <div className="ped-budget">
      <span className="ped-budget-label"></span>
      <div className="ped-budget-row">
        <div className="ped-budget-input-wrap">
          <input
            className="ped-budget-input"
            type="number"
            min={BUDGET_MIN}
            step={BUDGET_STEP}
            value={raw}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <span className="ped-budget-currency">{t('Kč')}</span>
        </div>
        <div className="ped-budget-steps">
          <button
            type="button"
            className="ped-budget-arrow ped-budget-arrow--up"
            onClick={stepUp}
            aria-label={t('Zvýšit o 10 000 Kč')}
            tabIndex={-1}
          />
          <button
            type="button"
            className="ped-budget-arrow ped-budget-arrow--down"
            onClick={stepDown}
            aria-label={t('Snížit o 10 000 Kč')}
            tabIndex={-1}
          />
        </div>
      </div>
    </div>
  );
};

/* ── PedForm ── */

const PedForm: React.FC<Props> = (p) => {
  const t = useT();
  return (
  <div className="ped-form">

    {/* ── 1. Vstupní soubory ── */}
    <div className="ped-form-step">
      <span className="ped-step-num">1</span>
      <span className="ped-step-title">{t('Vstupní soubory')}</span>
    </div>
    <div className="ped-files">
      <FileBox
        id="hbjson"
        file={p.hbjson}
        accept=".hbjson,.json"
        label={t('HBJSON model')}
        sub={t('Geometrie budovy (.hbjson)')}
        icon={<FaFile />}
        onChange={p.onHbjson}
      />
      <FileBox
        id="epw"
        file={p.epw}
        accept=".epw"
        label={t('EPW soubor')}
        sub={t('Klimatická data (.epw)')}
        icon={<FaCloudUploadAlt />}
        onChange={p.onEpw}
      />
    </div>

    {/* ── 2. Investiční rozpočet ── */}
    <div className="ped-form-step">
      <span className="ped-step-num">2</span>
      <span className="ped-step-title">{t('Investiční rozpočet')}</span>
    </div>
    <p className="ped-form-note">
      {t('Maximální částka, kterou je možné na osazení oblasti vynaložit.')}
    </p>
    <BudgetField value={p.budget} onChange={p.onBudget} />

    {/* ── 3. Parametry simulace ── */}
    <div className="ped-form-step">
      <span className="ped-step-num">3</span>
      <span className="ped-step-title">{t('Parametry simulace')}</span>
    </div>
    <p className="ped-form-note">
      {t('Setpoint vytápění, účinnost panelů a typ montáže.')}
    </p>
    <div className="ped-params-grid">
      <Slider
        label={t('Teplota vytápění')}
        value={p.heatingSetpoint}
        onChange={p.onHeatingSetpoint}
        min={16} max={26} step={1}
        display={`${p.heatingSetpoint} °C`}
      />
      <Slider
        label={t('Účinnost FVE')}
        value={p.pvEfficiency}
        onChange={p.onPvEfficiency}
        min={19} max={24} step={1}
        display={`${p.pvEfficiency} %`}
      />
      <div className="ped-field">
        <label>{t('Typ montáže')}</label>
        <select
          className="ped-select"
          value={p.mountingType}
          onChange={(e) =>
            p.onMountingType(e.target.value as MountingType)
          }
        >
          <option value="FixedOpenRack">{t('Otevřená konstrukce')}</option>
          <option value="FixedRoofMounted">{t('Přilehlá ke střeše')}</option>
        </select>
      </div>
    </div>

    {/* ── 4. Ceny komponent ── */}
    <div className="ped-form-step">
      <span className="ped-step-num">4</span>
      <span className="ped-step-title">{t('Ceny komponent')}</span>
    </div>
    <p className="ped-form-note">
      {t('Investiční náklady jednotlivých prvků v Kč.')}
    </p>
    <div className="ped-params-grid" data-tour="ped-costs">
      <PriceField
        label={t('Čerpadlo ASHP vzduch/voda')}
        value={p.ashpCost}
        onChange={p.onAshpCost}
        min={50000} step={10000}
        unit={t('Kč')}
      />
      <PriceField
        label={t('Čerpadlo GSHP země/voda')}
        value={p.gshpCost}
        onChange={p.onGshpCost}
        min={50000} step={10000}
        unit={t('Kč')}
      />
      <PriceField
        label={t('Cena za panel')}
        value={p.pvCostPerPanel}
        onChange={p.onPvCostPerPanel}
        min={5000} step={1000}
        unit={t('Kč')}
      />
    </div>

    <button
      className="ped-run"
      onClick={p.onRun}
      disabled={p.loading || !p.hbjson || !p.epw}
    >
      <span className="ped-run-mark">
        {p.loading ? <FaSpinner className="ped-spinner" /> : <FaPlay />}
      </span>
      <span>
        {p.loading ? t('Probíhá simulace…') : t('Spustit PED analýzu')}
      </span>
      {!p.loading && <FaArrowRight className="ped-run-arrow" />}
    </button>
  </div>
  );
};

export default PedForm;