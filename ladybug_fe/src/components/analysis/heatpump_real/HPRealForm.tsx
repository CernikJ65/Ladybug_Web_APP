/**
 * Formulář — setpointy jako Apple-style slidery.
 *
 * Bez supply_temp_c — reálný HVAC nepotřebuje teplotu
 * topné vody, EnergyPlus ji řeší interně dle vintage.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealForm.tsx
 */
import React from 'react';
import {
  FaFile, FaCloudUploadAlt, FaHome, FaBuilding,
  FaStore, FaGraduationCap, FaHotel, FaHospital,
} from 'react-icons/fa';

interface Props {
  hbjson: File | null; epw: File | null;
  buildingType: string;
  heatingSp: number; coolingSp: number;
  heatRecovery: number;
  price: number; co2: number; loading: boolean;
  onHbjson: (f: File | null) => void;
  onEpw: (f: File | null) => void;
  onBuildingType: (v: string) => void;
  onHeatingSp: (v: number) => void;
  onCoolingSp: (v: number) => void;
  onHeatRecovery: (v: number) => void;
  onPrice: (v: number) => void;
  onCo2: (v: number) => void;
  onRun: () => void;
}

const BUILDS = [
  { v: 'Residential', l: 'Rezidenční', i: <FaHome />, d: 'Byty, domy' },
  { v: 'Office', l: 'Kancelářská', i: <FaBuilding />, d: 'Kanceláře' },
  { v: 'Retail', l: 'Obchodní', i: <FaStore />, d: 'Obchody' },
  { v: 'School', l: 'Školní', i: <FaGraduationCap />, d: 'Školy' },
  { v: 'Hotel', l: 'Hotelová', i: <FaHotel />, d: 'Hotely' },
  { v: 'Hospital', l: 'Nemocniční', i: <FaHospital />, d: 'Nemocnice' },
];

const HPRealForm: React.FC<Props> = (p) => (
  <div className="hp-form">
    {/* ── 1. Soubory ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">1</span>
      <span className="hp-step-title">Vstupní soubory</span>
    </div>
    <div className="hp-files">
      <label className={`hp-dropzone ${p.hbjson ? 'has-file' : ''}`}>
        <FaFile className="hp-dropzone-icon" />
        <span className="hp-dropzone-text">
          {p.hbjson ? p.hbjson.name : 'HBJSON model budovy'}
        </span>
        <span className="hp-dropzone-hint">
          {p.hbjson ? 'Změnit' : '.hbjson / .json'}
        </span>
        <input type="file" accept=".hbjson,.json"
          onChange={e => p.onHbjson(e.target.files?.[0] || null)} />
      </label>
      <label className={`hp-dropzone ${p.epw ? 'has-file' : ''}`}>
        <FaCloudUploadAlt className="hp-dropzone-icon" />
        <span className="hp-dropzone-text">
          {p.epw ? p.epw.name : 'EPW klimatická data'}
        </span>
        <span className="hp-dropzone-hint">
          {p.epw ? 'Změnit' : '.epw'}
        </span>
        <input type="file" accept=".epw"
          onChange={e => p.onEpw(e.target.files?.[0] || null)} />
      </label>
    </div>

    {/* ── 2. Typ budovy ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">2</span>
      <span className="hp-step-title">Typ budovy</span>
    </div>
    <div className="hp-type-grid">
      {BUILDS.map(b => (
        <button key={b.v}
          className={`hp-type-card ${p.buildingType === b.v ? 'active' : ''}`}
          onClick={() => p.onBuildingType(b.v)}>
          <span className="hp-type-icon">{b.i}</span>
          <span className="hp-type-label">{b.l}</span>
          <span className="hp-type-desc">{b.d}</span>
        </button>
      ))}
    </div>

    {/* ── 3. Setpointy + parametry ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">3</span>
      <span className="hp-step-title">Teplotní a ekonomické parametry</span>
    </div>

    <div className="hp-params-grid">
      <Slider label="Setpoint vytápění" min={16} max={25} step={0.5}
        value={p.heatingSp}
        display={`${p.heatingSp} °C`}
        onChange={p.onHeatingSp} />
      <Slider label="Setpoint chlazení" min={22} max={30} step={0.5}
        value={p.coolingSp}
        display={`${p.coolingSp} °C`}
        onChange={p.onCoolingSp} />
      <Slider label="Rekuperace (ZZT)" min={0} max={0.95} step={0.05}
        value={p.heatRecovery}
        display={p.heatRecovery === 0
          ? 'Vyp.'
          : `${Math.round(p.heatRecovery * 100)} %`}
        onChange={p.onHeatRecovery} />

      <div className="hp-field">
        <label>Cena elektřiny</label>
        <div className="hp-input-wrap">
          <input type="number" min={1} max={20} step={0.5}
            value={p.price}
            onChange={e => p.onPrice(+e.target.value)} />
          <span className="hp-input-unit">CZK/kWh</span>
        </div>
      </div>
      <div className="hp-field">
        <label>CO₂ intenzita sítě</label>
        <div className="hp-input-wrap">
          <input type="number" min={0} max={1000} step={10}
            value={p.co2}
            onChange={e => p.onCo2(+e.target.value)} />
          <span className="hp-input-unit">kg/MWh</span>
        </div>
      </div>
    </div>

    <button className="hp-run" onClick={p.onRun}
      disabled={p.loading || !p.hbjson || !p.epw}>
      {p.loading ? (
        <><span className="hp-spin">⟳</span> Simuluji 2× EnergyPlus…</>
      ) : (
        'Spustit celoroční simulaci'
      )}
    </button>
  </div>
);

/* ── Slider komponenta ── */

const Slider: React.FC<{
  label: string; min: number; max: number; step: number;
  value: number; display: string; onChange: (v: number) => void;
}> = ({ label, min, max, step, value, display, onChange }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="hp-field hp-field--full">
      <label>{label}</label>
      <div className="hp-slider-wrap">
        <div className="hp-slider-track">
          <div className="hp-slider-fill" style={{ width: `${pct}%` }} />
          <input type="range" className="hp-slider"
            min={min} max={max} step={step} value={value}
            onChange={e => onChange(+e.target.value)} />
        </div>
        <span className="hp-slider-val">{display}</span>
      </div>
    </div>
  );
};

export default HPRealForm;