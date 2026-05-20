/**
 * Hlavní App s routingem.
 * ZMĚNA: přidán 'converter' view pro DWG/DXF → HBJSON.
 *
 * Soubor: ladybug_fe/src/App.tsx
 */
import { useState, useEffect, useCallback, lazy, Suspense, type FC } from 'react';
import { ViewCacheProvider } from './context/ViewCacheContext';
import { SharedFilesProvider } from './context/SharedFilesContext';
import LandingPage from './components/LandingPage';
import { useT } from './i18n/useT';

type BackProps = { onBack: () => void };

const EpwAnalysis = lazy(() => import('./components/analysis/epw/EpwAnalysis'));
const SolarAnalysisAdvanced = lazy(() => import('./components/analysis/solar/SolarAnalysisAdvanced'));
const HBJSONViewer = lazy(async () => {
  const m = await import('./components/analysis/hbjson_visualization/Hbjsonviewer');
  return { default: m.default as FC<BackProps> };
});
const HeatPumpReal = lazy(() => import('./components/analysis/heatpump_real/HeatPumpReal'));
const PedOptimizer = lazy(() => import('./components/analysis/ped_optimizer/PedOptimizer'));
const DwgConverter = lazy(() => import('./components/analysis/converter/DwgConverter'));
const SampleData = lazy(() => import('./components/sample_data/SampleData'));

const RouteFallback: FC = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: '#0c1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        border: '3px solid rgba(240, 165, 0, 0.18)',
        borderTopColor: '#f0a500',
        borderRadius: '50%',
        animation: 'rf-spin 0.8s linear infinite',
      }}
    />
    <style>{`@keyframes rf-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

type ViewType =
  | 'landing' | 'solar' | 'solar-advanced'
  | 'hbjson'
  | 'heatpump-real' | 'ped-optimizer' | 'converter'
  | 'samples';

const hashToView: Record<string, ViewType> = {
  '': 'landing', features: 'landing', about: 'landing',
  solar: 'solar', 'solar-advanced': 'solar-advanced',
  hbjson: 'hbjson',
  'heatpump-real': 'heatpump-real',
  'ped-optimizer': 'ped-optimizer', converter: 'converter',
  samples: 'samples',
};
const viewToHash: Record<ViewType, string> = {
  landing: '', solar: 'solar', 'solar-advanced': 'solar-advanced',
  hbjson: 'hbjson',
  'heatpump-real': 'heatpump-real',
  'ped-optimizer': 'ped-optimizer', converter: 'converter',
  samples: 'samples',
};
const viewTitles: Record<ViewType, { cs: string; en: string }> = {
  landing:          { cs: 'PED Ladybug Web Tools',                                en: 'PED Ladybug Web Tools' },
  solar:            { cs: 'Analýza EPW – PED Ladybug Web Tools',                  en: 'EPW Analysis – PED Ladybug Web Tools' },
  'solar-advanced': { cs: 'Pokročilá solární analýza – PED Ladybug Web Tools',    en: 'Advanced Solar Analysis – PED Ladybug Web Tools' },
  hbjson:           { cs: '3D Vizualizace – PED Ladybug Web Tools',               en: '3D Visualization – PED Ladybug Web Tools' },
  'heatpump-real':  { cs: 'Celoroční simulace TČ – PED Ladybug Web Tools',       en: 'Year-Round HP Simulation – PED Ladybug Web Tools' },
  'ped-optimizer':  { cs: 'PED optimalizátor – PED Ladybug Web Tools',            en: 'PED Optimizer – PED Ladybug Web Tools' },
  converter:        { cs: 'CAD Konvertor – PED Ladybug Web Tools',                en: 'CAD Converter – PED Ladybug Web Tools' },
  samples:          { cs: 'Ukázková data – PED Ladybug Web Tools',                en: 'Sample Data – PED Ladybug Web Tools' },
};

function getHash(): string {
  return window.location.hash.replace('#', '');
}

function App() {
  const t = useT();
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
      case 'heatpump-real':
        setCurrentView('heatpump-real');
        break;
      case 'ped-optimizer':
      case 'combined':
        setCurrentView('ped-optimizer');
        break;
      case 'converter':
        setCurrentView('converter');
        break;
      case 'hbjson':
      case 'energy':
      case 'climate':
        setCurrentView('hbjson');
        break;
      case 'samples':
        setCurrentView('samples');
        break;
      default:
        alert(t('Funkce "{{id}}" bude brzy dostupná!', { id }));
    }
  };
  const back = () => setCurrentView('landing');

  return (
    <ViewCacheProvider>
      <SharedFilesProvider>
        {currentView === 'landing' && (
          <LandingPage onFeatureClick={handleFeatureClick} />
        )}
        {currentView !== 'landing' && (
          <Suspense fallback={<RouteFallback />}>
            {currentView === 'solar' && <EpwAnalysis onBack={back} />}
            {currentView === 'solar-advanced' && <SolarAnalysisAdvanced onBack={back} />}
            {currentView === 'hbjson' && <HBJSONViewer onBack={back} />}
            {currentView === 'heatpump-real' && <HeatPumpReal onBack={back} />}
            {currentView === 'ped-optimizer' && <PedOptimizer onBack={back} />}
            {currentView === 'converter' && <DwgConverter onBack={back} />}
            {currentView === 'samples' && <SampleData onBack={back} />}
          </Suspense>
        )}
      </SharedFilesProvider>
    </ViewCacheProvider>
  );
}
export default App;