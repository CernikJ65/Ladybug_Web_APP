import React from 'react';
import { FaSpinner } from 'react-icons/fa';
import type { SimulationProgress } from '../../hooks/useSimulationProgress';
import './SimulationProgressOverlay.css';

interface Props {
  open: boolean;
  progress: SimulationProgress | null;
  title?: string;
}

/**
 * Sdílená overlay komponenta pro zobrazení stavu dlouho běžící simulace.
 * Floating karta v pravém dolním rohu — neblokuje UI, uživatel může dál
 * používat stránku nebo opustit záložku.
 */
const SimulationProgressOverlay: React.FC<Props> = ({
  open,
  progress,
  title = 'Simulace probíhá',
}) => {
  if (!open) return null;

  const percent = progress?.percent ?? 0;

  return (
    <div className="sim-progress-overlay" role="status" aria-live="polite">
      <div className="sim-progress-card">
        <div className="sim-progress-head">
          <FaSpinner className="sim-progress-spin" />
          <h3>{title}</h3>
          <span className="sim-progress-percent">{Math.round(percent)}%</span>
        </div>

        <div className="sim-progress-bar-wrap">
          <div
            className="sim-progress-bar-fill"
            style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default SimulationProgressOverlay;
