/**
 * Formulář PED optimalizátoru — tři karty bez popisných vět.
 *
 * Number inputy řeší dva problémy:
 *  - umožňují kompletní vymazání (raw string state, parent dostane
 *    jen platná čísla; po blur se prázdný input doplní z parentu)
 *  - zachovávají nativní šipky spinnerů (CSS je už neskrývá)
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedForm.tsx
 */
import React, { useState, useEffect } from 'react';
import {
  FaCube, FaCloudSun, FaCheckCircle, FaSpinner, FaTimes,
} from 'react-icons/fa';
import type { MountingType } from './pedTypes';

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

interface UploadProps {
  file: File | null; accept: string;
  label: string; icon: React.ReactNode;
  onChange: (f: File | null) => void;
}

const Upload: React.FC<UploadProps> = ({
  file, accept, label, icon, onChange,
}) => {
  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(null);
  };
  return (
    <label className={`ped-upload ${file ? 'ready' : ''}`}>
      <input type="file" accept={accept} hidden
        onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      <span className="ped-upload-icon">
        {file ? <FaCheckCircle /> : icon}
      </span>
      <span className="ped-upload-text">
        <span className="ped-upload-label">{label}</span>
        {file
          ? <span className="ped-upload-name">{file.name}</span>
          : <span className="ped-upload-placeholder">Vybrat soubor</span>}
      </span>
      {file && (
        <button type="button" className="ped-upload-clear"
          onClick={handleClear} aria-label="Odebrat soubor">
          <FaTimes />
        </button>
      )}
    </label>
  );
};

interface NumFieldProps {
  label: string; value: number;
  onChange: (v: number) => void;
  min: number; max?: number; step?: number;
}

const NumField: React.FC<NumFieldProps> = ({
  label, value, onChange, min, max, step,
}) => {
  const { raw, handleChange, handleBlur } = useNumberField(value, onChange);
  return (
    <div className="ped-field">
      <span className="ped-field-label">{label}</span>
      <input className="ped-input" type="number"
        min={min} max={max} step={step}
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur} />
    </div>
  );
};

const BudgetField: React.FC<{
  value: number; onChange: (v: number) => void;
}> = ({ value, onChange }) => {
  const { raw, handleChange, handleBlur } = useNumberField(value, onChange);
  return (
    <div className="ped-budget">
      <span className="ped-budget-label">Investiční rozpočet</span>
      <div className="ped-budget-input-wrap">
        <input className="ped-budget-input" type="number"
          min={10000} step={10000} value={raw}
          onChange={handleChange}
          onBlur={handleBlur} />
        <span className="ped-budget-currency">Kč</span>
      </div>
    </div>
  );
};

const PedForm: React.FC<Props> = (p) => (
  <div className="ped-form-wrap">
    <div className="ped-card">
      <h2 className="ped-card-title">Vstupní data</h2>
      <div className="ped-upload-grid">
        <Upload file={p.hbjson} accept=".hbjson,.json"
          label="HBJSON model" icon={<FaCube />}
          onChange={p.onHbjson} />
        <Upload file={p.epw} accept=".epw"
          label="EPW počasí" icon={<FaCloudSun />}
          onChange={p.onEpw} />
      </div>
    </div>

    <div className="ped-card">
      <h2 className="ped-card-title">Parametry simulace</h2>
      <BudgetField value={p.budget} onChange={p.onBudget} />
      <div className="ped-field-grid">
        <NumField label="Teplota vytápění (°C)" value={p.heatingSetpoint}
          onChange={p.onHeatingSetpoint} min={16} max={25} step={0.5} />
        <NumField label="Účinnost FVE (%)" value={p.pvEfficiency}
          onChange={p.onPvEfficiency} min={5} max={30} step={1} />
        <div className="ped-field">
          <span className="ped-field-label">Montáž panelů</span>
          <select className="ped-select" value={p.mountingType}
            onChange={(e) =>
              p.onMountingType(e.target.value as MountingType)}>
            <option value="FixedOpenRack">Otevřená konstrukce</option>
            <option value="FixedRoofMounted">Přilehlá ke střeše</option>
          </select>
        </div>
      </div>
    </div>

    <div className="ped-card">
      <h2 className="ped-card-title">Ceny komponent</h2>
      <div className="ped-field-grid">
        <NumField label="ASHP — vzduch/voda (Kč)"
          value={p.ashpCost}
          onChange={p.onAshpCost} min={50000} step={10000} />
        <NumField label="GSHP — země/voda (Kč)"
          value={p.gshpCost}
          onChange={p.onGshpCost} min={50000} step={10000} />
        <NumField label="Cena za panel (Kč)"
          value={p.pvCostPerPanel}
          onChange={p.onPvCostPerPanel} min={5000} step={1000} />
      </div>
    </div>

    <button className="ped-run" onClick={p.onRun}
      disabled={p.loading || !p.hbjson || !p.epw}>
      {p.loading
        ? <><FaSpinner className="ped-spinner" /> Probíhá simulace…</>
        : 'Spustit PED analýzu'}
    </button>
  </div>
);

export default PedForm;