/**
 * Analýza potenciálu TČ — hlavní orchestrátor.
 *
 * HBJSON + EPW → EnergyPlus simulace → SCOP → výroba tepla,
 * spotřeba elektřiny, provozní náklady, CO₂ úspory.
 *
 * Nový parametr heat_recovery pro volitelnou rekuperaci.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump/HeatPumpAnalysis.tsx
 */
import React, { useState } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import HPForm from './HPForm';
import HPOverview from './HPOverview';
import HPSection from './HPSection';
import type { AnalysisResult } from './hpUtils';
import './HeatPumpAnalysis.css';
import './HeatPumpResults.css';

const API = 'http://127.0.0.1:8000/api/heatpump';

interface Props { onBack: () => void; }

const HeatPumpAnalysis: React.FC<Props> = ({ onBack }) => {
  const [hbjson, setHbjson] = useState<File | null>(null);
  const [epw, setEpw] = useState<File | null>(null);
  const [supplyTemp, setSupplyTemp] = useState(35);
  const [depth, setDepth] = useState(1.5);
  const [buildingType, setBuildingType] = useState('Residential');
  const [heatingSetpoint, setHeatingSetpoint] = useState(20);
  const [electricityPrice, setElectricityPrice] = useState(6.0);
  const [gridCo2, setGridCo2] = useState(450);
  const [heatRecovery, setHeatRecovery] = useState(0.0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
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
    fd.append('supply_temp_c', supplyTemp.toString());
    fd.append('collector_depth_m', depth.toString());
    fd.append('building_type', buildingType);
    fd.append('heating_setpoint_c', heatingSetpoint.toString());
    fd.append('electricity_price', electricityPrice.toString());
    fd.append('grid_co2_kg_per_mwh', gridCo2.toString());
    fd.append('heat_recovery', heatRecovery.toString());
    try {
      const res = await fetch(`${API}/analyze`, {
        method: 'POST',
        body: fd,
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
        <span className="hp-hero-badge">EnergyPlus + Ladybug</span>
        <h1>Potenciál tepelných čerpadel</h1>
        <p>
          Simulace tepelných zátěží, COP analýza a ekonomické
          porovnání ASHP vs GSHP pro váš projekt
        </p>
      </header>

      <HPForm
        hbjson={hbjson} epw={epw} supplyTemp={supplyTemp}
        depth={depth} buildingType={buildingType}
        heatingSetpoint={heatingSetpoint}
        electricityPrice={electricityPrice} gridCo2={gridCo2}
        heatRecovery={heatRecovery}
        loading={loading}
        onHbjson={setHbjson} onEpw={setEpw}
        onSupplyTemp={setSupplyTemp} onDepth={setDepth}
        onBuildingType={setBuildingType}
        onHeatingSetpoint={setHeatingSetpoint}
        onElectricityPrice={setElectricityPrice}
        onGridCo2={setGridCo2}
        onHeatRecovery={setHeatRecovery}
        onRun={handleRun}
      />

      {error && <div className="hp-error">{error}</div>}

      {result && (
        <div className="hp-results">
          <HPOverview result={result} />
          <HPSection data={result.ashp} color="ashp"
            totalHeating={result.simulation.total_heating_kwh}
            roomCount={result.model_info.room_count} />
          <HPSection data={result.gshp} color="gshp"
            totalHeating={result.simulation.total_heating_kwh}
            roomCount={result.model_info.room_count} />
        </div>
      )}
    </div>
  );
};

export default HeatPumpAnalysis;