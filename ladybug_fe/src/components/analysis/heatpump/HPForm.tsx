/**
 * Formulář parametrů — vizuální karty místo dropdownů.
 *
 * Typ budovy a teplota topné vody se vybírají kliknutím
 * na kartu s ikonou. Setpoint a rekuperace jako slider.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump/HPForm.tsx
 */
import React from 'react';
import {
  FaFile, FaCloudUploadAlt, FaHome, FaBuilding,
  FaStore, FaGraduationCap, FaHotel, FaHospital,
} from 'react-icons/fa';
import { useT } from '../../../i18n/useT';

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

const SP_MIN = 16;
const SP_MAX = 25;

const HPForm: React.FC<Props> = (p) => {
  const t = useT();
  const BUILDINGS = [
    { value: 'Residential', label: t('Rezidenční'),
      icon: <FaHome />, desc: t('Rodinné domy, byty') },
    { value: 'Office', label: t('Kancelářská'),
      icon: <FaBuilding />, desc: t('Kanceláře, coworkingy') },
    { value: 'Retail', label: t('Obchodní'),
      icon: <FaStore />, desc: t('Obchody, nákupní centra') },
    { value: 'School', label: t('Školní'),
      icon: <FaGraduationCap />, desc: t('Školy, univerzity') },
    { value: 'Hotel', label: t('Hotelová'),
      icon: <FaHotel />, desc: t('Hotely, penziony') },
    { value: 'Hospital', label: t('Nemocniční'),
      icon: <FaHospital />, desc: t('Nemocnice, kliniky') },
  ];

  const SUPPLY_TEMPS = [
    { value: 35, label: '35 °C', desc: t('Podlahové vytápění') },
    { value: 45, label: '45 °C', desc: t('Fancoily') },
    { value: 55, label: '55 °C', desc: t('Radiátory') },
  ];

  return (
  <div className="hp-form">
    {/* ── Nahrání souborů ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">1</span>
      <span className="hp-step-title">{t('Vstupní soubory')}</span>
    </div>
    <div className="hp-files">
      <label className={`hp-dropzone ${p.hbjson ? 'has-file' : ''}`}>
        <FaFile className="hp-dropzone-icon" />
        <span className="hp-dropzone-text">
          {p.hbjson ? p.hbjson.name : t('HBJSON model budovy')}
        </span>
        <span className="hp-dropzone-hint">
          {p.hbjson ? t('Změnit soubor') : '.hbjson nebo .json'}
        </span>
        <input type="file" accept=".hbjson,.json"
          onChange={e => p.onHbjson(e.target.files?.[0] || null)} />
      </label>
      <label className={`hp-dropzone ${p.epw ? 'has-file' : ''}`}>
        <FaCloudUploadAlt className="hp-dropzone-icon" />
        <span className="hp-dropzone-text">
          {p.epw ? p.epw.name : t('EPW klimatická data')}
        </span>
        <span className="hp-dropzone-hint">
          {p.epw ? t('Změnit soubor') : t('Soubor .epw')}
        </span>
        <input type="file" accept=".epw"
          onChange={e => p.onEpw(e.target.files?.[0] || null)} />
      </label>
    </div>

    {/* ── Typ budovy ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">2</span>
      <span className="hp-step-title">{t('Typ budovy')}</span>
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
      <span className="hp-step-title">{t('Topný systém a parametry')}</span>
    </div>
    <div className="hp-supply-row">
      {SUPPLY_TEMPS.map(s => (
        <button key={s.value}
          className={`hp-supply-card ${
            p.supplyTemp === s.value ? 'active' : ''
          }`}
          onClick={() => p.onSupplyTemp(s.value)}>
          <span className="hp-supply-val">{s.label}</span>
          <span className="hp-supply-desc">{s.desc}</span>
        </button>
      ))}
    </div>

    <div className="hp-params-grid">
      {/* ── Setpoint — slider ── */}
      <div className="hp-field hp-field--full">
        <label>{t('Setpoint vytápění')}</label>
        <div className="hp-slider-wrap">
          <div className="hp-slider-track">
            <div className="hp-slider-fill"
              style={{
                width: `${((p.heatingSetpoint - SP_MIN)
                  / (SP_MAX - SP_MIN)) * 100}%`,
              }} />
            <input
              type="range"
              className="hp-slider"
              min={SP_MIN} max={SP_MAX} step={1}
              value={p.heatingSetpoint}
              onChange={e => p.onHeatingSetpoint(+e.target.value)}
            />
          </div>
          <span className="hp-slider-val">
            {p.heatingSetpoint} °C
          </span>
        </div>
      </div>

      {/* ── Rekuperace — slider ── */}
      <div className="hp-field hp-field--full">
        <label>{t('Rekuperace (ZZT)')}</label>
        <div className="hp-slider-wrap">
          <div className="hp-slider-track">
            <div className="hp-slider-fill"
              style={{
                width: `${(p.heatRecovery / 0.95) * 100}%`,
              }} />
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
              ? t('Vypnuto')
              : `${Math.round(p.heatRecovery * 100)} %`}
          </span>
        </div>
      </div>

      <div className="hp-field">
        <label>{t('Hloubka kolektoru GSHP')}</label>
        <div className="hp-input-wrap">
          <input type="number" min={0.5} max={4} step={0.5}
            value={p.depth}
            onChange={e => p.onDepth(+e.target.value)} />
          <span className="hp-input-unit">m</span>
        </div>
      </div>
      <div className="hp-field">
        <label>{t('Cena elektřiny')}</label>
        <div className="hp-input-wrap">
          <input type="number" min={1} max={20} step={0.5}
            value={p.electricityPrice}
            onChange={e => p.onElectricityPrice(+e.target.value)} />
          <span className="hp-input-unit">CZK/kWh</span>
        </div>
      </div>
      <div className="hp-field">
        <label>{t('CO₂ intenzita sítě')}</label>
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
        <><span className="hp-spin">⟳</span> {t('Simuluji v EnergyPlus…')}</>
      ) : (
        t('Spustit analýzu')
      )}
    </button>
  </div>
  );
};

export default HPForm;