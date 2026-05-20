import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  FaCloudSun, FaUpload, FaSpinner, FaArrowLeft,
  FaWind, FaThermometerHalf, FaCompass, FaTimes,
} from 'react-icons/fa';
import { useViewStateCache } from './../../../hooks/useViewStateCache';
import { useSharedFiles } from './../../../context/SharedFilesContext';
import WindView, { type WindData } from './WindView';
import TemperatureView, { type TemperatureData } from './TemperatureView';
import SunpathView, { type SunpathData } from './SunpathView';
import HelpButton from '../../help/HelpButton';
import TourOverlay from '../../help/TourOverlay';
import { getEpwSteps } from '../../help/content/epwSteps';
import { useT } from '../../../i18n/useT';
import './EpwAnalysis.css';

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
const EpwAnalysis: React.FC<Props> = ({ onBack }) => {
  const t = useT();
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

  const sharedFiles = useSharedFiles();

  useEffect(() => {
    const f = sharedFiles.getEpw();
    if (f) {
      setFile(f);
      setFileName(f.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useViewStateCache<CachedState>(
    'solar',
    { file, fileName, location, windData, tempData, sunpathData, error },
    (c: CachedState) => {
      /* Shared kontext má přednost — pokud byl EPW v jiné stránce odebrán
         nebo nahrazen, nesmí se obnovit z lokální cache. Při změně souboru
         pozbývají smyslu i odvozená data (location/wind/temp/sunpath). */
      const sharedEpw = sharedFiles.getEpw();
      if (sharedEpw !== c.file) {
        setFile(sharedEpw);
        setFileName(sharedEpw?.name ?? null);
        setLocation(null);
        setWindData(null);
        setTempData(null);
        setSunpathData(null);
        setError(null);
        return;
      }
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
    sharedFiles.setEpw(null);
    const input = document.getElementById('epw-upload') as HTMLInputElement | null;
    if (input) input.value = '';
  };

  const handleUpload = async () => {
    if (!file) { setError(t('Vyberte EPW soubor')); return; }
    setLoading(true); setError(null);
    setWindData(null); setTempData(null); setSunpathData(null); setLocation(null);

    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch(`${API}/wind-advanced`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).detail || t('Chyba'));
      const json = await res.json() as { location: LocationInfo; wind: WindData };
      setLocation(json.location);
      setWindData(json.wind);
      setActiveTab('wind');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Neznámá chyba'));
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
        if (!res.ok) throw new Error((await res.json()).detail || t('Chyba'));
        const json = await res.json() as { temperature: TemperatureData };
        setTempData(json.temperature);
      } catch (e) { setError(e instanceof Error ? e.message : t('Chyba')); }
      finally { setTabLoading(false); }
    }

    if (tab === 'sunpath' && !sunpathData) {
      setTabLoading(true);
      const fd = new FormData(); fd.append('file', file);
      try {
        const res = await fetch(`${API}/sunpath`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error((await res.json()).detail || t('Chyba'));
        const json = await res.json() as { sunpath: SunpathData };
        setSunpathData(json.sunpath);
      } catch (e) { setError(e instanceof Error ? e.message : t('Chyba')); }
      finally { setTabLoading(false); }
    }
  }, [file, tempData, sunpathData, t]);

  return (
    <div className="sa-page">
      <HelpButton onClick={() => setTourOpen(true)} />
      <TourOverlay
        isActive={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
      />

      <button onClick={onBack} className="back-button"><FaArrowLeft /> {t('Zpět na přehled')}</button>

      <div className="analysis-header">
        <FaCloudSun size={48} color="#f0a500" />
        <h1>{t('Analýza EPW dat o počasí')}</h1>
        <p>{t('Nahrajte EPW soubor, pro provedení analýzy větru, teploty a sluneční dráhy')}</p>
      </div>

      <div className="upload-area">
        <input type="file" accept=".epw" id="epw-upload" style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0] || null;
            setFile(f);
            setFileName(f?.name || null);
            setError(null);
            sharedFiles.setEpw(f);
          }} />
        <label htmlFor="epw-upload" className="upload-label">
          <FaUpload size={32} color="#f0a500" />
          <p>{fileName || t('Klikněte pro výběr EPW souboru')}</p>
          {file && (
            <button
              type="button"
              className="upload-clear"
              onClick={e => { e.preventDefault(); e.stopPropagation(); handleRemoveFile(); }}
              aria-label={t('Odstranit soubor')}
              title={t('Odstranit soubor')}
            >
              <FaTimes />
            </button>
          )}
        </label>
        {file && (
          <button onClick={handleUpload} disabled={loading} className="upload-button">
            {loading ? <><FaSpinner className="spinner" /> {t('Analyzuji…')}</> : t('Spustit analýzu')}
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
              { key: 'wind' as TabKey, label: t('Vítr'), icon: <FaWind /> },
              { key: 'temperature' as TabKey, label: t('Teplota'), icon: <FaThermometerHalf /> },
              { key: 'sunpath' as TabKey, label: t('Sluneční dráha'), icon: <FaCompass /> },
            ]).map(tab => (
              <button key={tab.key}
                className={`sa-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => tab.key === 'wind' ? setActiveTab('wind') : loadTab(tab.key)}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="sa-tab-body">
            {tabLoading && (
              <div className="sa-tab-loading"><FaSpinner className="spinner" /> {t('Načítám data…')}</div>
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

export default EpwAnalysis;