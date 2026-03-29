/**
 * Celoroční simulace TČ s reálným HVAC — orchestrátor.
 *
 * HBJSON + EPW → EnergyPlus s VRFwithDOAS / WSHPwithDOAS →
 * celoroční výsledky včetně chlazení v létě.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HeatPumpReal.tsx
 */
import React, { useState } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import HPRealForm from './HPRealForm';
import HPRealOverview from './HPRealOverview';
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
  const [heatRecovery, setHeatRecovery] = useState(0.0);
  const [price, setPrice] = useState(6.0);
  const [co2, setCo2] = useState(450);
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
    fd.append('electricity_price', price.toString());
    fd.append('grid_co2_kg_per_mwh', co2.toString());
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
          VRF a WSHP systémy s realistickými výkonovými
          křivkami — vytápění i chlazení po celý rok
        </p>
      </header>

      <HPRealForm
        hbjson={hbjson} epw={epw}
        buildingType={buildingType}
        heatingSp={heatingSp} coolingSp={coolingSp}
        heatRecovery={heatRecovery}
        price={price} co2={co2} loading={loading}
        onHbjson={setHbjson} onEpw={setEpw}
        onBuildingType={setBuildingType}
        onHeatingSp={setHeatingSp}
        onCoolingSp={setCoolingSp}
        onHeatRecovery={setHeatRecovery}
        onPrice={setPrice} onCo2={setCo2}
        onRun={handleRun}
      />

      {error && <div className="hp-error">{error}</div>}

      {result && (
        <div className="hp-results">
          <HPRealOverview result={result} />
          <HPRealSection data={result.vrf} color="vrf" />
          <HPRealSection data={result.wshp} color="wshp" />
        </div>
      )}
    </div>
  );
};

export default HeatPumpReal;