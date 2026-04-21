/**
 * Detailní výsledky jednoho TČ.
 *
 * UI rozděleno do 3 karet (trio):
 *   1. VYROBÍ TEPLO — thermal dodaný do zón (kWh)
 *   2. VYROBÍ CHLAD — thermal dodaný do zón (kWh)
 *   3. SPOTŘEBUJE ELEKTŘINU — součet end-use meterů
 *
 * COPy (topení, chlazení, celoroční) jsou vepsané přímo
 * do trojice karet — bez duplicitní KPI řady.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealSection.tsx
 */
import React from 'react';
import {
  FaBolt, FaFire, FaSnowflake, FaWind, FaMountain,
} from 'react-icons/fa';
import type { HPSystemResult } from './hpRealUtils';
import { fmt } from './hpRealUtils';
import HPElectricityBreakdown from './HPElectricityBreakdown';

interface Props {
  data: HPSystemResult;
  color: 'ashp' | 'gshp';
  heatingOnly?: boolean;
}

const MO = [
  'Led','Úno','Bře','Dub','Kvě','Čvn',
  'Čvc','Srp','Zář','Říj','Lis','Pro',
];

const HPRealSection: React.FC<Props> = ({
  data, color, heatingOnly = false,
}) => {
  const isAshp = color === 'ashp';
  const maxBar = Math.max(
    ...data.monthly_heating_kwh,
    ...(heatingOnly ? [] : data.monthly_cooling_kwh),
    ...data.monthly_electricity_kwh, 1,
  );
  const hasBreakdown = data.electricity_breakdown
    && Object.keys(data.electricity_breakdown).length > 0;

  return (
    <section className="hp-card">
      <div className="hp-card-head">
        {isAshp
          ? <FaWind className="hp-card-icon" />
          : <FaMountain className="hp-card-icon" />}
        <div>
          <h2>{data.label}</h2>
          <p className="hp-card-sub">
            ASHRAE 2019 · 1 TČ na místnost · COP celoroční {data.cop_annual}
          </p>
        </div>
      </div>

      {/* ── Trio: teplo / chlad / spotřeba ── */}
      <div className="hp-trio">
        <div className="hp-duo-card duo-heat">
          <div className="hp-duo-head">
            <span className="hp-duo-pill heat">
              <FaFire /> Vyrobí teplo
            </span>
          </div>
          <div className="hp-duo-big">{fmt(data.annual_heating_kwh)}</div>
          <span className="hp-duo-unit">kWh tepla / rok</span>
          <p className="hp-duo-note">
            <FaBolt /> spotřebuje {fmt(data.annual_heat_elec_kwh)} kWh el.
            <br />
            COP topení <strong>{data.cop_heating.toFixed(2)}</strong>
          </p>
        </div>

        {!heatingOnly && (
          <div className="hp-duo-card duo-cool">
            <div className="hp-duo-head">
              <span className="hp-duo-pill cool">
                <FaSnowflake /> Vyrobí chlad
              </span>
            </div>
            <div className="hp-duo-big">{fmt(data.annual_cooling_kwh)}</div>
            <span className="hp-duo-unit">kWh chladu / rok</span>
            <p className="hp-duo-note">
              <FaBolt /> spotřebuje {fmt(data.annual_cool_elec_kwh)} kWh el.
              <br />
              COP chlazení <strong>{data.cop_cooling.toFixed(2)}</strong>
            </p>
          </div>
        )}

        <div className="hp-duo-card duo-consumed">
          <div className="hp-duo-head">
            <span className="hp-duo-pill consumed">
              <FaBolt /> Spotřebuje
            </span>
          </div>
          <div className="hp-duo-big">{fmt(data.annual_electricity_kwh)}</div>
          <span className="hp-duo-unit">kWh elektřiny / rok</span>
          <p className="hp-duo-note">
            vč. ventilátorů, čerpadel a věže
            <br />
            COP celoroční <strong>{data.cop_annual.toFixed(2)}</strong>
          </p>
        </div>
      </div>

      {/* ── Shrnutí textem ── */}
      <div className="hp-context">
        TČ dodá do zón
        <strong> {fmt(data.annual_heating_kwh)} kWh </strong>tepla
        {!heatingOnly && (
          <> a <strong>{fmt(data.annual_cooling_kwh)} kWh </strong>chladu</>
        )}
        . Na to potřebuje
        <strong> {fmt(data.annual_electricity_kwh)} kWh </strong>
        elektřiny
        {heatingOnly ? (
          <>.</>
        ) : (
          <> — z toho{' '}
          <strong>{fmt(data.annual_heat_elec_kwh)} kWh</strong> na topení
          a <strong>{fmt(data.annual_cool_elec_kwh)} kWh</strong> na chlazení.</>
        )}
      </div>

      {/* ── Měsíčně: teplo / chlad / elektřina ── */}
      <h3 className="hp-sub-title">Měsíčně: produkce vs spotřeba</h3>
      <div className="hpr-stacked-bars">
        {MO.map((mo, i) => {
          const h = data.monthly_heating_kwh[i];
          const c = data.monthly_cooling_kwh[i];
          const e = data.monthly_electricity_kwh[i];
          return (
            <div key={i} className="hpr-bar-col hpr-bar-col--pair">
              <div className="hpr-pair-bars">
                <div className="hpr-bar-heat"
                  style={{ height: `${(h / maxBar) * 100}%` }}
                  title={`${mo}: teplo ${fmt(h)} kWh`} />
                {!heatingOnly && (
                  <div className="hpr-bar-cool"
                    style={{ height: `${(c / maxBar) * 100}%` }}
                    title={`${mo}: chlad ${fmt(c)} kWh`} />
                )}
                <div className="hpr-bar-elec"
                  style={{ height: `${(e / maxBar) * 100}%` }}
                  title={`${mo}: elektrina ${fmt(e)} kWh`} />
              </div>
              <span className="hp-bar-lbl">{mo}</span>
            </div>
          );
        })}
      </div>
      <div className="hpr-legend">
        <span className="hpr-leg-heat">Vyrobené teplo</span>
        {!heatingOnly && (
          <span className="hpr-leg-cool">Vyrobený chlad</span>
        )}
        <span className="hpr-leg-elec">Spotřeba el.</span>
      </div>

      {/* ── Měsíční COP chipy ── */}
      <h3 className="hp-sub-title">Měsíční COP (celkové)</h3>
      <div className="hp-cop-strip">
        {data.monthly_cop_total.map((c, i) => (
          <div key={i} className="hp-cop-chip">
            <span className="hp-cop-v">{c.toFixed(1)}</span>
            <span className="hp-cop-m">{MO[i]}</span>
          </div>
        ))}
      </div>

      {/* ── Rozpad elektřiny — Apple-style bar ── */}
      {hasBreakdown && (
        <>
          <h3 className="hp-sub-title">Rozpad spotřeby elektřiny</h3>
          <HPElectricityBreakdown breakdown={data.electricity_breakdown} />
        </>
      )}
    </section>
  );
};

export default HPRealSection;