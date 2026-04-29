/**
 * PED optimalizator — orchestrator.
 * Apple-clean · modrá paleta · text-only sekce a chipy.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedOptimizer.tsx
 */
import React, { useState, useEffect } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { useViewStateCache } from './../../../hooks/useViewStateCache';
import { useSimulationProgress } from './../../../hooks/useSimulationProgress';
import { useSharedFiles } from './../../../context/SharedFilesContext';
import SimulationProgressOverlay from '../../common/SimulationProgressOverlay';
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
  const [jobId, setJobId] = useState<string | null>(null);

  const progress = useSimulationProgress(loading ? jobId : null);
  const sharedFiles = useSharedFiles();

  useEffect(() => {
    setHbjson(sharedFiles.getHbjson());
    setEpw(sharedFiles.getEpw());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const newJobId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setJobId(newJobId);
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await runPedAnalysis({
        hbjson, epw, budget, heatingSetpoint,
        ashpCost, gshpCost, pvCostPerPanel, pvEfficiency,
        mountingType, jobId: newJobId,
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
      <SimulationProgressOverlay
        open={loading}
        progress={progress}
        title="PED analýza"
      />

      <header className="ped-hero">
        <button className="ped-back" onClick={onBack}>
          <FaArrowLeft /> Zpět na přehled
        </button>
       
        <h1>PED optimalizátor</h1>
        <p>
          Porovnání tří investičních scénářů v rámci zadaného rozpočtu.
          Cílem je dosáhnout celoroční energetické bilance budovy.
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
        onHbjson={(f) => { setHbjson(f); sharedFiles.setHbjson(f); }}
        onEpw={(f) => { setEpw(f); sharedFiles.setEpw(f); }}
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
            {result.location && (
              <span className="ped-chip">
                Lokalita <strong>{result.location}</strong>
              </span>
            )}
            <span className="ped-chip">
              Místností <strong>{result.model_info.room_count}</strong>
            </span>
            <span className="ped-chip">
              Plocha <strong>{fmt(result.model_info.total_floor_area_m2)}</strong> m²
            </span>
            <span className="ped-chip">
              Maximalní počet panelů <strong>{result.max_panels_available}</strong>
            </span>
            <span className="ped-chip">
              Rozpočet <strong>{fmt(result.budget_czk)}</strong> Kč
            </span>
          </div>

          <h2 className="ped-section-title">Varianty</h2>
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
                <>
                  <h2 className="ped-section-title">
                    Výkon TČ — {selected.system.hp_label}
                  </h2>
                  <PedHpPerformance data={selected.hp_performance} />
                </>
              )}
              <h2 className="ped-section-title">Roční spotřeba budovy</h2>
              <PedConsumptionBreakdown
                data={selected.consumption_kwh}
                hasHeatPump={selected.system.has_hp}
              />
              <h2 className="ped-section-title">Měsíční bilance</h2>
              <PedMonthlyTable variant={selected} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PedOptimizer;