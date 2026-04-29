/**
 * Cache stavu jednotlivých analýz.
 *
 * Hybridní persistence:
 *   - localStorage (JSON state)  — sdíleno napříč taby přes storage event
 *   - IndexedDB (File objekty)   — ArrayBuffer + metadata rekonstrukce
 *
 * Při startu se cache asynchronně hydrátuje: nejdřív JSON z localStorage,
 * pak se soubory načtou z IDB a zamění se za markery ve stavu. Render
 * children čeká na dokončení hydratace (typicky <50 ms).
 *
 * Soubor: ladybug_fe/src/context/ViewCacheContext.tsx
 */
import {
  createContext, useContext, useRef, useCallback, useEffect, useState,
} from 'react';
import type { ReactNode } from 'react';
import { idbSaveFile, idbLoadFile, idbDeleteFile } from '../utils/viewCacheDb';

type ViewType =
  | 'solar'
  | 'solar-advanced'
  | 'hbjson'
  | 'builder'
  | 'heatpump'
  | 'heatpump-real'
  | 'ped-optimizer';

interface ViewCacheContextType {
  getCache: <T>(view: ViewType) => T | null;
  setCache: <T>(view: ViewType, state: T) => void;
}

const ViewCacheContext = createContext<ViewCacheContextType | null>(null);

const STORAGE_KEY = 'ladybug_view_cache_v2';
const FILE_MARKER = '__idbFile__';

interface FileMarker { [FILE_MARKER]: true; }

function isFileMarker(v: unknown): v is FileMarker {
  return typeof v === 'object'
    && v !== null
    && (v as Record<string, unknown>)[FILE_MARKER] === true;
}

/* ---------- Extrakce a hydratace File objektů ---------- */

/** Projde top-level klíče state objektu, extrahuje File instance
 *  a nahradí je markery. Vrací stripped state a mapu souborů. */
function extractFiles(
  state: unknown,
): { stripped: unknown; files: Record<string, File> } {
  if (typeof state !== 'object' || state === null) {
    return { stripped: state, files: {} };
  }
  const files: Record<string, File> = {};
  const stripped: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(state as Record<string, unknown>)) {
    if (typeof File !== 'undefined' && val instanceof File) {
      files[key] = val;
      stripped[key] = { [FILE_MARKER]: true };
    } else {
      stripped[key] = val;
    }
  }
  return { stripped, files };
}

/** Projde stripped state, najde markery a nahradí je skutečnými
 *  File objekty načtenými z IndexedDB. */
async function hydrateFiles(viewName: string, state: unknown): Promise<unknown> {
  if (typeof state !== 'object' || state === null) return state;
  const result: Record<string, unknown> = { ...(state as Record<string, unknown>) };
  for (const [key, val] of Object.entries(result)) {
    if (isFileMarker(val)) {
      const file = await idbLoadFile(`${viewName}:${key}`);
      result[key] = file;
    }
  }
  return result;
}

/* ---------- localStorage helpery ---------- */

function loadFromStorage(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, unknown>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded nebo jiná chyba — tiše ignorujeme */
  }
}

/* ---------- Provider ---------- */

export const ViewCacheProvider = ({ children }: { children: ReactNode }) => {
  const cacheRef = useRef<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);

  /* Úvodní async hydratace: localStorage JSON + IDB soubory */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = loadFromStorage();
        const hydrated: Record<string, unknown> = {};
        for (const [view, state] of Object.entries(raw)) {
          hydrated[view] = await hydrateFiles(view, state);
        }
        if (!cancelled) {
          cacheRef.current = hydrated;
        }
      } catch (e) {
        console.warn('[ViewCache] hydration failed:', e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Cross-tab sync: když jiný tab zapíše, přerebuildujeme cache.
   * Aktuálně mountnuté komponenty se neupdatují živě (potřebovaly by
   * znovuotevření záložky) — pro potřeby této app je to ok. */
  useEffect(() => {
    const handler = async (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const raw = e.newValue ? JSON.parse(e.newValue) : {};
        const hydrated: Record<string, unknown> = {};
        for (const [view, state] of Object.entries(raw)) {
          hydrated[view] = await hydrateFiles(view, state);
        }
        cacheRef.current = hydrated;
      } catch (err) {
        console.warn('[ViewCache] storage sync failed:', err);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const getCache = useCallback(<T,>(view: ViewType): T | null => {
    return (cacheRef.current[view] as T) ?? null;
  }, []);

  const setCache = useCallback(<T,>(view: ViewType, state: T) => {
    /* Předchozí stav uchováme, ať víme, které soubory smazat z IDB. */
    const prevState = cacheRef.current[view];

    /* V paměti držíme originál i s File objekty (ať je hooky vidí). */
    cacheRef.current[view] = state;

    /* Pro localStorage vytvoříme stripped verzi celé cache. */
    const allStripped: Record<string, unknown> = {};
    for (const [v, s] of Object.entries(cacheRef.current)) {
      allStripped[v] = extractFiles(s).stripped;
    }
    saveToStorage(allStripped);

    /* Async zápis souborů do IDB + úklid starých. */
    void (async () => {
      const { files } = extractFiles(state);
      const prevFiles = prevState ? extractFiles(prevState).files : {};

      /* Ulož nové/aktualizované soubory. */
      for (const [key, file] of Object.entries(files)) {
        await idbSaveFile(`${view}:${key}`, file);
      }

      /* Smaž soubory, které ve stavu byly a už nejsou. */
      for (const key of Object.keys(prevFiles)) {
        if (!(key in files)) {
          await idbDeleteFile(`${view}:${key}`);
        }
      }
    })();
  }, []);

  /* Čekání na dokončení hydratace — krátký flash bez loaderu.
   * Když hydratace spadne, `ready` se stejně nastaví přes finally. */
  if (!ready) return null;

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