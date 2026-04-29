/**
 * Výkon TČ — jen 2 dlaždice (dodané teplo + SCOP), bez sub textů.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedHpPerformance.tsx
 */
import React from 'react';
import type { HpPerformance } from './pedTypes';

interface Props {
  data: HpPerformance;
}

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

const PedHpPerformance: React.FC<Props> = ({ data }) => (
  <div className="ped-hp-perf">
    <div className="ped-hp-grid">
      <Tile
        label="Dodané teplo do zón"
        value={`${fmt(data.heat_delivered_kwh)} kWh`}
      />
      <Tile
        label="SCOP (sezónní)"
        value={data.scop.toFixed(2)}
      />
    </div>
  </div>
);

interface TileProps {
  label: string;
  value: string;
}

const Tile: React.FC<TileProps> = ({ label, value }) => (
  <div className="ped-hp-tile">
    <div className="ped-hp-tile-label">{label}</div>
    <div className="ped-hp-tile-value">{value}</div>
  </div>
);

export default PedHpPerformance;