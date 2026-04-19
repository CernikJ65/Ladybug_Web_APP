/**
 * Formulář — soubory, typ budovy + setpointy + rekuperace.
 *
 * Rekuperace přepíná typ šablony:
 *   0 %   → VRF / WSHP_GSHP (bez DOAS, čistý kompresor)
 *   > 0 % → VRFwithDOAS / WSHPwithDOAS (s ventilací + ERV)
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
    <p className="hp-form-note">
      Ventilace a vnitřní zisky (obsazenost, osvětlení, spotřebiče)
      se přebírají z Ladybug programu dle typu budovy.
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

    {/* ── 3. Setpointy + rekuperace ── */}
    <div className="hp-form-step">
      <span className="hp-step-num">3</span>
      <span className="hp-step-title">Setpointy a rekuperace</span>
    </div>
    <p className="hp-form-note">
      <strong>Rekuperace vyp.</strong>: simulace řeší jen topení
      a chlazení, větrání se neřeší (jen netěsnostmi). Ukazuje
      čistý výkon tepelného čerpadla, jako by se měřilo na
      zkušebně.<br />
      <strong>Rekuperace zap.</strong>: k domu se přidá rozvod
      čerstvého vzduchu s výměníkem, který ze vzduchu odcházejícího
      z budovy zachytí část tepla a ohřeje jím přicházející vzduch
      zvenku. Reálnější pro obývaný dům. 70–80 % je běžná účinnost
      kvalitní jednotky. Celoroční COP mírně klesne (o 0,3–0,5).
    </p>

    <button type="button"
      className={`hp-toggle ${p.heatingOnly ? 'active' : ''}`}
      onClick={() => p.onHeatingOnly(!p.heatingOnly)}>
      <span className="hp-toggle-box">
        {p.heatingOnly && <span className="hp-toggle-check">✓</span>}
      </span>
      <span className="hp-toggle-text">
        Zajímá mě jen vytápění (ignorovat chlazení)
      </span>
    </button>

    <div className="hp-params-grid">
      <Slider label="Setpoint vytápění" min={16} max={25} step={0.5}
        value={p.heatingSp}
        display={`${p.heatingSp} °C`}
        onChange={p.onHeatingSp} />
      {!p.heatingOnly && (
        <Slider label="Setpoint chlazení" min={22} max={30} step={0.5}
          value={p.coolingSp}
          display={`${p.coolingSp} °C`}
          onChange={p.onCoolingSp} />
      )}
      <Slider label="Rekuperace (ERV)" min={0} max={0.95} step={0.05}
        value={p.heatRecovery}
        display={p.heatRecovery === 0
          ? 'Vyp. (bez ventilace)'
          : `${Math.round(p.heatRecovery * 100)} %`}
        onChange={p.onHeatRecovery} />
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
