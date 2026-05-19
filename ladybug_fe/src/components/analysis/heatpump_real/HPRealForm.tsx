/**
 * Formulář — soubory, typ budovy + setpointy + rekuperace.
 *
 * Režim simulace se volí macOS segmented controlem:
 *   Vytápění a chlazení  →  default (cooling setpoint platí)
 *   Pouze vytápění       →  heatingOnly=true (cooling vypnut)
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealForm.tsx
 */
import React from 'react';
import {
  FaFile, FaCloudUploadAlt, FaHome, FaBuilding,
  FaStore, FaGraduationCap, FaHotel, FaHospital,
  FaTimes,
} from 'react-icons/fa';
import { useT } from '../../../i18n/useT';

interface Props {
  hbjson: File | null; epw: File | null;
  buildingType: string;
  heatingSp: number; coolingSp: number;
  heatRecovery: number;
  heatingOnly: boolean;
  loading: boolean;
  onHbjson: (f: File | null) => void;
  onEpw: (f: File | null) => void;
  onBuildingType: (v: string) => void;
  onHeatingSp: (v: number) => void;
  onCoolingSp: (v: number) => void;
  onHeatRecovery: (v: number) => void;
  onHeatingOnly: (v: boolean) => void;
  onRun: () => void;
}

const HPRealForm: React.FC<Props> = (p) => {
  const t = useT();
  const BUILDS = [
    { v: 'Residential', l: t('Rezidenční'), i: <FaHome />, d: t('Byty, domy') },
    { v: 'Office', l: t('Kancelářská'), i: <FaBuilding />, d: t('Kanceláře') },
    { v: 'Retail', l: t('Obchodní'), i: <FaStore />, d: t('Obchody') },
    { v: 'School', l: t('Školní'), i: <FaGraduationCap />, d: t('Školy') },
    { v: 'Hotel', l: t('Hotelová'), i: <FaHotel />, d: t('Hotely') },
    { v: 'Hospital', l: t('Nemocniční'), i: <FaHospital />, d: t('Nemocnice') },
  ];
  return (
  <div className="hp-form">
    {/* ── 1. Soubory ── */}
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
          {p.hbjson ? t('Změnit') : '.hbjson / .json'}
        </span>
        <input type="file" accept=".hbjson,.json"
          onChange={e => p.onHbjson(e.target.files?.[0] || null)} />
        {p.hbjson && (
          <button type="button" className="hp-dropzone-clear"
            aria-label={t('Odebrat soubor')}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              p.onHbjson(null);
            }}>
            <FaTimes />
          </button>
        )}
      </label>
      <label className={`hp-dropzone ${p.epw ? 'has-file' : ''}`}>
        <FaCloudUploadAlt className="hp-dropzone-icon" />
        <span className="hp-dropzone-text">
          {p.epw ? p.epw.name : t('EPW klimatická data')}
        </span>
        <span className="hp-dropzone-hint">
          {p.epw ? t('Změnit') : '.epw'}
        </span>
        <input type="file" accept=".epw"
          onChange={e => p.onEpw(e.target.files?.[0] || null)} />
        {p.epw && (
          <button type="button" className="hp-dropzone-clear"
            aria-label={t('Odebrat soubor')}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              p.onEpw(null);
            }}>
            <FaTimes />
          </button>
        )}
      </label>
    </div>

    {/* ── 2. Typ budovy ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">2</span>
      <span className="hp-step-title">{t('Typ budovy')}</span>
    </div>
    <p className="hp-form-note">
      {t('Vybere jedne z přednsatavenych Ladybug šablon pro simulaci tepelné potřeby budovy.')}
    </p>
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

    {/* ── 3. Režim simulace ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">3</span>
      <span className="hp-step-title">{t('Režim simulace')}</span>
    </div>
    <div className="hp-mode-seg" role="tablist">
      <button type="button"
        className={`hp-mode-btn ${!p.heatingOnly ? 'active' : ''}`}
        onClick={() => p.onHeatingOnly(false)}>
        {t('Vytápění a chlazení')}
      </button>
      <button type="button"
        className={`hp-mode-btn ${p.heatingOnly ? 'active' : ''}`}
        onClick={() => p.onHeatingOnly(true)}>
        {t('Pouze vytápění')}
      </button>
    </div>

    {/* ── 4. Setpointy + rekuperace ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">4</span>
      <span className="hp-step-title">{t('Setpointy a rekuperace')}</span>
    </div>

    <div className="hp-params-grid">
      <Slider label={t('Setpoint vytápění')} min={16} max={25} step={1}
        value={p.heatingSp}
        display={`${p.heatingSp} °C`}
        onChange={p.onHeatingSp} />
      {!p.heatingOnly && (
        <Slider label={t('Setpoint chlazení')} min={22} max={30} step={1}
          value={p.coolingSp}
          display={`${p.coolingSp} °C`}
          onChange={p.onCoolingSp} />
      )}
      <Slider label={t('Rekuperace (ERV)')} min={0} max={0.95} step={0.05}
        value={p.heatRecovery}
        display={p.heatRecovery === 0
          ? t('Vyp. (bez ventilace)')
          : `${Math.round(p.heatRecovery * 100)} %`}
        onChange={p.onHeatRecovery} />
    </div>

    <button className="hp-run" onClick={p.onRun}
      disabled={p.loading || !p.hbjson || !p.epw}>
      {p.loading ? (
        <><span className="hp-spin">⟳</span> {t('Simuluji 2× EnergyPlus…')}</>
      ) : (
        t('Spustit celoroční simulaci')
      )}
    </button>
  </div>
  );
};

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