/**
 * Měsíční tabulka — spotřeba/výroba/bilance pro vybranou variantu.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedMonthlyTable.tsx
 */
import React from 'react';
import type { MonthRow, PedVariant } from './pedTypes';

interface Props {
  variant: PedVariant;
}

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');
const fmtS = (n: number) => (n >= 0 ? '+' : '') + fmt(n);

const PedMonthlyTable: React.FC<Props> = ({ variant }) => {
  const total =
    variant.consumption_kwh?.total
    ?? sumField(variant.monthly, 'consumption_kwh');
  const totalPv = sumField(variant.monthly, 'pv_kwh');
  const totalBal = totalPv - total;

  return (
    <div className="ped-table-card">
      <table className="ped-table">
        <thead>
          <tr>
            <th>Měsíc</th>
            <th className="num">Spotřeba (kWh)</th>
            <th className="num">Výroba FVE (kWh)</th>
            <th className="num">Bilance (kWh)</th>
          </tr>
        </thead>
        <tbody>
          {variant.monthly.map((m) => (
            <tr key={m.month}>
              <td>{m.month}</td>
              <td className="num ped-val-cons">{fmt(m.consumption_kwh)}</td>
              <td className="num ped-val-pv">{fmt(m.pv_kwh)}</td>
              <td
                className={
                  'num ' + (m.is_positive ? 'ped-val-pos' : 'ped-val-neg')
                }
              >
                {fmtS(m.balance_kwh)}
              </td>
            </tr>
          ))}
          <tr className="ped-table-total">
            <td>Rok celkem</td>
            <td className="num ped-val-cons">{fmt(total)}</td>
            <td className="num ped-val-pv">{fmt(totalPv)}</td>
            <td
              className={
                'num ' + (totalBal >= 0 ? 'ped-val-pos' : 'ped-val-neg')
              }
            >
              {fmtS(totalBal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

function sumField(rows: MonthRow[], key: keyof MonthRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

export default PedMonthlyTable;