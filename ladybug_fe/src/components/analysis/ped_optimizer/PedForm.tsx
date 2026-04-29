/**
 * Formular pro PED optimalizator — soubory + rozpocet + ceny + setpoint.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedForm.tsx
 */
import React from 'react';
import { FaCloudUploadAlt, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import type { MountingType } from './pedTypes';

interface Props {
  hbjson: File | null;
  epw: File | null;
  budget: number;
  heatingSetpoint: number;
  ashpCost: number;
  gshpCost: number;
  pvCostPerPanel: number;
  pvEfficiency: number;
  mountingType: MountingType;
  loading: boolean;
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

interface UploadProps {
  file: File | null;
  accept: string;
  placeholder: string;
  onChange: (f: File | null) => void;
}

const Upload: React.FC<UploadProps> = ({ file, accept, placeholder, onChange }) => (
  <label className={`ped-upload-zone ${file ? 'ready' : ''}`}>
    <input
      type="file" accept={accept} hidden
      onChange={(e) => onChange(e.target.files?.[0] ?? null)}
    />
    {file
      ? <FaCheckCircle style={{ color: '#10b981', fontSize: '1.1rem' }} />
      : <FaCloudUploadAlt style={{ color: '#94a3b8', fontSize: '1.1rem' }} />}
    <p>
      {file ? <span className="ped-file-name">{file.name}</span> : placeholder}
    </p>
  </label>
);

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max?: number;
  step?: number;
}

const NumField: React.FC<NumFieldProps> = ({
  label, value, onChange, min, max, step,
}) => (
  <div className="ped-field">
    <span className="ped-label">{label}</span>
    <input
      className="ped-input" type="number"
      min={min} max={max} step={step}
      value={value}
      onChange={(e) => onChange(+e.target.value)}
    />
  </div>
);

const PedForm: React.FC<Props> = (p) => (
  <div className="ped-card">
    <div className="ped-upload-row">
      <Upload
        file={p.hbjson} accept=".hbjson,.json"
        placeholder="HBJSON model" onChange={p.onHbjson}
      />
      <Upload
        file={p.epw} accept=".epw"
        placeholder="EPW počasí" onChange={p.onEpw}
      />
    </div>

    <div className="ped-budget-field">
      <div className="ped-budget-label">Celkový rozpočet (Kč)</div>
      <input
        className="ped-budget-input" type="number"
        min={10000} step={10000} value={p.budget}
        onChange={(e) => p.onBudget(+e.target.value)}
      />
    </div>

    <div className="ped-form-grid">
      <NumField label="Teplota vytápění (°C)" value={p.heatingSetpoint}
        onChange={p.onHeatingSetpoint} min={16} max={25} step={0.5} />
      <NumField label="Účinnost FVE (%)" value={p.pvEfficiency}
        onChange={p.onPvEfficiency} min={5} max={30} step={1} />
      <div className="ped-field">
        <span className="ped-label">Typ montáže panelů</span>
        <select
          className="ped-select" value={p.mountingType}
          onChange={(e) => p.onMountingType(e.target.value as MountingType)}
        >
          <option value="FixedOpenRack">
            Otevřená konstrukce (plochá střecha)
          </option>
          <option value="FixedRoofMounted">
            Přilehlá ke střeše (šikmá střecha)
          </option>
        </select>
      </div>
      <NumField label="Cena ASHP (Kč)" value={p.ashpCost}
        onChange={p.onAshpCost} min={50000} step={10000} />
      <NumField label="Cena GSHP (Kč)" value={p.gshpCost}
        onChange={p.onGshpCost} min={50000} step={10000} />
      <NumField label="Cena za panel (Kč)" value={p.pvCostPerPanel}
        onChange={p.onPvCostPerPanel} min={5000} step={1000} />
    </div>

    <button
      className="ped-run" onClick={p.onRun}
      disabled={p.loading || !p.hbjson || !p.epw}
    >
      {p.loading
        ? <><FaSpinner className="ped-spinner" /> Simulace…</>
        : 'Spustit PED analýzu'}
    </button>
  </div>
);

export default PedForm;
