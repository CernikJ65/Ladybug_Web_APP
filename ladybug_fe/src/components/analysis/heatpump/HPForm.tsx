/**
 * Formulář parametrů — vizuální karty místo dropdownů.
 *
 * Typ budovy a teplota topné vody se vybírají kliknutím
 * na kartu s ikonou. Rekuperace jako Apple-style slider.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump/HPForm.tsx
 */
import React from 'react';
import {
  FaFile, FaCloudUploadAlt, FaHome, FaBuilding,
  FaStore, FaGraduationCap, FaHotel, FaHospital,
} from 'react-icons/fa';

interface Props {
  hbjson: File | null;
  epw: File | null;
  supplyTemp: number;
  depth: number;
  buildingType: string;
  heatingSetpoint: number;
  electricityPrice: number;
  gridCo2: number;
  heatRecovery: number;
  loading: boolean;
  onHbjson: (f: File | null) => void;
  onEpw: (f: File | null) => void;
  onSupplyTemp: (v: number) => void;
  onDepth: (v: number) => void;
  onBuildingType: (v: string) => void;
  onHeatingSetpoint: (v: number) => void;
  onElectricityPrice: (v: number) => void;
  onGridCo2: (v: number) => void;
  onHeatRecovery: (v: number) => void;
  onRun: () => void;
}

const BUILDINGS = [
  { value: 'Residential', label: 'Rezidenční',
    icon: <FaHome />, desc: 'Rodinné domy, byty' },
  { value: 'Office', label: 'Kancelářská',
    icon: <FaBuilding />, desc: 'Kanceláře, coworkingy' },
  { value: 'Retail', label: 'Obchodní',
    icon: <FaStore />, desc: 'Obchody, nákupní centra' },
  { value: 'School', label: 'Školní',
    icon: <FaGraduationCap />, desc: 'Školy, univerzity' },
  { value: 'Hotel', label: 'Hotelová',
    icon: <FaHotel />, desc: 'Hotely, penziony' },
  { value: 'Hospital', label: 'Nemocniční',
    icon: <FaHospital />, desc: 'Nemocnice, kliniky' },
];

const SUPPLY_TEMPS = [
  { value: 35, label: '35 °C', desc: 'Podlahové vytápění' },
  { value: 45, label: '45 °C', desc: 'Fancoily' },
  { value: 55, label: '55 °C', desc: 'Radiátory' },
];

const SETPOINTS = [18, 19, 20, 21, 22];

const HPForm: React.FC<Props> = (p) => (
  <div className="hp-form">
    {/* ── Nahrání souborů ── */}
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
          {p.hbjson ? 'Změnit soubor' : '.hbjson nebo .json'}
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
          {p.epw ? 'Změnit soubor' : 'Soubor .epw'}
        </span>
        <input type="file" accept=".epw"
          onChange={e => p.onEpw(e.target.files?.[0] || null)} />
      </label>
    </div>

    {/* ── Typ budovy ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">2</span>
      <span className="hp-step-title">Typ budovy</span>
    </div>
    <div className="hp-type-grid">
      {BUILDINGS.map(b => (
        <button key={b.value}
          className={`hp-type-card ${
            p.buildingType === b.value ? 'active' : ''
          }`}
          onClick={() => p.onBuildingType(b.value)}>
          <span className="hp-type-icon">{b.icon}</span>
          <span className="hp-type-label">{b.label}</span>
          <span className="hp-type-desc">{b.desc}</span>
        </button>
      ))}
    </div>

    {/* ── Topný systém ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">3</span>
      <span className="hp-step-title">Topný systém a parametry</span>
    </div>
    <div className="hp-supply-row">
      {SUPPLY_TEMPS.map(t => (
        <button key={t.value}
          className={`hp-supply-card ${
            p.supplyTemp === t.value ? 'active' : ''
          }`}
          onClick={() => p.onSupplyTemp(t.value)}>
          <span className="hp-supply-val">{t.label}</span>
          <span className="hp-supply-desc">{t.desc}</span>
        </button>
      ))}
    </div>

    <div className="hp-params-grid">
      <div className="hp-field">
        <label>Setpoint vytápění</label>
        <div className="hp-chip-row">
          {SETPOINTS.map(s => (
            <button key={s}
              className={`hp-chip ${
                p.heatingSetpoint === s ? 'active' : ''
              }`}
              onClick={() => p.onHeatingSetpoint(s)}>
              {s} °C
            </button>
          ))}
        </div>
      </div>
      <div className="hp-field hp-field--full">
        <label>Rekuperace (ZZT)</label>
        <div className="hp-slider-wrap">
          <div className="hp-slider-track">
            <div className="hp-slider-fill"
              style={{ width: `${(p.heatRecovery / 0.95) * 100}%` }} />
            <input
              type="range"
              className="hp-slider"
              min={0} max={0.95} step={0.05}
              value={p.heatRecovery}
              onChange={e => p.onHeatRecovery(+e.target.value)}
            />
          </div>
          <span className="hp-slider-val">
            {p.heatRecovery === 0
              ? 'Vypnuto'
              : `${Math.round(p.heatRecovery * 100)} %`}
          </span>
        </div>
      </div>
      <div className="hp-field">
        <label>Hloubka kolektoru GSHP</label>
        <div className="hp-input-wrap">
          <input type="number" min={0.5} max={4} step={0.5}
            value={p.depth}
            onChange={e => p.onDepth(+e.target.value)} />
          <span className="hp-input-unit">m</span>
        </div>
      </div>
      <div className="hp-field">
        <label>Cena elektřiny</label>
        <div className="hp-input-wrap">
          <input type="number" min={1} max={20} step={0.5}
            value={p.electricityPrice}
            onChange={e => p.onElectricityPrice(+e.target.value)} />
          <span className="hp-input-unit">CZK/kWh</span>
        </div>
      </div>
      <div className="hp-field">
        <label>CO₂ intenzita sítě</label>
        <div className="hp-input-wrap">
          <input type="number" min={0} max={1000} step={10}
            value={p.gridCo2}
            onChange={e => p.onGridCo2(+e.target.value)} />
          <span className="hp-input-unit">kg/MWh</span>
        </div>
      </div>
    </div>

    {/* ── Spuštění ── */}
    <button className="hp-run" onClick={p.onRun}
      disabled={p.loading || !p.hbjson || !p.epw}>
      {p.loading ? (
        <><span className="hp-spin">⟳</span> Simuluji v EnergyPlus…</>
      ) : (
        'Spustit analýzu'
      )}
    </button>
  </div>
);

export default HPForm;