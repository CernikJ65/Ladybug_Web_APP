import { useState, useEffect, useCallback } from 'react';
import { ViewCacheProvider } from './context/ViewCacheContext';
import LandingPage from './components/LandingPage';
import SolarAnalysis from './components/analysis/SolarAnalysis';
import SolarAnalysisAdvanced from './components/analysis/solar/SolarAnalysisAdvanced';
import HBJSONViewer from './components/analysis/Hbjsonviewer';
import HBJSONBuilder from './components/analysis/builder/HbjsonBuilder';

type ViewType = 'landing' | 'solar' | 'solar-advanced' | 'hbjson' | 'builder';

// Hash → ViewType mapping
const hashToView: Record<string, ViewType> = {
  '': 'landing',
  'features': 'landing',
  'about': 'landing',
  'solar': 'solar',
  'solar-advanced': 'solar-advanced',
  'hbjson': 'hbjson',
  'builder': 'builder',
};

// ViewType → hash mapping (canonical URL per view)
const viewToHash: Record<ViewType, string> = {
  landing: '',
  solar: 'solar',
  'solar-advanced': 'solar-advanced',
  hbjson: 'hbjson',
  builder: 'builder',
};

// Titles per view
const viewTitles: Record<ViewType, { cs: string; en: string }> = {
  landing: { cs: 'Ladybug Web', en: 'Ladybug Web' },
  solar: { cs: 'Analýza EPW – Ladybug Web', en: 'EPW Analysis – Ladybug Web' },
  'solar-advanced': { cs: 'Pokročilá solární analýza – Ladybug Web', en: 'Advanced Solar Analysis – Ladybug Web' },
  hbjson: { cs: '3D Vizualizace – Ladybug Web', en: '3D Visualization – Ladybug Web' },
  builder: { cs: 'HBJSON Builder – Ladybug Web', en: 'HBJSON Builder – Ladybug Web' },
};

function getHash(): string {
  return window.location.hash.replace('#', '');
}

function App() {
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const hash = getHash();
    return hashToView[hash] ?? 'landing';
  });

  const getLang = (): 'cs' | 'en' => {
    try {
      const stored = localStorage.getItem('i18nextLng');
      return stored === 'en' ? 'en' : 'cs';
    } catch {
      return 'cs';
    }
  };

  const updateTitle = useCallback((view: ViewType) => {
    const lang = getLang();
    document.title = viewTitles[view][lang];
  }, []);

  // Sync hash → view (handles browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = getHash();
      const view = hashToView[hash] ?? 'landing';
      setCurrentView(view);
      updateTitle(view);

      if (view === 'landing' && (hash === 'features' || hash === 'about')) {
        setTimeout(() => {
          const element = document.getElementById(hash);
          if (element) element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [updateTitle]);

  // Sync view → hash + title
  useEffect(() => {
    const hash = viewToHash[currentView];
    const currentHash = getHash();

    if (currentView !== 'landing') {
      if (currentHash !== hash) {
        window.location.hash = hash;
      }
    } else if (!['', 'features', 'about'].includes(currentHash)) {
      window.history.pushState(null, '', window.location.pathname);
    }

    updateTitle(currentView);
  }, [currentView, updateTitle]);

  // Update title on language change
  useEffect(() => {
    const handleStorage = () => updateTitle(currentView);
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(() => updateTitle(currentView), 1000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [currentView, updateTitle]);

  // On initial load: scroll to landing sub-section if needed
  useEffect(() => {
    const hash = getHash();
    if (hash === 'features' || hash === 'about') {
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }
    updateTitle(currentView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFeatureClick = (featureId: string) => {
    switch (featureId) {
      case 'solar':
        setCurrentView('solar');
        break;
      case 'solar-advanced':
        setCurrentView('solar-advanced');
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
        alert(`Funkce "${featureId}" bude brzy dostupná!`);
    }
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
  };

  return (
    <ViewCacheProvider>
      {currentView === 'solar' && <SolarAnalysis onBack={handleBackToLanding} />}
      {currentView === 'solar-advanced' && <SolarAnalysisAdvanced onBack={handleBackToLanding} />}
      {currentView === 'hbjson' && <HBJSONViewer onBack={handleBackToLanding} />}
      {currentView === 'builder' && <HBJSONBuilder onBack={handleBackToLanding} />}
      {currentView === 'landing' && <LandingPage onFeatureClick={handleFeatureClick} />}
    </ViewCacheProvider>
  );
}

export default App;