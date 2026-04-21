import { useEffect, useRef, useState } from 'react';

export interface SimulationProgress {
  job_id: string;
  stage: string;
  percent: number;
  message: string;
  status: 'running' | 'done' | 'error';
  error?: string | null;
  updated_at?: number;
}

interface Options {
  intervalMs?: number;
  apiBase?: string;
}

/**
 * Polluje BE endpoint /api/progress/{jobId}. Když `jobId` je null,
 * hook nic nedělá. Jakmile status přejde na done/error, polling se
 * automaticky zastaví.
 */
export function useSimulationProgress(
  jobId: string | null,
  options: Options = {},
): SimulationProgress | null {
  const { intervalMs = 500, apiBase = 'http://127.0.0.1:8000' } = options;
  const [state, setState] = useState<SimulationProgress | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setState(null);
      return;
    }

    let cancelled = false;

    const stopTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const tick = async () => {
      try {
        const res = await fetch(`${apiBase}/api/progress/${jobId}`);
        if (!res.ok) return;
        const data: SimulationProgress = await res.json();
        if (cancelled) return;
        setState(data);
        if (data.status !== 'running') stopTimer();
      } catch {
        /* ignorujeme přechodné chyby sítě */
      }
    };

    tick();
    timerRef.current = setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      stopTimer();
    };
  }, [jobId, intervalMs, apiBase]);

  return state;
}
