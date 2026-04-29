/**
 * Celorocni simulace TC s realnym HVAC — orchestrator.
 *
 * Layout: Overview budovy → Tepelna potreba → Porovnani TC (taby).
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HeatPumpReal.tsx
 */
import React, { useState, useEffect } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { useViewStateCache } from './../../../hooks/useViewStateCache';
import { useSimulationProgress } from './../../../hooks/useSimulationProgress';
import { useSharedFiles } from './../../../context/SharedFilesContext';
import SimulationProgressOverlay from '../../common/SimulationProgressOverlay';
import HPRealForm from './HPRealForm';
import HPRealOverview from './HPRealOverview';
import HPRealDemand from './HPRealDemand';
import HPRealComparison from './HPRealComparison';
import type { RealHPResult } from './hpRealUtils';
import './HeatPumpReal.css';
import './HeatPumpRealResults.css';

const API = 'http://127.0.0.1:8000/api/heatpump-real';

interface Props { onBack: () => void; }

interface CachedState {
  hbjson: File | null;
  epw: File | null;
  buildingType: string;
  heatingSp: number;
  coolingSp: number;
  heatRecovery: number;
  heatingOnly: boolean;
  result: RealHPResult | null;
  error: string | null;
}

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
  const [jobId, setJobId] = useState<string | null>(null);

  const progress = useSimulationProgress(loading ? jobId : null);
  const sharedFiles = useSharedFiles();

  useEffect(() => {
    setHbjson(sharedFiles.getHbjson());
    setEpw(sharedFiles.getEpw());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Zachování stavu při návratu z landing page (stejně jako solar/heatpump) */
  useViewStateCache<CachedState>(
    'heatpump-real',
    {
      hbjson, epw, buildingType, heatingSp, coolingSp,
      heatRecovery, heatingOnly, result, error,
    },
    (c: CachedState) => {
      setHbjson(c.hbjson);
      setEpw(c.epw);
      setBuildingType(c.buildingType);
      setHeatingSp(c.heatingSp);
      setCoolingSp(c.coolingSp);
      setHeatRecovery(c.heatRecovery);
      setHeatingOnly(c.heatingOnly);
      setResult(c.result);
      setError(c.error);
    }
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
    fd.append('job_id', newJobId);
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
      <SimulationProgressOverlay
        open={loading}
        progress={progress}
        title="Simulace tepelných čerpadel"
      />

      <header className="hp-hero">
        <button className="hp-back" onClick={onBack}>
          <FaArrowLeft /> Zpět na přehled
        </button>
        <h1>Potenciál tepelných čerpadel</h1>
        <p className="hp-hero-sub">
    Tento scénář umisťuje do zón vyznačených v HBJSON datech tepelná čerpadla a počítá jejich potenciál. 
Zároveň porovnává dva druhy čerpadel, vzduch-voda (ASHP) a země-voda (GSHP), proto se simulace interně spouští dvakrát.
</p>
      </header>

      <HPRealForm
        hbjson={hbjson} epw={epw}
        buildingType={buildingType}
        heatingSp={heatingSp} coolingSp={coolingSp}
        heatRecovery={heatRecovery}
        heatingOnly={heatingOnly}
        loading={loading}
        onHbjson={(f) => { setHbjson(f); sharedFiles.setHbjson(f); }}
        onEpw={(f) => { setEpw(f); sharedFiles.setEpw(f); }}
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
          <HPRealDemand
            demand={result.building_demand}
            heatingOnly={result.parameters.heating_only} />
          <HPRealComparison
            ashp={result.ashp}
            gshp={result.gshp}
            rooms={result.building_demand.rooms}
            heatingOnly={result.parameters.heating_only} />
        </div>
      )}
    </div>
  );
};

export default HeatPumpReal;