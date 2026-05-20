import React, { useState, useEffect, useMemo } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import SimulationProgressOverlay from '../../common/SimulationProgressOverlay';
import HelpButton from '../../help/HelpButton';
import TourOverlay from '../../help/TourOverlay';
import { getSolarAdvancedSteps } from '../../help/content/solarAdvancedSteps';
import { useSimulationProgress } from '../../../hooks/useSimulationProgress';
import { useViewStateCache } from './../../../hooks/useViewStateCache';
import { useSharedFiles } from './../../../context/SharedFilesContext';
import { useT } from '../../../i18n/useT';
import SolarUploadCard from './SolarUploadCard';
import SolarConfigCard from './SolarConfigCard';
import SolarResultsView from './SolarResultsView';
import { PV_EFF_DEFAULT } from './solarConstants';
import type { AnalysisResult, CachedState } from './solarTypes';
import './SolarAnalysisAdvanced.css';

interface Props {
  onBack: () => void;
}

const SolarAnalysisAdvanced: React.FC<Props> = ({ onBack }) => {
  const t = useT();
  const [hbjsonFile, setHbjsonFile] = useState<File | null>(null);
  const [epwFile, setEpwFile]       = useState<File | null>(null);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<AnalysisResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [numPanels, setNumPanels]   = useState(8);
  const [pvEff, setPvEff]           = useState(PV_EFF_DEFAULT);
  const [maxTilt, setMaxTilt]       = useState(60);
  const [mountType, setMountType]   = useState('FixedOpenRack');
  const [jobId, setJobId]           = useState<string | null>(null);
  const [tourOpen, setTourOpen]     = useState(false);

  const progress = useSimulationProgress(loading ? jobId : null);

  /* Memoizace kroků průvodce — přepočet jen při změně stavu výsledků. */
  const tourSteps = useMemo(
    () => getSolarAdvancedSteps(result !== null),
    [result],
  );

  useViewStateCache<CachedState>(
    'solar-advanced',
    { hbjsonFile, epwFile, result, error, numPanels, pvEff, maxTilt, mountType },
    (c: CachedState) => {
      setHbjsonFile(c.hbjsonFile);
      setEpwFile(c.epwFile);
      setResult(c.result);
      setError(c.error);
      setNumPanels(c.numPanels);
      setPvEff(c.pvEff);
      setMaxTilt(c.maxTilt);
      setMountType(c.mountType);
    }
  );

  const sharedFiles = useSharedFiles();

  useEffect(() => {
    setHbjsonFile(sharedFiles.getHbjson());
    setEpwFile(sharedFiles.getEpw());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (
    setter: React.Dispatch<React.SetStateAction<File | null>>,
    sharedSetter?: (f: File | null) => void,
  ) => (f: File | null) => {
    setter(f);
    if (sharedSetter) sharedSetter(f);
    setError(null);
    setResult(null);
  };

  const run = async () => {
    if (!hbjsonFile || !epwFile) { setError(t('Vyberte oba soubory')); return; }
    const newJobId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setJobId(newJobId);
    setLoading(true); setError(null); setResult(null);

    const fd = new FormData();
    fd.append('hbjson_file', hbjsonFile);
    fd.append('epw_file', epwFile);
    fd.append('num_panels', numPanels.toString());
    fd.append('pv_efficiency', (pvEff / 100).toString());
    fd.append('max_tilt', maxTilt.toString());
    fd.append('mounting_type', mountType);
    fd.append('job_id', newJobId);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/solar/optimize-panels', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || t('Chyba'));
      }
      const data: AnalysisResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Neznámá chyba'));
    } finally {
      setLoading(false);
    }
  };

  const sel = result ? result.optimization.result : null;

  return (
    <div className="saa-page">
      <HelpButton onClick={() => setTourOpen(true)} />
      <TourOverlay
        isActive={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
      />

      <SimulationProgressOverlay
        open={loading}
        progress={progress}
        title={t('Solární analýza')}
      />

      <header className="saa-hero">
        <button className="saa-back" onClick={onBack}>
          <FaArrowLeft /> {t('Zpět na přehled')}
        </button>

        <h1>{t('Solární analýza')}</h1>
        <p>
          {t('Scénar, který na základě EPW a HBJSON dat simuluje solární potenciál dopadu slunečního zářeni na panely a na základě toto následně similuje kolik je panel schopen produkovat .')}
        </p>
      </header>

      <div className="saa-form-wrap">
        <SolarUploadCard
          hbjsonFile={hbjsonFile}
          epwFile={epwFile}
          onHbjsonChange={handleFileChange(setHbjsonFile, sharedFiles.setHbjson)}
          onEpwChange={handleFileChange(setEpwFile, sharedFiles.setEpw)}
          t={t}
        />

        <SolarConfigCard
          numPanels={numPanels}
          pvEff={pvEff}
          maxTilt={maxTilt}
          mountType={mountType}
          loading={loading}
          disabled={loading || !hbjsonFile || !epwFile}
          onNumPanelsChange={setNumPanels}
          onPvEffChange={setPvEff}
          onMaxTiltChange={setMaxTilt}
          onMountTypeChange={setMountType}
          onRun={run}
          t={t}
        />
      </div>

      {error && (
        <div className="saa-error">
          <strong>{t('Chyba:')}</strong> {error}
        </div>
      )}

      {result && sel && (
        <SolarResultsView result={result} sel={sel} t={t} />
      )}
    </div>
  );
};

export default SolarAnalysisAdvanced;
