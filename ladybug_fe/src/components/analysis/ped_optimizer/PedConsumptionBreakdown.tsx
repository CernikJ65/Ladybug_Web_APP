/**
 * Rozpis roční spotřeby budovy — zjednodušený rozpad pro uživatele.
 *
 * Pro variantu s TČ:
 *   "Spotřeba TČ" = kompresor + ventilátory + čerpadla + odvod tepla
 *   (sloučení Heating + Fans + Pumps + HeatRejection meterů)
 *
 * Pro panels_only variantu:
 *   "El. vytápění" = tepelná potřeba budovy přímým el. ohřevem (COP=1)
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedConsumptionBreakdown.tsx
 */
import React from 'react';
import type { ConsumptionBreakdown } from './pedTypes';
import { useT } from '../../../i18n/useT';

interface Props {
  data: ConsumptionBreakdown;
  hasHeatPump: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

interface RowDef {
  label: string;
  value: number;
}

const PedConsumptionBreakdown: React.FC<Props> = ({
  data, hasHeatPump,
}) => {
  const t = useT();
  const buildRows = (): RowDef[] => {
    if (hasHeatPump) {
      const tcTotal =
        data.heating + data.fans + data.pumps + data.heat_rejection;
      return [
        { label: t('Spotřeba TČ'), value: tcTotal },
        { label: t('HVAC chlazení'), value: data.cooling },
        { label: t('Osvětlení'), value: data.lights },
        { label: t('Spotřebiče'), value: data.equipment },
      ];
    }
    return [
      { label: t('El. vytápění'), value: data.heating },
      { label: t('Osvětlení'), value: data.lights },
      { label: t('Spotřebiče'), value: data.equipment },
    ];
  };
  const rows = buildRows();
  const visibleRows = rows.filter((r) => r.value > 0);
  return (
    <div className="ped-table-card">
      <table className="ped-table">
        <thead>
          <tr>
            <th>{t('Složka spotřeby')}</th>
            <th className="num">{t('Spotřeba (kWh)')}</th>
            <th className="num">{t('Podíl')}</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r) => {
            const pct =
              data.total > 0 ? (r.value / data.total) * 100 : 0;
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num">{fmt(r.value)}</td>
                <td className="num">
                  <span className="ped-val-pct">
                    {pct.toFixed(1)} %
                  </span>
                </td>
              </tr>
            );
          })}
          <tr className="ped-table-total">
            <td>{t('Celkem')}</td>
            <td className="num">{fmt(data.total)}</td>
            <td className="num">100 %</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default PedConsumptionBreakdown;