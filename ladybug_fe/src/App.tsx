/**
 * Hlavní App s routingem.
 * ZMĚNA: přidán 'heatpump-real' view pro celoroční simulaci TČ.
 *
 * Soubor: ladybug_fe/src/App.tsx
 */
import { useState, useEffect, useCallback, type FC } from 'react';
import { ViewCacheProvider } from './context/ViewCacheContext';
import LandingPage from './components/LandingPage';
import SolarAnalysis from './components/analysis/solar/SolarAnalysis';
import SolarAnalysisAdvanced from './components/analysis/solar/SolarAnalysisAdvanced';
import HBJSONViewerRaw from './components/analysis/Hbjsonviewer';
import HBJSONBuilderRaw from './components/analysis/builder/HbjsonBuilder';
import HeatPumpAnalysis from './components/analysis/heatpump/HeatPumpAnalysis';
import HeatPumpReal from './components/analysis/heatpump_real/HeatPumpReal';
import EnergyOptimizer from './components/analysis/combined/EnergyOptimizer';

/* Tyto komponenty nemají explicitní Props typ — přetypujeme */
const HBJSONViewer = HBJSONViewerRaw as FC<{ onBack: () => void }>;
const HBJSONBuilder = HBJSONBuilderRaw as FC<{ onBack: () => void }>;

type ViewType =
  | 'landing' | 'solar' | 'solar-advanced'
  | 'hbjson' | 'builder' | 'heatpump'
  | 'heatpump-real' | 'combined';

const hashToView: Record<string, ViewType> = {
  '': 'landing', features: 'landing', about: 'landing',
  solar: 'solar', 'solar-advanced': 'solar-advanced',
  hbjson: 'hbjson', builder: 'builder',
  heatpump: 'heatpump', 'heatpump-real': 'heatpump-real',
  combined: 'combined',
};
const viewToHash: Record<ViewType, string> = {
  landing: '', solar: 'solar', 'solar-advanced': 'solar-advanced',
  hbjson: 'hbjson', builder: 'builder',
  heatpump: 'heatpump', 'heatpump-real': 'heatpump-real',
  combined: 'combined',
};
const viewTitles: Record<ViewType, { cs: string; en: string }> = {
  landing:          { cs: 'Ladybug Web',                                en: 'Ladybug Web' },
  solar:            { cs: 'Analýza EPW – Ladybug Web',                  en: 'EPW Analysis – Ladybug Web' },
  'solar-advanced': { cs: 'Pokročilá solární analýza – Ladybug Web',    en: 'Advanced Solar Analysis – Ladybug Web' },
  hbjson:           { cs: '3D Vizualizace – Ladybug Web',               en: '3D Visualization – Ladybug Web' },
  builder:          { cs: 'HBJSON Builder – Ladybug Web',               en: 'HBJSON Builder – Ladybug Web' },
  heatpump:         { cs: 'Tepelná čerpadla – Ladybug Web',             en: 'Heat Pumps – Ladybug Web' },
  'heatpump-real':  { cs: 'Celoroční simulace TČ – Ladybug Web',       en: 'Year-Round HP Simulation – Ladybug Web' },
  combined:         { cs: 'Energetický optimalizátor – Ladybug Web',    en: 'Energy Optimizer – Ladybug Web' },
};

function getHash(): string {
  return window.location.hash.replace('#', '');
}

function App() {
  const [currentView, setCurrentView] = useState<ViewType>(() =>
    hashToView[getHash()] ?? 'landing',
  );
  const getLang = (): 'cs' | 'en' => {
    try {
      const s = localStorage.getItem('i18nextLng');
      return s === 'en' ? 'en' : 'cs';
    } catch {
      return 'cs';
    }
  };
  const updateTitle = useCallback((v: ViewType) => {
    document.title = viewTitles[v][getLang()];
  }, []);

  useEffect(() => {
    const h = () => {
      const hash = getHash();
      const view = hashToView[hash] ?? 'landing';
      setCurrentView(view);
      updateTitle(view);
      if (
        view === 'landing' &&
        (hash === 'features' || hash === 'about')
      )
        setTimeout(
          () =>
            document
              .getElementById(hash)
              ?.scrollIntoView({ behavior: 'smooth' }),
          100,
        );
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, [updateTitle]);

  useEffect(() => {
    const hash = viewToHash[currentView];
    const cur = getHash();
    if (currentView !== 'landing') {
      if (cur !== hash) window.location.hash = hash;
    } else if (!['', 'features', 'about'].includes(cur)) {
      window.history.pushState(
        null, '', window.location.pathname,
      );
    }
    updateTitle(currentView);
  }, [currentView, updateTitle]);

  useEffect(() => {
    const h = () => updateTitle(currentView);
    window.addEventListener('storage', h);
    const i = setInterval(
      () => updateTitle(currentView), 1000,
    );
    return () => {
      window.removeEventListener('storage', h);
      clearInterval(i);
    };
  }, [currentView, updateTitle]);

  useEffect(() => {
    const hash = getHash();
    if (hash === 'features' || hash === 'about')
      setTimeout(
        () =>
          document
            .getElementById(hash)
            ?.scrollIntoView({ behavior: 'smooth' }),
        200,
      );
    updateTitle(currentView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFeatureClick = (id: string) => {
    switch (id) {
      case 'solar':
        setCurrentView('solar');
        break;
      case 'solar-advanced':
        setCurrentView('solar-advanced');
        break;
      case 'heatpump':
        setCurrentView('heatpump');
        break;
      case 'heatpump-real':
        setCurrentView('heatpump-real');
        break;
      case 'combined':
        setCurrentView('combined');
        break;
      case 'hbjson':
      case 'energy':
      case 'climate':
        setCurrentView('hbjson');
        break;
      case 'parametric':
      case 'wind':
        setCurrentView('builder');
        break;
      default:
        alert(`Funkce "${id}" bude brzy dostupná!`);
    }
  };
  const back = () => setCurrentView('landing');

  return (
    <ViewCacheProvider>
      {currentView === 'solar' && (
        <SolarAnalysis onBack={back} />
      )}
      {currentView === 'solar-advanced' && (
        <SolarAnalysisAdvanced onBack={back} />
      )}
      {currentView === 'hbjson' && (
        <HBJSONViewer onBack={back} />
      )}
      {currentView === 'builder' && (
        <HBJSONBuilder onBack={back} />
      )}
      {currentView === 'heatpump' && (
        <HeatPumpAnalysis onBack={back} />
      )}
      {currentView === 'heatpump-real' && (
        <HeatPumpReal onBack={back} />
      )}
      {currentView === 'combined' && (
        <EnergyOptimizer onBack={back} />
      )}
      {currentView === 'landing' && (
        <LandingPage onFeatureClick={handleFeatureClick} />
      )}
    </ViewCacheProvider>
  );
}
export default App;