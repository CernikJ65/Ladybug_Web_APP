import { createContext, useContext, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';

type ViewType =
  | 'solar'
  | 'solar-advanced'
  | 'hbjson'
  | 'builder'
  | 'heatpump'
  | 'heatpump-real'
  | 'combined';

interface ViewCacheContextType {
  getCache: <T>(view: ViewType) => T | null;
  setCache: <T>(view: ViewType, state: T) => void;
}

const ViewCacheContext = createContext<ViewCacheContextType | null>(null);

export const ViewCacheProvider = ({ children }: { children: ReactNode }) => {
  const cacheRef = useRef<Record<string, unknown>>({});

  const getCache = useCallback(<T,>(view: ViewType): T | null => {
    return (cacheRef.current[view] as T) ?? null;
  }, []);

  const setCache = useCallback(<T,>(view: ViewType, state: T) => {
    cacheRef.current[view] = state;
  }, []);

  return (
    <ViewCacheContext.Provider value={{ getCache, setCache }}>
      {children}
    </ViewCacheContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useViewCache = () => {
  const context = useContext(ViewCacheContext);
  if (!context) throw new Error('useViewCache must be used inside ViewCacheProvider');
  return context;
};