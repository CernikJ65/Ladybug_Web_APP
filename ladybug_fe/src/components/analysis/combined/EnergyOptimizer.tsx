/**
 * Energetický optimalizátor — PED analýza.
 * ASHP vs GSHP vs jen FVE — podle rozpočtu.
 *
 * Soubor: ladybug_fe/src/components/analysis/combined/EnergyOptimizer.tsx
 */
import React, { useState } from 'react';
import { FaArrowLeft, FaBolt } from 'react-icons/fa';
import EOForm from './EOForm';
import EOResults, { type PedApiResult } from './EOResults';
import './EnergyOptimizer.css';

const API = 'http://127.0.0.1:8000/api/combined';

interface Props { onBack: () => void; }

const EnergyOptimizer: React.FC<Props> = ({ onBack }) => {
  const [hbjson, setHbjson] = useState<File | null>(null);
  const [epw, setEpw] = useState<File | null>(null);
  const [budget, setBudget] = useState(500_000);
  const [pvEfficiency, setPvEfficiency] = useState(20);
  const [buildingType, setBuildingType] = useState('Residential');
  const [supplyTemp, setSupplyTemp] = useState(35);
  const [heatingSetpoint, setHeatingSetpoint] = useState(20);
  const [ashpCost, setAshpCost] = useState(345_000);
  const [gshpCost, setGshpCost] = useState(500_000);
  const [pvCostPerPanel, setPvCostPerPanel] = useState(18_000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PedApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!hbjson || !epw) {
      setError('Nahrajte oba soubory');
      return;
    }
    setLoading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append('hbjson_file', hbjson);
    fd.append('epw_file', epw);
    fd.append('budget_czk', budget.toString());
    fd.append('pv_efficiency', (pvEfficiency / 100).toString());
    fd.append('building_type', buildingType);
    fd.append('supply_temp_c', supplyTemp.toString());
    fd.append('heating_setpoint_c', heatingSetpoint.toString());
    fd.append('ashp_cost', ashpCost.toString());
    fd.append('gshp_cost', gshpCost.toString());
    fd.append('pv_cost_per_panel', pvCostPerPanel.toString());
    try {
      const res = await fetch(`${API}/analyze`, {
        method: 'POST', body: fd,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || 'Chyba');
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    } finally { setLoading(false); }
  };

  return (
    <div className="eo-page">
      <header className="eo-hero">
        <button className="eo-back" onClick={onBack}>
          <FaArrowLeft /> Zpět
        </button>
        <div className="eo-hero-badge">
          <FaBolt /> EnergyPlus + Ladybug
        </div>
        <h1>Energetický optimalizátor</h1>
        <p>
          Zadejte rozpočet — porovnání ASHP vs GSHP vs jen FVE
          pro nejlepší PED bilanci
        </p>
      </header>

      <EOForm
        hbjson={hbjson} epw={epw} budget={budget}
        pvEfficiency={pvEfficiency} buildingType={buildingType}
        supplyTemp={supplyTemp} heatingSetpoint={heatingSetpoint}
        ashpCost={ashpCost} gshpCost={gshpCost}
        pvCostPerPanel={pvCostPerPanel} loading={loading}
        onHbjson={setHbjson} onEpw={setEpw}
        onBudget={setBudget} onPvEfficiency={setPvEfficiency}
        onBuildingType={setBuildingType}
        onSupplyTemp={setSupplyTemp}
        onHeatingSetpoint={setHeatingSetpoint}
        onAshpCost={setAshpCost} onGshpCost={setGshpCost}
        onPvCostPerPanel={setPvCostPerPanel}
        onRun={handleRun}
      />

      {error && <div className="eo-error">{error}</div>}
      {result && <EOResults data={result} />}
    </div>
  );
};

export default EnergyOptimizer;