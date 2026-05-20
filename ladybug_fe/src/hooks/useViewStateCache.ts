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
  | 'heatpump-real'
  | 'ped-optimizer';

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

  stateRef.current = state;

  const replacer = (_k: string, v: unknown): unknown => {
    if (typeof File !== 'undefined' && v instanceof File) return null;
    if (typeof Blob !== 'undefined' && v instanceof Blob) return null;
    return v;
  };

  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    const cached = getCache<T>(viewName);
    if (cached) {
      setState(cached);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasRestored.current) return;

    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
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

  useEffect(() => {
    return () => {
      if (hasRestored.current) {
        setCache(viewName, stateRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}