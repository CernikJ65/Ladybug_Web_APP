import { useEffect, useRef } from 'react';
import { useViewCache } from '../context/ViewCacheContext';

type ViewType = 'solar' | 'solar-advanced' | 'hbjson' | 'builder';

/**
 * Saves component state to cache on unmount, restores it on mount.
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

  // Keep ref in sync with latest state
  stateRef.current = state;

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

  // On unmount: save current state to cache
  useEffect(() => {
    return () => {
      setCache(viewName, stateRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}