/**
 * Detailni vysledky jednoho TC — Apple-clean design.
 *
 * Layout: COP hero → 3 stat radky → mesicni stacked column bars →
 * mesicni COP chipy → per-room produkce (HPRealRoomList).
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealSection.tsx
 */
import React from 'react';
import {
  FaBolt, FaFire, FaSnowflake,
} from 'react-icons/fa';
import HPRealRoomList from './HPRealRoomList';
import type { HPSystemResult, RoomDemand } from './hpRealUtils';
import { fmt } from './hpRealUtils';

interface Props {
  data: HPSystemResult;
  rooms: RoomDemand[];
  heatingOnly?: boolean;
}

const MO = [
  'Led','Úno','Bře','Dub','Kvě','Čvn',
  'Čvc','Srp','Zář','Říj','Lis','Pro',
];

const HPRealSection: React.FC<Props> = ({
  data, rooms, heatingOnly = false,
}) => {
  const monthH = data.monthly_heating_kwh ?? [];
  const monthC = data.monthly_cooling_kwh ?? [];
  const monthCopHeat = data.monthly_cop_heating ?? [];
  const monthCopCool = data.monthly_cop_cooling ?? [];

  const maxBar = Math.max(
    ...monthH,
    ...(heatingOnly ? [] : monthC), 1,
  );

  return (
    <div className="hp-detail">
      <div className="hp-cop-hero">
        <span className="hp-cop-hero-val">
          {data.cop_annual.toFixed(2)}
        </span>
        <span className="hp-cop-hero-lbl">COP celoroční</span>
      </div>

      <div className="hp-pump-stats">
        <div className="hp-pump-stat hp-stat-heat">
          <FaFire className="hp-pump-stat-icon" />
          <div className="hp-pump-stat-body">
            <span className="hp-pump-stat-val">
              {fmt(data.annual_heating_kwh)}
            </span>
            <span className="hp-pump-stat-unit">
              kWh tepla / rok
            </span>
          </div>
          <span className="hp-pump-stat-side">
            COP {data.cop_heating.toFixed(2)}
          </span>
        </div>

        {!heatingOnly && (
          <div className="hp-pump-stat hp-stat-cool">
            <FaSnowflake className="hp-pump-stat-icon" />
            <div className="hp-pump-stat-body">
              <span className="hp-pump-stat-val">
                {fmt(data.annual_cooling_kwh)}
              </span>
              <span className="hp-pump-stat-unit">
                kWh chladu / rok
              </span>
            </div>
            <span className="hp-pump-stat-side">
              COP {data.cop_cooling.toFixed(2)}
            </span>
          </div>
        )}

        <div className="hp-pump-stat hp-stat-elec">
          <FaBolt className="hp-pump-stat-icon" />
          <div className="hp-pump-stat-body">
            <span className="hp-pump-stat-val">
              {fmt(data.annual_electricity_kwh)}
            </span>
            <span className="hp-pump-stat-unit">
              kWh el. spotřeba / rok
            </span>
          </div>
        </div>
      </div>

      {monthH.length === 12 && (
        <>
          <h3 className="hp-sub-title">Měsíční produkce</h3>
          <div className="hpr-stacked-bars">
            {MO.map((mo, i) => {
              const h = monthH[i] ?? 0;
              const c = monthC[i] ?? 0;
              return (
                <div key={i} className="hpr-bar-col">
                  <div className="hpr-bar-stack">
                    <div className="hpr-bar-heat"
                      style={{ height: `${(h / maxBar) * 100}%` }}
                      title={`${mo}: teplo ${fmt(h)} kWh`} />
                    {!heatingOnly && (
                      <div className="hpr-bar-cool"
                        style={{ height: `${(c / maxBar) * 100}%` }}
                        title={`${mo}: chlad ${fmt(c)} kWh`} />
                    )}
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
          </div>
        </>
      )}

      {monthCopHeat.length === 12 && (
        <>
          <h3 className="hp-sub-title">Měsíční COP topení</h3>
          <div className="hp-cop-strip">
            {monthCopHeat.map((c, i) => (
              <div key={i} className="hp-cop-chip">
                <span className="hp-cop-v">{c.toFixed(1)}</span>
                <span className="hp-cop-m">{MO[i]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!heatingOnly && monthCopCool.length === 12 && (
        <>
          <h3 className="hp-sub-title">Měsíční COP chlazení</h3>
          <div className="hp-cop-strip">
            {monthCopCool.map((c, i) => (
              <div key={i} className="hp-cop-chip">
                <span className="hp-cop-v">{c.toFixed(1)}</span>
                <span className="hp-cop-m">{MO[i]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <HPRealRoomList rooms={rooms} heatingOnly={heatingOnly} />
    </div>
  );
};

export default HPRealSection;