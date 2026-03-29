/**
 * Výsledky PED analýzy — varianty ASHP/GSHP/jen FVE.
 *
 * Každá varianta ukazuje:
 *   - FVE výroba (kWh)
 *   - TČ obnovitelné teplo (kWh) ← teplo zdarma z prostředí
 *   - TČ spotřeba elektřiny (kWh)
 *   - Elektro bilance = FVE − TČ spotřeba
 *   - PED verdikt
 *
 * Soubor: ladybug_fe/src/components/analysis/combined/EOResults.tsx
 */
import React, { useState } from 'react';
import { FaStar } from 'react-icons/fa';

/* ---------- Typy ---------- */
interface MonthRow {
  month: string;
  pv_kwh: number;
  hp_elec_kwh: number;
  hp_renewable_kwh: number;
  elec_balance_kwh: number;
  is_positive: boolean;
}

interface SystemCfg {
  hp_type: string; hp_label: string; has_hp: boolean;
  num_panels: number; hp_cost_czk: number;
  pv_cost_czk: number; total_cost_czk: number;
  remaining_czk: number;
}

interface Variant {
  system: SystemCfg;
  pv_production_kwh: number;
  hp_electricity_kwh: number;
  hp_renewable_kwh: number;
  hp_scop: number;
  total_renewable_kwh: number;
  ped_balance_kwh: number;
  is_ped: boolean;
  positive_months: number;
  monthly: MonthRow[];
}

export interface PedApiResult {
  location: string;
  room_count: number;
  heating_demand_kwh: number;
  variants: Variant[];
  best_index: number;
}

interface Props { data: PedApiResult; }

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');
const fmtS = (n: number) => (n >= 0 ? '+' : '') + fmt(n);

/* ---------- Komponenta ---------- */
const EOResults: React.FC<Props> = ({ data }) => {
  const [sel, setSel] = useState(data.best_index);
  const v = data.variants[sel];

  return (
    <div className="eo-results">
      {/* Varianty */}
      <div className="eo-variants-title">
        Porovnání variant · {data.location}
        · {data.room_count} místností
        · potřeba tepla {fmt(data.heating_demand_kwh)} kWh/rok
      </div>
      <div className="eo-variants">
        {data.variants.map((vr, i) => (
          <div key={i} onClick={() => setSel(i)}
            className={`eo-variant${i === data.best_index ? ' best' : ''}${i === sel ? ' selected' : ''}`}>
            {i === data.best_index && (
              <span className="eo-variant-badge">
                <FaStar style={{fontSize:8,marginRight:2}} /> Nejlepší PED
              </span>
            )}
            <div className="eo-variant-name">
              {vr.system.hp_label}
              {vr.system.num_panels > 0 && ` + ${vr.system.num_panels} panelů`}
            </div>
            <div className={`eo-variant-ped ${vr.is_ped ? 'pos' : 'neg'}`}>
              {fmtS(vr.ped_balance_kwh)} kWh
            </div>
            <div className="eo-variant-sub">
              elektro bilance/rok · {vr.positive_months}/12 měs. kladných
            </div>

            <div className="eo-vr">
              <span>FVE výroba</span>
              <span className="pv">{fmt(vr.pv_production_kwh)} kWh</span>
            </div>
            <div className="eo-vr">
              <span>TČ obnovitelné teplo</span>
              <span className="ren">{fmt(vr.hp_renewable_kwh)} kWh</span>
            </div>
            <div className="eo-vr">
              <span>TČ spotřeba elektřiny</span>
              <span className="hp">{fmt(vr.hp_electricity_kwh)} kWh</span>
            </div>
            {vr.hp_scop > 0 && (
              <div className="eo-vr">
                <span>SCOP</span>
                <span>{vr.hp_scop.toFixed(1)}</span>
              </div>
            )}
            <div className="eo-vr" style={{borderBottom:'none',paddingTop:'.35rem'}}>
              <span>Celkem obnovitelná</span>
              <span className="ren" style={{fontWeight:700}}>
                {fmt(vr.total_renewable_kwh)} kWh
              </span>
            </div>
            <div style={{
              marginTop:'.5rem', paddingTop:'.4rem',
              borderTop:'1px solid var(--eo-border)',
              fontSize:'.7rem', color:'var(--eo-text-muted)',
            }}>
              {vr.system.has_hp && `TČ ${fmt(vr.system.hp_cost_czk)} Kč`}
              {vr.system.has_hp && vr.system.num_panels > 0 && ' + '}
              {vr.system.num_panels > 0 && `FVE ${fmt(vr.system.pv_cost_czk)} Kč`}
              {' = '}{fmt(vr.system.total_cost_czk)} Kč
            </div>
          </div>
        ))}
      </div>

      {/* Měsíční tabulka vybrané varianty */}
      {v && (
        <>
          <div className="eo-monthly-title">
            Měsíční přehled: {v.system.hp_label}
            {v.system.num_panels > 0 && ` + ${v.system.num_panels} panelů`}
          </div>
          <div className="eo-monthly">
            <table>
              <thead>
                <tr>
                  <th>Měsíc</th>
                  <th>FVE výroba</th>
                  <th>TČ obn. teplo</th>
                  <th>TČ spotřeba el.</th>
                  <th>Elektro bilance</th>
                </tr>
              </thead>
              <tbody>
                {v.monthly.map(m => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td className="eo-val-pv">{fmt(m.pv_kwh)}</td>
                    <td className="eo-val-ren">{fmt(m.hp_renewable_kwh)}</td>
                    <td className="eo-val-hp">{fmt(m.hp_elec_kwh)}</td>
                    <td className={m.is_positive ? 'eo-val-pos' : 'eo-val-neg'}>
                      {fmtS(m.elec_balance_kwh)}
                    </td>
                  </tr>
                ))}
                <tr className="eo-total-row">
                  <td>Rok celkem</td>
                  <td className="eo-val-pv">{fmt(v.pv_production_kwh)}</td>
                  <td className="eo-val-ren">{fmt(v.hp_renewable_kwh)}</td>
                  <td className="eo-val-hp">{fmt(v.hp_electricity_kwh)}</td>
                  <td className={v.is_ped ? 'eo-val-pos' : 'eo-val-neg'}>
                    {fmtS(v.ped_balance_kwh)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default EOResults;