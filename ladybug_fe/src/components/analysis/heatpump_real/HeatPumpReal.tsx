/**
 * Celoroční simulace TČ s reálným HVAC — orchestrátor.
 *
 * Tok: HBJSON + EPW + typ budovy + setpointy + rekuperace
 *   rekuperace 0 → VRF / WSHP_GSHP (bez ventilace, čisté HP)
 *   rekuperace > 0 → VRFwithDOAS / WSHPwithDOAS s ERV
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HeatPumpReal.tsx
 */
import React, { useState } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import HPRealForm from './HPRealForm';
import HPRealOverview from './HPRealOverview';
import HPRealDemand from './HPRealDemand';
import HPRealSection from './HPRealSection';
import type { RealHPResult } from './hpRealUtils';
import './HeatPumpReal.css';
import './HeatPumpRealResults.css';

const API = 'http://127.0.0.1:8000/api/heatpump-real';

interface Props { onBack: () => void; }

const HeatPumpReal: React.FC<Props> = ({ onBack }) => {
  const [hbjson, setHbjson] = useState<File | null>(null);
  const [epw, setEpw] = useState<File | null>(null);
  const [buildingType, setBuildingType] = useState('Residential');
  const [heatingSp, setHeatingSp] = useState(20);
  const [coolingSp, setCoolingSp] = useState(26);
  const [heatRecovery, setHeatRecovery] = useState(0);
  const [heatingOnly, setHeatingOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RealHPResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!hbjson || !epw) {
      setError('Nahrajte oba soubory — HBJSON i EPW');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append('hbjson_file', hbjson);
    fd.append('epw_file', epw);
    fd.append('building_type', buildingType);
    fd.append('heating_setpoint_c', heatingSp.toString());
    fd.append('cooling_setpoint_c', coolingSp.toString());
    fd.append('heat_recovery', heatRecovery.toString());
    fd.append('heating_only', heatingOnly.toString());
    try {
      const res = await fetch(`${API}/analyze`, {
        method: 'POST', body: fd,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || 'Chyba serveru');
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hp-page">
      <header className="hp-hero">
        <button className="hp-back" onClick={onBack}>
          <FaArrowLeft /> Zpět na přehled
        </button>
        <span className="hp-hero-badge">Reálný HVAC · EnergyPlus</span>
        <h1>Celoroční simulace TČ</h1>
        <p>
          Per-zone terminály — 1 tepelné čerpadlo na místnost.
          Vzduch-voda vs. země-voda přes Ladybug HVAC šablony.
        </p>
      </header>

      <HPRealForm
        hbjson={hbjson} epw={epw}
        buildingType={buildingType}
        heatingSp={heatingSp} coolingSp={coolingSp}
        heatRecovery={heatRecovery}
        heatingOnly={heatingOnly}
        loading={loading}
        onHbjson={setHbjson} onEpw={setEpw}
        onBuildingType={setBuildingType}
        onHeatingSp={setHeatingSp}
        onCoolingSp={setCoolingSp}
        onHeatRecovery={setHeatRecovery}
        onHeatingOnly={setHeatingOnly}
        onRun={handleRun}
      />

      {error && <div className="hp-error">{error}</div>}

      {result && (
        <div className="hp-results">
          <HPRealOverview result={result} />
          <HPRealDemand demand={result.building_demand}
            area={result.model_info.total_floor_area_m2}
            heatingOnly={result.parameters.heating_only} />
          <HPRealSection data={result.ashp} color="ashp"
            heatingOnly={result.parameters.heating_only} />
          <HPRealSection data={result.gshp} color="gshp"
            heatingOnly={result.parameters.heating_only} />
        </div>
      )}
    </div>
  );
};

export default HeatPumpReal;
