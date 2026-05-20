/**
 * Tepelna potreba budovy — KPI a mesicni stacked bar graf.
 *
 * Per-room rozpis se NEzobrazuje (patri do HP detail tabu,
 * ne do "potreby budovy" — to je pohled produkce TC).
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealDemand.tsx
 */
import React from 'react';
import { FaFire, FaSnowflake, FaBuilding } from 'react-icons/fa';
import type { BuildingDemand } from './hpRealUtils';
import { fmt } from './hpRealUtils';
import { useT } from '../../../i18n/useT';

interface Props {
  demand: BuildingDemand;
  heatingOnly?: boolean;
}

const HPRealDemand: React.FC<Props> = ({
  demand, heatingOnly = false,
}) => {
  const t = useT();
  const MO = [
    t('Led'), t('Úno'), t('Bře'), t('Dub'), t('Kvě'), t('Čvn'),
    t('Čvc'), t('Srp'), t('Zář'), t('Říj'), t('Lis'), t('Pro'),
  ];
  const heatMonthly = demand.monthly_heating_kwh ?? [];
  const coolMonthly = demand.monthly_cooling_kwh ?? [];
  const maxBar = Math.max(
    ...heatMonthly,
    ...(heatingOnly ? [] : coolMonthly), 1,
  );

  return (
    <section className="hp-card" data-tour="hp-demand">
      <div className="hp-card-head">
        <FaBuilding className="hp-card-icon" />
        <div>
          <h2>{t('Tepelná potřeba budovy')}</h2>
        </div>
      </div>

      <div className="hp-kpi-row">
        <div className="hp-kpi">
          <span className="hp-metric-icon"><FaFire /></span>
          <span className="hp-kpi-val">
            {fmt(demand.annual_heating_kwh)}
          </span>
          <span className="hp-kpi-lbl">
            {t('Potřeba vytápění')} <span className="hp-kpi-unit">kWh/rok</span>
          </span>
        </div>
        {!heatingOnly && (
          <div className="hp-kpi">
            <span className="hp-metric-icon"><FaSnowflake /></span>
            <span className="hp-kpi-val">
              {fmt(demand.annual_cooling_kwh)}
            </span>
            <span className="hp-kpi-lbl">
              {t('Chlazení')} <span className="hp-kpi-unit">kWh/rok</span>
            </span>
          </div>
        )}
      </div>

      <h3 className="hp-sub-title">{t('Měsíční potřeba')}</h3>
      <div className="hpr-stacked-bars">
        {MO.map((mo, i) => {
          const h = heatMonthly[i] ?? 0;
          const c = coolMonthly[i] ?? 0;
          return (
            <div key={i} className="hpr-bar-col">
              <div className="hpr-bar-stack">
                <div className="hpr-bar-heat"
                  style={{ height: `${(h / maxBar) * 100}%` }}
                  title={t('{{mo}}: {{val}} kWh teplo', { mo, val: fmt(h) })} />
                {!heatingOnly && (
                  <div className="hpr-bar-cool"
                    style={{ height: `${(c / maxBar) * 100}%` }}
                    title={t('{{mo}}: {{val}} kWh chlad', { mo, val: fmt(c) })} />
                )}
              </div>
              <span className="hp-bar-lbl">{mo}</span>
            </div>
          );
        })}
      </div>
      <div className="hpr-legend">
        <span className="hpr-leg-heat">{t('Potřeba tepla')}</span>
        {!heatingOnly && (
          <span className="hpr-leg-cool">{t('Potřeba chladu')}</span>
        )}
      </div>
    </section>
  );
};

export default HPRealDemand;