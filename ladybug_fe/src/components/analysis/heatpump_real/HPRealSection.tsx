/**
 * Detailní výsledky jednoho HVAC systému (VRF nebo WSHP).
 *
 * Duo karty: vytápění / chlazení / obnovitelné / elektřina.
 * Měsíční sloupcový graf, COP strip, ekonomika.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealSection.tsx
 */
import React from 'react';
import {
  FaSun, FaSnowflake,
  FaWind, FaMountain,
} from 'react-icons/fa';
import type { HPSystemResult } from './hpRealUtils';
import { fmt } from './hpRealUtils';

interface Props {
  data: HPSystemResult;
  color: 'vrf' | 'wshp';
}

const MO = [
  'Led','Úno','Bře','Dub','Kvě','Čvn',
  'Čvc','Srp','Zář','Říj','Lis','Pro',
];

const HPRealSection: React.FC<Props> = ({ data, color }) => {
  const m = data.energy_metrics;
  const isVrf = color === 'vrf';
  const maxBar = Math.max(
    ...data.monthly_heating_kwh,
    ...data.monthly_cooling_kwh, 1,
  );

  return (
    <section className="hp-card">
      <div className="hp-card-head">
        {isVrf
          ? <FaWind className="hp-card-icon" />
          : <FaMountain className="hp-card-icon" />}
        <div>
          <h2>{data.label}</h2>
          <p className="hp-card-sub">
            ASHRAE 2019 · COP {data.annual_cop}
          </p>
        </div>
      </div>

      {/* ── Duo karty ── */}
      <div className="hp-duo">
        <DuoCard
          pill={<><FaSun /> Vytápění</>}
          from="tepelná potřeba"
          value={data.annual_heating_kwh}
          note="Teplo dodané HVAC do budovy"
          accent="produced" />
        <DuoCard
          pill={<><FaSnowflake /> Chlazení</>}
          from="chladicí potřeba"
          value={data.annual_cooling_kwh}
          note="Chlad dodaný HVAC do budovy"
          accent="consumed" />
      </div>

      {/* ── KPI ── */}
      <div className="hp-kpi-row">
        <div className="hp-kpi">
          <span className="hp-kpi-val">
            {fmt(data.annual_renewable_kwh)}
          </span>
          <span className="hp-kpi-lbl">OZE kWh/rok</span>
        </div>
        <div className="hp-kpi">
          <span className="hp-kpi-val">
            {fmt(data.annual_electricity_kwh)}
          </span>
          <span className="hp-kpi-lbl">Elektřina kWh</span>
        </div>
        <div className="hp-kpi">
          <span className="hp-kpi-val">{data.annual_cop}</span>
          <span className="hp-kpi-lbl">COP celoroční</span>
        </div>
      </div>

      <div className="hp-context">
        Obnovitelná energie = dodané teplo + chlad − elektřina.
        Z {fmt(data.annual_heating_kwh + data.annual_cooling_kwh)} kWh
        celkové potřeby TČ spotřebuje
        jen {fmt(data.annual_electricity_kwh)} kWh
        elektřiny — {fmt(data.annual_renewable_kwh)} kWh pochází
        z prostředí zdarma.
      </div>

      {/* ── Měsíční výkon ── */}
      <h3 className="hp-sub-title">Měsíční vytápění a chlazení</h3>
      <div className="hpr-stacked-bars">
        {MO.map((mo, i) => {
          const h = data.monthly_heating_kwh[i];
          const c = data.monthly_cooling_kwh[i];
          const hPct = (h / maxBar) * 100;
          const cPct = (c / maxBar) * 100;
          return (
            <div key={i} className="hpr-bar-col">
              <div className="hpr-bar-stack">
                <div className="hpr-bar-heat"
                  style={{ height: `${hPct}%` }}
                  title={`${mo}: ${fmt(h)} kWh vytáp.`} />
                <div className="hpr-bar-cool"
                  style={{ height: `${cPct}%` }}
                  title={`${mo}: ${fmt(c)} kWh chlaz.`} />
              </div>
              <span className="hp-bar-lbl">{mo}</span>
            </div>
          );
        })}
      </div>
      <div className="hpr-legend">
        <span className="hpr-leg-heat">Vytápění</span>
        <span className="hpr-leg-cool">Chlazení</span>
      </div>

      {/* ── Měsíční COP ── */}
      <h3 className="hp-sub-title">Měsíční COP</h3>
      <div className="hp-cop-strip">
        {data.monthly_cop.map((c, i) => (
          <div key={i} className="hp-cop-chip">
            <span className="hp-cop-v">{c.toFixed(1)}</span>
            <span className="hp-cop-m">{MO[i]}</span>
          </div>
        ))}
      </div>

      {/* ── Ekonomika ── */}
      <h3 className="hp-sub-title">Ekonomika</h3>
      <div className="hp-kpi-row">
        <div className="hp-kpi">
          <span className="hp-kpi-val">{fmt(m.annual_cost_czk)}</span>
          <span className="hp-kpi-lbl">Náklady CZK/rok</span>
        </div>
        <div className="hp-kpi">
          <span className="hp-kpi-val">{fmt(m.savings_czk)}</span>
          <span className="hp-kpi-lbl">Úspora vs přímotop</span>
        </div>
        <div className="hp-kpi">
          <span className="hp-kpi-val">{fmt(m.co2_savings_kg)} kg</span>
          <span className="hp-kpi-lbl">Úspora CO₂</span>
        </div>
      </div>
    </section>
  );
};

/* ── Duo karta ── */

const DuoCard: React.FC<{
  pill: React.ReactNode; from: string;
  value: number; note: string; accent: string;
}> = ({ pill, from, value, note, accent }) => (
  <div className={`hp-duo-card duo-${accent}`}>
    <div className="hp-duo-head">
      <span className={`hp-duo-pill ${accent === 'consumed' ? 'consumed' : ''}`}>
        {pill}
      </span>
      <span className="hp-duo-from">{from}</span>
    </div>
    <div className="hp-duo-big">{fmt(value)}</div>
    <span className="hp-duo-unit">kWh / rok</span>
    <p className="hp-duo-note">{note}</p>
  </div>
);

export default HPRealSection;