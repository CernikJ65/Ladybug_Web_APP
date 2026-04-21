/**
 * Karta "Tepelná potřeba budovy" — kolik tepla a chladu
 * budova potřebuje dodat ze zdroje, aby držela setpointy.
 *
 * Je to to, co musí tepelné čerpadlo (oba varianty) vyrobit.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealDemand.tsx
 */
import React from 'react';
import { FaFire, FaSnowflake, FaBuilding } from 'react-icons/fa';
import type { BuildingDemand } from './hpRealUtils';
import { fmt } from './hpRealUtils';

interface Props {
  demand: BuildingDemand;
  area: number;
  heatingOnly?: boolean;
}

const MO = [
  'Led','Úno','Bře','Dub','Kvě','Čvn',
  'Čvc','Srp','Zář','Říj','Lis','Pro',
];

const HPRealDemand: React.FC<Props> = ({
  demand, area, heatingOnly = false,
}) => {
  const maxBar = Math.max(
    ...demand.monthly_heating_kwh,
    ...(heatingOnly ? [] : demand.monthly_cooling_kwh), 1,
  );

  return (
    <section className="hp-card">
      <div className="hp-card-head">
        <FaBuilding className="hp-card-icon" />
        <div>
          <h2>Tepelná potřeba budovy</h2>
          <p className="hp-card-sub">
            Co musí HVAC dodat do zón — stejné pro ASHP i GSHP,
            TČ varianty se liší jen spotřebou elektřiny
          </p>
        </div>
      </div>

      <div className="hp-kpi-row">
        <div className="hp-kpi">
          <span className="hp-metric-icon"><FaFire /></span>
          <span className="hp-kpi-val">
            {fmt(demand.annual_heating_kwh)}
          </span>
          <span className="hp-kpi-lbl">Vytápění kWh/rok</span>
        </div>
        {!heatingOnly && (
          <div className="hp-kpi">
            <span className="hp-metric-icon"><FaSnowflake /></span>
            <span className="hp-kpi-val">
              {fmt(demand.annual_cooling_kwh)}
            </span>
            <span className="hp-kpi-lbl">Chlazení kWh/rok</span>
          </div>
        )}
        <div className="hp-kpi">
          <span className="hp-kpi-val">
            {demand.specific_heating_kwh_m2}
          </span>
          <span className="hp-kpi-lbl">kWh/m²·rok (topení)</span>
        </div>
        <div className="hp-kpi">
          <span className="hp-kpi-val">
            {fmt(heatingOnly
              ? demand.annual_heating_kwh
              : demand.annual_total_kwh)}
          </span>
          <span className="hp-kpi-lbl">Celkem kWh/rok</span>
        </div>
      </div>

      <div className="hp-context">
        Budova o ploše <strong>{area.toFixed(0)} m²</strong> potřebuje
        ročně <strong>{fmt(demand.annual_heating_kwh)} kWh</strong> tepla
        pro vytápění
        {!heatingOnly && (
          <> a <strong>{fmt(demand.annual_cooling_kwh)} kWh</strong>
          &nbsp;chladu</>
        )}
        {' '}— to je cílová potřeba, kterou musí tepelné
        čerpadlo pokrýt.
      </div>

      <h3 className="hp-sub-title">Měsíční potřeba</h3>
      <div className="hpr-stacked-bars">
        {MO.map((mo, i) => {
          const h = demand.monthly_heating_kwh[i];
          const c = demand.monthly_cooling_kwh[i];
          return (
            <div key={i} className="hpr-bar-col">
              <div className="hpr-bar-stack">
                <div className="hpr-bar-heat"
                  style={{ height: `${(h / maxBar) * 100}%` }}
                  title={`${mo}: ${fmt(h)} kWh teplo`} />
                {!heatingOnly && (
                  <div className="hpr-bar-cool"
                    style={{ height: `${(c / maxBar) * 100}%` }}
                    title={`${mo}: ${fmt(c)} kWh chlad`} />
                )}
              </div>
              <span className="hp-bar-lbl">{mo}</span>
            </div>
          );
        })}
      </div>
      <div className="hpr-legend">
        <span className="hpr-leg-heat">Potřeba tepla</span>
        {!heatingOnly && (
          <span className="hpr-leg-cool">Potřeba chladu</span>
        )}
      </div>
    </section>
  );
};

export default HPRealDemand;