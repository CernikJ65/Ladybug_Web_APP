/**
 * Rozpad elektřiny po end-use meterech — Apple-style.
 *
 * Horizontální stacked bar pro okamžitý přehled poměrů,
 * pod ním minimalistický seznam: tečka · název · % · kWh.
 * Žádné tabulkové řádky, žádné borders — jen čistý grid.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPElectricityBreakdown.tsx
 */
import React from 'react';
import { fmt } from './hpRealUtils';

interface Props {
  breakdown: Record<string, number>;
}

const COLORS: Record<string, string> = {
  'Topení (kompresor + el. backup)': '#f59e0b',
  'Chlazení (chiller / DX)': '#38bdf8',
  'Ventilátory': '#2dd4bf',
  'Čerpadla': '#14b8a6',
  'Chladicí věž': '#94a3b8',
};

const FALLBACK = '#2dd4bf';

const HPElectricityBreakdown: React.FC<Props> = ({ breakdown }) => {
  const entries = Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (total <= 0 || entries.length === 0) return null;

  return (
    <div className="hpe-wrap">
      <div className="hpe-bar">
        {entries.map(([name, val]) => (
          <div key={name}
            className="hpe-bar-seg"
            style={{
              width: `${(val / total) * 100}%`,
              background: COLORS[name] || FALLBACK,
            }}
            title={`${name}: ${fmt(val)} kWh`} />
        ))}
      </div>
      <div className="hpe-rows">
        {entries.map(([name, val]) => (
          <div key={name} className="hpe-row">
            <span className="hpe-dot"
              style={{ background: COLORS[name] || FALLBACK }} />
            <span className="hpe-name">{name}</span>
            <span className="hpe-pct">
              {Math.round((val / total) * 100)}%
            </span>
            <span className="hpe-val">{fmt(val)} kWh</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HPElectricityBreakdown;