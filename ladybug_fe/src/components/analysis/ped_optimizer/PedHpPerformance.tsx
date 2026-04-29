/**
 * Vykonove parametry tepelneho cerpadla — SCOP, dodane teplo,
 * teplo ziskane z prostredi. Zobrazuje se jen pro ASHP/GSHP variantu.
 *
 * SCOP definice: heat_delivered / (heating + fans + pumps + heat_rej).
 * Stejna definice jako v samostatne celorocni simulaci TC (heatpump_real).
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedHpPerformance.tsx
 */
import React from 'react';
import {
  FaSnowflake, FaBolt, FaLeaf, FaTachometerAlt,
} from 'react-icons/fa';
import type { HpPerformance } from './pedTypes';

interface Props {
  data: HpPerformance;
  hpLabel: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

const PedHpPerformance: React.FC<Props> = ({ data, hpLabel }) => {
  const coverage =
    data.heat_delivered_kwh > 0
      ? (data.free_heat_kwh / data.heat_delivered_kwh) * 100
      : 0;

  return (
    <div className="ped-hp-perf">
      <div className="ped-hp-perf-title">
        Výkon tepelného čerpadla — {hpLabel}
      </div>
      <div className="ped-hp-perf-grid">
        <Tile
          icon={<FaSnowflake />} color="#fbbf24"
          label="Dodané teplo do zón"
          value={`${fmt(data.heat_delivered_kwh)} kWh`}
          sub={
            data.heat_demand_per_m2_kwh > 0
              ? `${data.heat_demand_per_m2_kwh.toFixed(1)} kWh/m²/rok`
              : 'tepelná potřeba budovy'
          }
        />
        <Tile
          icon={<FaBolt />} color="#60a5fa"
          label="Spotřeba el. systému"
          value={`${fmt(data.system_electricity_kwh)} kWh`}
          sub={`topení ${fmt(data.heating_electricity_kwh)} + aux`}
        />
        <Tile
          icon={<FaLeaf />} color="#10b981"
          label="Teplo z prostředí"
          value={`${fmt(data.free_heat_kwh)} kWh`}
          sub={`${coverage.toFixed(0)} % dodávky zdarma`}
        />
        <Tile
          icon={<FaTachometerAlt />} color="#a78bfa"
          label="SCOP (sezónní)"
          value={data.scop.toFixed(2)}
          sub="vč. ventilátorů + čerpadel"
        />
      </div>
    </div>
  );
};

interface TileProps {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  sub: string;
}

const Tile: React.FC<TileProps> = ({ icon, color, label, value, sub }) => (
  <div className="ped-hp-tile">
    <div className="ped-hp-tile-icon" style={{ color }}>{icon}</div>
    <div className="ped-hp-tile-body">
      <div className="ped-hp-tile-label">{label}</div>
      <div className="ped-hp-tile-value">{value}</div>
      <div className="ped-hp-tile-sub">{sub}</div>
    </div>
  </div>
);

export default PedHpPerformance;
