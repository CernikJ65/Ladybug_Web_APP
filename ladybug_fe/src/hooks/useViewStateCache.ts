/**
 * Saves component state to cache on every change AND on unmount.
 *
 * ZMĚNA: první save po mountu se přeskakuje, protože closure
 * v tom momentě drží ještě pre-restore initial state a zapsal
 * by prázdné hodnoty přes právě obnovená data (což vede k smazání
 * souborů z IDB a ztrátě výsledků z localStorage).
 *
 * Soubor: ladybug_fe/src/hooks/useViewStateCache.ts
 */
import { useEffect, useRef } from 'react';
import { useViewCache } from '../context/ViewCacheContext';

type ViewType =
  | 'solar'
  | 'solar-advanced'
  | 'hbjson'
  | 'builder'
  | 'heatpump'
  | 'heatpump-real'
  | 'combined';

/**
 * Saves component state to cache on every change and on unmount.
 * Restores state on mount (only once).
 *
 * @param viewName - unique key for this view (e.g. 'solar')
 * @param state    - current state object to cache
 * @param setState - function to restore state from cache
 *
 * Usage in your component:
 *   useViewStateCache('solar', { file, result, settings }, (cached) => {
 *     setFile(cached.file);
 *     setResult(cached.result);
 *     setSettings(cached.settings);
 *   });
 */
export function useViewStateCache<T>(
  viewName: ViewType,
  state: T,
  setState: (cached: T) => void
) {
  const { getCache, setCache } = useViewCache();
  const stateRef = useRef(state);
  const hasRestored = useRef(false);
  const isFirstSaveRef = useRef(true);
  const lastSerializedRef = useRef<string | null>(null);

  // Keep ref in sync with latest state
  stateRef.current = state;

  // JSON replacer: File/Blob → null (matches ViewCacheContext behavior)
  const replacer = (_k: string, v: unknown): unknown => {
    if (typeof File !== 'undefined' && v instanceof File) return null;
    if (typeof Blob !== 'undefined' && v instanceof Blob) return null;
    return v;
  };

  // On mount: restore from cache (only once)
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    const cached = getCache<T>(viewName);
    if (cached) {
      setState(cached);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On every state change: save to cache (persisted to localStorage + IDB).
  // Runs on every render — diff-based skip prevents redundant writes.
  //
  // CRITICAL: The very first invocation after mount is skipped, because
  // at that point the restore effect has only *scheduled* a setState
  // (render 2), while this effect's closure still holds the pre-restore
  // initial state. Writing it would overwrite the restored data with
  // blanks and delete files from IDB.
  useEffect(() => {
    if (!hasRestored.current) return;

    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
      // Seed lastSerializedRef with the current (pre-restore) initial
      // state, so the next render — which will carry the restored
      // state — triggers a proper write via the diff check.
      try {
        lastSerializedRef.current = JSON.stringify(state, replacer);
      } catch {
        lastSerializedRef.current = null;
      }
      return;
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(state, replacer);
    } catch {
      return;
    }

    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;

    setCache(viewName, state);
  });

  // On unmount: final save (safety net, in case something changed
  // after the last render but before unmount)
  useEffect(() => {
    return () => {
      if (hasRestored.current) {
        setCache(viewName, stateRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}