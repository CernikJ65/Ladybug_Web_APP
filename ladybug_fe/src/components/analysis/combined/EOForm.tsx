/**
 * Formulář — rozpočet + ceny ASHP/GSHP/FVE.
 * Soubor: ladybug_fe/src/components/analysis/combined/EOForm.tsx
 */
import React from 'react';
import { FaCloudUploadAlt, FaCheckCircle, FaSpinner } from 'react-icons/fa';

interface Props {
  hbjson: File | null; epw: File | null;
  budget: number; pvEfficiency: number; buildingType: string;
  supplyTemp: number; heatingSetpoint: number;
  ashpCost: number; gshpCost: number; pvCostPerPanel: number;
  loading: boolean;
  onHbjson: (f: File | null) => void; onEpw: (f: File | null) => void;
  onBudget: (v: number) => void; onPvEfficiency: (v: number) => void;
  onBuildingType: (v: string) => void; onSupplyTemp: (v: number) => void;
  onHeatingSetpoint: (v: number) => void;
  onAshpCost: (v: number) => void; onGshpCost: (v: number) => void;
  onPvCostPerPanel: (v: number) => void;
  onRun: () => void;
}

const TYPES = ['Residential','Office','Retail','School','Hotel','Hospital'];

const EOForm: React.FC<Props> = (p) => (
  <div className="eo-card">
    <div className="eo-upload-row">
      <label className={`eo-upload-zone ${p.hbjson ? 'ready' : ''}`}>
        <input type="file" accept=".hbjson,.json" hidden
          onChange={e => p.onHbjson(e.target.files?.[0] ?? null)} />
        {p.hbjson ? <FaCheckCircle style={{color:'#10b981',fontSize:'1.1rem'}} />
                   : <FaCloudUploadAlt style={{color:'#94a3b8',fontSize:'1.1rem'}} />}
        <p>{p.hbjson ? <span className="eo-file-name">{p.hbjson.name}</span> : 'HBJSON model'}</p>
      </label>
      <label className={`eo-upload-zone ${p.epw ? 'ready' : ''}`}>
        <input type="file" accept=".epw" hidden
          onChange={e => p.onEpw(e.target.files?.[0] ?? null)} />
        {p.epw ? <FaCheckCircle style={{color:'#10b981',fontSize:'1.1rem'}} />
               : <FaCloudUploadAlt style={{color:'#94a3b8',fontSize:'1.1rem'}} />}
        <p>{p.epw ? <span className="eo-file-name">{p.epw.name}</span> : 'EPW počasí'}</p>
      </label>
    </div>

    <div className="eo-budget-field">
      <div className="eo-budget-label">Celkový rozpočet (CZK)</div>
      <input className="eo-budget-input" type="number"
        min={50000} step={10000} value={p.budget}
        onChange={e => p.onBudget(+e.target.value)} />
    </div>

    <div className="eo-form-grid">
      <div className="eo-field">
        <span className="eo-label">Účinnost FVE (%)</span>
        <input className="eo-input" type="number" min={5} max={30}
          value={p.pvEfficiency} onChange={e => p.onPvEfficiency(+e.target.value)} />
      </div>
      <div className="eo-field">
        <span className="eo-label">Typ budovy</span>
        <select className="eo-select" value={p.buildingType}
          onChange={e => p.onBuildingType(e.target.value)}>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="eo-field">
        <span className="eo-label">Topná voda (°C)</span>
        <input className="eo-input" type="number" min={25} max={65}
          value={p.supplyTemp} onChange={e => p.onSupplyTemp(+e.target.value)} />
      </div>
      <div className="eo-field">
        <span className="eo-label">Cena ASHP (CZK)</span>
        <input className="eo-input" type="number" min={50000} step={10000}
          value={p.ashpCost} onChange={e => p.onAshpCost(+e.target.value)} />
      </div>
      <div className="eo-field">
        <span className="eo-label">Cena GSHP + kolektor (CZK)</span>
        <input className="eo-input" type="number" min={50000} step={10000}
          value={p.gshpCost} onChange={e => p.onGshpCost(+e.target.value)} />
      </div>
      <div className="eo-field">
        <span className="eo-label">Cena za panel (CZK)</span>
        <input className="eo-input" type="number" min={5000} step={1000}
          value={p.pvCostPerPanel} onChange={e => p.onPvCostPerPanel(+e.target.value)} />
      </div>
    </div>

    <button className="eo-run" onClick={p.onRun}
      disabled={p.loading || !p.hbjson || !p.epw}>
      {p.loading ? <><FaSpinner className="eo-spinner" /> Simulace…</> : 'Spustit PED analýzu'}
    </button>
  </div>
);

export default EOForm;