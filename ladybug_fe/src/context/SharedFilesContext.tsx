import {
  createContext, useContext, useRef, useCallback, useEffect, useState,
} from 'react';
import type { ReactNode } from 'react';
import { idbSaveFile, idbLoadFile, idbDeleteFile } from '../utils/viewCacheDb';

const SHARED_HBJSON_KEY = '__shared__:hbjson';
const SHARED_EPW_KEY = '__shared__:epw';

interface SharedFilesCtx {
  getHbjson: () => File | null;
  getEpw: () => File | null;
  setHbjson: (f: File | null) => void;
  setEpw: (f: File | null) => void;
}

const SharedFilesContext = createContext<SharedFilesCtx | null>(null);

export const SharedFilesProvider = ({ children }: { children: ReactNode }) => {
  const hbjsonRef = useRef<File | null>(null);
  const epwRef = useRef<File | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [hb, ep] = await Promise.all([
          idbLoadFile(SHARED_HBJSON_KEY),
          idbLoadFile(SHARED_EPW_KEY),
        ]);
        if (cancelled) return;
        hbjsonRef.current = hb;
        epwRef.current = ep;
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getHbjson = useCallback(() => hbjsonRef.current, []);
  const getEpw = useCallback(() => epwRef.current, []);

  const setHbjson = useCallback((f: File | null) => {
    hbjsonRef.current = f;
    if (f) void idbSaveFile(SHARED_HBJSON_KEY, f);
    else void idbDeleteFile(SHARED_HBJSON_KEY);
  }, []);

  const setEpw = useCallback((f: File | null) => {
    epwRef.current = f;
    if (f) void idbSaveFile(SHARED_EPW_KEY, f);
    else void idbDeleteFile(SHARED_EPW_KEY);
  }, []);

  if (!ready) return null;

  return (
    <SharedFilesContext.Provider value={{ getHbjson, getEpw, setHbjson, setEpw }}>
      {children}
    </SharedFilesContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSharedFiles = () => {
  const ctx = useContext(SharedFilesContext);
  if (!ctx) throw new Error('useSharedFiles must be used inside SharedFilesProvider');
  return ctx;
};
