/**
 * PED optimalizator — orchestrator.
 * Apple-clean · modrá paleta · sjednoceno se solar-advanced.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedOptimizer.tsx
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  FaArrowLeft, FaMapMarkerAlt, FaBuilding,
  FaSolarPanel, FaWallet,
} from 'react-icons/fa';
import { useViewStateCache } from './../../../hooks/useViewStateCache';
import { useSimulationProgress } from './../../../hooks/useSimulationProgress';
import { useSharedFiles } from './../../../context/SharedFilesContext';
import SimulationProgressOverlay from '../../common/SimulationProgressOverlay';
import HelpButton from '../../help/HelpButton';
import TourOverlay from '../../help/TourOverlay';
import { getPedOptimizerSteps } from '../../help/content/pedOptimizerSteps';
import PedForm from './PedForm';
import PedVariantCards from './PedVariantCards';
import PedMonthlyTable from './PedMonthlyTable';
import PedConsumptionBreakdown from './PedConsumptionBreakdown';
import PedHpPerformance from './PedHpPerformance';
import { runPedAnalysis } from './pedApi';
import type { PedApiResult, MountingType } from './pedTypes';
import { useT } from '../../../i18n/useT';
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
  const t = useT();
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
  const [tourOpen, setTourOpen] = useState(false);

  const progress = useSimulationProgress(loading ? jobId : null);
  const sharedFiles = useSharedFiles();

  const tourSteps = useMemo(
    () => getPedOptimizerSteps(result !== null),
    [result],
  );

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
      setError(t('Nahrajte oba soubory — HBJSON i EPW'));
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
      setError(e instanceof Error ? e.message : t('Neznámá chyba'));
    } finally {
      setLoading(false);
    }
  };

  const selected = result?.variants[selectedIdx] ?? null;

  return (
    <div className="ped-page">
      <HelpButton onClick={() => setTourOpen(true)} />
      <TourOverlay
        isActive={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
      />

      <SimulationProgressOverlay
        open={loading}
        progress={progress}
        title={t('PED analýza')}
      />

      <header className="ped-hero">
        <button className="ped-back" onClick={onBack}>
          <FaArrowLeft /> {t('Zpět na přehled')}
        </button>

        <h1>{t('Optimalizace Oblasti pomocí PV a TČ')}</h1>
        <p>
          {t('Uživatel zadá investiční rozpočet a v rámci zadaného rozpočtu simulace osadí oblast energetickými agenty třemi způsoby. Cílem je dosáhnout celoroční energetické bilance budovy.')}
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
          <div className="ped-info-strip">
            {result.location && (
              <span className="ped-chip">
                <FaMapMarkerAlt />
                {t('Lokalita')} <strong>{result.location}</strong>
              </span>
            )}
            <span className="ped-chip">
              <FaBuilding />
              {t('Místností')} <strong>{result.model_info.room_count}</strong>
            </span>
            <span className="ped-chip">
              <FaBuilding />
              {t('Plocha')} <strong>{fmt(result.model_info.total_floor_area_m2)}</strong> m²
            </span>
            <span className="ped-chip">
              <FaSolarPanel />
              {t('Max panelů')} <strong>{result.max_panels_available}</strong>
            </span>
            <span className="ped-chip">
              <FaWallet />
              {t('Rozpočet')} <strong>{fmt(result.budget_czk)}</strong> {t('Kč')}
            </span>
          </div>

          <h2 className="ped-section-title">{t('Varianty')}</h2>
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
                    {t('Výkon TČ')} {t(selected.system.hp_label)}
                  </h2>
                  <PedHpPerformance data={selected.hp_performance} />
                </>
              )}
              <h2 className="ped-section-title">{t('Roční spotřeba budovy')}</h2>
              <div data-tour="ped-consumption">
                <PedConsumptionBreakdown
                  data={selected.consumption_kwh}
                  hasHeatPump={selected.system.has_hp}
                />
              </div>
              <h2 className="ped-section-title">{t('Měsíční bilance')}</h2>
              <div data-tour="ped-monthly">
                <PedMonthlyTable variant={selected} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PedOptimizer;