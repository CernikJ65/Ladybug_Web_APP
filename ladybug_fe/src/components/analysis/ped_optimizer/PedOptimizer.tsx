/**
 * PED optimalizator — orchestrator.
 *
 * Layout: hero + form + (chyba|vysledky -> karty + breakdown + mesicni).
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedOptimizer.tsx
 */
import React, { useState } from 'react';
import { FaArrowLeft, FaBolt } from 'react-icons/fa';
import { useViewStateCache } from './../../../hooks/useViewStateCache';
import PedForm from './PedForm';
import PedVariantCards from './PedVariantCards';
import PedMonthlyTable from './PedMonthlyTable';
import PedConsumptionBreakdown from './PedConsumptionBreakdown';
import PedHpPerformance from './PedHpPerformance';
import { runPedAnalysis } from './pedApi';
import type { PedApiResult, MountingType } from './pedTypes';
import './PedOptimizer.css';

interface Props { onBack: () => void; }

interface CachedState {
  hbjson: File | null;
  epw: File | null;
  budget: number;
  heatingSetpoint: number;
  ashpCost: number;
  gshpCost: number;
  pvCostPerPanel: number;
  pvEfficiency: number;
  mountingType: MountingType;
  result: PedApiResult | null;
  selectedIdx: number;
  error: string | null;
}

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

const PedOptimizer: React.FC<Props> = ({ onBack }) => {
  const [hbjson, setHbjson] = useState<File | null>(null);
  const [epw, setEpw] = useState<File | null>(null);
  const [budget, setBudget] = useState(500_000);
  const [heatingSetpoint, setHeatingSetpoint] = useState(20);
  const [ashpCost, setAshpCost] = useState(250_000);
  const [gshpCost, setGshpCost] = useState(370_000);
  const [pvCostPerPanel, setPvCostPerPanel] = useState(18_000);
  const [pvEfficiency, setPvEfficiency] = useState(20);
  const [mountingType, setMountingType] =
    useState<MountingType>('FixedOpenRack');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PedApiResult | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useViewStateCache<CachedState>(
    'ped-optimizer',
    {
      hbjson, epw, budget, heatingSetpoint,
      ashpCost, gshpCost, pvCostPerPanel, pvEfficiency,
      mountingType, result, selectedIdx, error,
    },
    (c) => {
      setHbjson(c.hbjson); setEpw(c.epw);
      setBudget(c.budget); setHeatingSetpoint(c.heatingSetpoint);
      setAshpCost(c.ashpCost); setGshpCost(c.gshpCost);
      setPvCostPerPanel(c.pvCostPerPanel);
      setPvEfficiency(c.pvEfficiency);
      setMountingType(c.mountingType);
      setResult(c.result); setSelectedIdx(c.selectedIdx);
      setError(c.error);
    },
  );

  const handleRun = async () => {
    if (!hbjson || !epw) {
      setError('Nahrajte oba soubory — HBJSON i EPW');
      return;
    }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await runPedAnalysis({
        hbjson, epw, budget, heatingSetpoint,
        ashpCost, gshpCost, pvCostPerPanel, pvEfficiency,
        mountingType,
      });
      setResult(data);
      setSelectedIdx(data.best_index);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  };

  const selected = result?.variants[selectedIdx] ?? null;

  return (
    <div className="ped-page">
      <header className="ped-hero">
        <button className="ped-back" onClick={onBack}>
          <FaArrowLeft /> Zpět
        </button>
        <div className="ped-hero-badge">
          <FaBolt /> EnergyPlus + Radiance + pvlib
        </div>
        <h1>PED optimalizátor</h1>
        <p>
          Porovnání 3 variant: jen panely · ASHP + panely · GSHP + panely.
          Cíl: výroba pokryje celkovou spotřebu budovy (PED).
        </p>
      </header>

      <PedForm
        hbjson={hbjson} epw={epw} budget={budget}
        heatingSetpoint={heatingSetpoint}
        ashpCost={ashpCost} gshpCost={gshpCost}
        pvCostPerPanel={pvCostPerPanel}
        pvEfficiency={pvEfficiency}
        mountingType={mountingType}
        loading={loading}
        onHbjson={setHbjson} onEpw={setEpw}
        onBudget={setBudget}
        onHeatingSetpoint={setHeatingSetpoint}
        onAshpCost={setAshpCost} onGshpCost={setGshpCost}
        onPvCostPerPanel={setPvCostPerPanel}
        onPvEfficiency={setPvEfficiency}
        onMountingType={setMountingType}
        onRun={handleRun}
      />

      {error && <div className="ped-error">{error}</div>}

      {result && (
        <div className="ped-results">
          <div className="ped-summary">
            {result.location && <span>Lokalita: {result.location}</span>}
            <span>Místností: {result.model_info.room_count}</span>
            <span>
              Plocha: {fmt(result.model_info.total_floor_area_m2)} m²
            </span>
            <span>Dostupných panelů: {result.max_panels_available}</span>
            <span>Rozpočet: {fmt(result.budget_czk)} Kč</span>
            <span>
              FVE: {result.pv_settings.engine} ·{' '}
              {result.pv_settings.mounting_type === 'FixedOpenRack'
                ? 'otevřená konstrukce'
                : 'přilehlá ke střeše'}
            </span>
          </div>

          <PedVariantCards
            variants={result.variants}
            bestIndex={result.best_index}
            selectedIndex={selectedIdx}
            onSelect={setSelectedIdx}
          />

          {selected && selected.system.available
            && selected.consumption_kwh && (
            <>
              {selected.hp_performance && (
                <PedHpPerformance
                  data={selected.hp_performance}
                  hpLabel={selected.system.hp_label}
                />
              )}
              <h3 className="ped-section-title">
                Roční spotřeba budovy — {selected.system.label}
              </h3>
              <PedConsumptionBreakdown data={selected.consumption_kwh} />
              <PedMonthlyTable variant={selected} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PedOptimizer;
