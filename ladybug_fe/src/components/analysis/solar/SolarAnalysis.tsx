import React, { useState, useCallback, useMemo } from 'react';
import {
  FaCloudSun, FaUpload, FaSpinner, FaArrowLeft,
  FaWind, FaThermometerHalf, FaCompass, FaTimes,
} from 'react-icons/fa';
import { useViewStateCache } from './../../../hooks/useViewStateCache';
import WindView, { type WindData } from './WindView';
import TemperatureView, { type TemperatureData } from './TemperatureView';
import SunpathView, { type SunpathData } from './SunpathView';
import HelpButton from '../../help/HelpButton';
import TourOverlay from '../../help/TourOverlay';
import { getEpwSteps } from '../../help/content/epwSteps';
import './SolarAnalysis.css';

/* ---------- typy ---------- */
interface LocationInfo {
  city: string; latitude: number; longitude: number; elevation: number;
}

type TabKey = 'wind' | 'temperature' | 'sunpath';

interface CachedState {
  file: File | null;
  fileName: string | null;
  location: LocationInfo | null;
  windData: WindData | null;
  tempData: TemperatureData | null;
  sunpathData: SunpathData | null;
  error: string | null;
}

interface Props { onBack: () => void; }

const API = 'http://127.0.0.1:8000/api/analysis';

/* ---------- komponenta ---------- */
const SolarAnalysis: React.FC<Props> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [windData, setWindData] = useState<WindData | null>(null);
  const [tempData, setTempData] = useState<TemperatureData | null>(null);
  const [sunpathData, setSunpathData] = useState<SunpathData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('wind');
  const [tourOpen, setTourOpen] = useState(false);

  /* Memoizace kroků průvodce — zabrání resetu při každém renderu rodiče.
     Přepočítá se jen při změně aktivní záložky nebo při nahrání dat. */
  const hasLocation = location !== null;
  const tourSteps = useMemo(
    () => getEpwSteps(activeTab, hasLocation),
    [activeTab, hasLocation],
  );

  useViewStateCache<CachedState>(
    'solar',
    { file, fileName, location, windData, tempData, sunpathData, error },
    (c: CachedState) => {
      setFile(c.file); setFileName(c.fileName); setLocation(c.location);
      setWindData(c.windData); setTempData(c.tempData);
      setSunpathData(c.sunpathData); setError(c.error);
    }
  );

  const handleRemoveFile = () => {
    setFile(null);
    setFileName(null);
    setLocation(null);
    setWindData(null);
    setTempData(null);
    setSunpathData(null);
    setError(null);
    const input = document.getElementById('epw-upload') as HTMLInputElement | null;
    if (input) input.value = '';
  };

  const handleUpload = async () => {
    if (!file) { setError('Vyberte EPW soubor'); return; }
    setLoading(true); setError(null);
    setWindData(null); setTempData(null); setSunpathData(null); setLocation(null);

    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch(`${API}/wind-advanced`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).detail || 'Chyba');
      const json = await res.json() as { location: LocationInfo; wind: WindData };
      setLocation(json.location);
      setWindData(json.wind);
      setActiveTab('wind');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba');
    } finally { setLoading(false); }
  };

  const loadTab = useCallback(async (tab: TabKey) => {
    if (!file) return;
    setActiveTab(tab);

    if (tab === 'temperature' && !tempData) {
      setTabLoading(true);
      const fd = new FormData(); fd.append('file', file);
      try {
        const res = await fetch(`${API}/temperature`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error((await res.json()).detail || 'Chyba');
        const json = await res.json() as { temperature: TemperatureData };
        setTempData(json.temperature);
      } catch (e) { setError(e instanceof Error ? e.message : 'Chyba'); }
      finally { setTabLoading(false); }
    }

    if (tab === 'sunpath' && !sunpathData) {
      setTabLoading(true);
      const fd = new FormData(); fd.append('file', file);
      try {
        const res = await fetch(`${API}/sunpath`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error((await res.json()).detail || 'Chyba');
        const json = await res.json() as { sunpath: SunpathData };
        setSunpathData(json.sunpath);
      } catch (e) { setError(e instanceof Error ? e.message : 'Chyba'); }
      finally { setTabLoading(false); }
    }
  }, [file, tempData, sunpathData]);

  return (
    <div className="sa-page">
      <HelpButton onClick={() => setTourOpen(true)} />
      <TourOverlay
        isActive={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
      />

      <button onClick={onBack} className="back-button"><FaArrowLeft /> Zpět na přehled</button>

      <div className="analysis-header">
        <FaCloudSun size={48} color="#f0a500" />
        <h1>Analýza EPW dat o počasí</h1>
        <p>Nahrajte EPW soubor — větrná růžice, teplotní profily i sluneční dráha</p>
      </div>

      <div className="upload-area">
        <input type="file" accept=".epw" id="epw-upload" style={{ display: 'none' }}
          onChange={e => { setFile(e.target.files?.[0] || null);
            setFileName(e.target.files?.[0]?.name || null); setError(null); }} />
        <label htmlFor="epw-upload" className="upload-label">
          <FaUpload size={32} color="#f0a500" />
          <p>{fileName || 'Klikněte pro výběr EPW souboru'}</p>
          {file && (
            <button
              type="button"
              className="upload-clear"
              onClick={e => { e.preventDefault(); e.stopPropagation(); handleRemoveFile(); }}
              aria-label="Odstranit soubor"
              title="Odstranit soubor"
            >
              <FaTimes />
            </button>
          )}
        </label>
        {file && (
          <button onClick={handleUpload} disabled={loading} className="upload-button">
            {loading ? <><FaSpinner className="spinner" /> Analyzuji…</> : 'Spustit analýzu'}
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {location && windData && (
        <div className="sa-results">
          <div className="sa-loc-bar">
            {location.city} · {location.latitude.toFixed(2)}° N, {location.longitude.toFixed(2)}° E · {location.elevation} m
          </div>

          <div className="sa-tabs">
            {([
              { key: 'wind' as TabKey, label: 'Vítr', icon: <FaWind /> },
              { key: 'temperature' as TabKey, label: 'Teplota', icon: <FaThermometerHalf /> },
              { key: 'sunpath' as TabKey, label: 'Sluneční dráha', icon: <FaCompass /> },
            ]).map(t => (
              <button key={t.key}
                className={`sa-tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => t.key === 'wind' ? setActiveTab('wind') : loadTab(t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="sa-tab-body">
            {tabLoading && (
              <div className="sa-tab-loading"><FaSpinner className="spinner" /> Načítám data…</div>
            )}

            {activeTab === 'wind' && !tabLoading && windData && (
              <WindView data={windData} />
            )}
            {activeTab === 'temperature' && !tabLoading && tempData && (
              <TemperatureView data={tempData} />
            )}
            {activeTab === 'sunpath' && !tabLoading && sunpathData && (
              <SunpathView data={sunpathData} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SolarAnalysis;