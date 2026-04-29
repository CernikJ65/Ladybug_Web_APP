/**
 * Rozpis rocni spotreby budovy — HVAC + lights + equipment + aux.
 * Skryva nulove polozky aby UI neukazovalo "Cooling 0", "HeatRej 0" atd.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedConsumptionBreakdown.tsx
 */
import React from 'react';
import type { ConsumptionBreakdown } from './pedTypes';

interface Props {
  data: ConsumptionBreakdown;
}

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

const ROWS: Array<{ key: keyof ConsumptionBreakdown; label: string }> = [
  { key: 'heating',        label: 'HVAC topení' },
  { key: 'cooling',        label: 'HVAC chlazení' },
  { key: 'fans',           label: 'Ventilátory' },
  { key: 'pumps',          label: 'Čerpadla' },
  { key: 'heat_rejection', label: 'Odvod tepla' },
  { key: 'lights',         label: 'Osvětlení' },
  { key: 'equipment',      label: 'Spotřebiče (zásuvky)' },
];

const PedConsumptionBreakdown: React.FC<Props> = ({ data }) => {
  const visibleRows = ROWS.filter((r) => data[r.key] > 0);
  return (
    <div className="ped-breakdown">
      <table>
        <thead>
          <tr>
            <th>Složka</th>
            <th className="num">Spotřeba (kWh)</th>
            <th className="num">Podíl</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r) => {
            const pct =
              data.total > 0 ? (data[r.key] / data.total) * 100 : 0;
            return (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="num">{fmt(data[r.key])}</td>
                <td className="num">{pct.toFixed(1)} %</td>
              </tr>
            );
          })}
          <tr className="ped-breakdown-total">
            <td>Celkem</td>
            <td className="num">{fmt(data.total)}</td>
            <td className="num">100 %</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default PedConsumptionBreakdown;
