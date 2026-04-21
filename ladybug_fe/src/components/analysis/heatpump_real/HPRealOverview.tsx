/**
 * Přehled budovy, klimatu a použitých parametrů.
 *
 * Ukazuje i ladybug defaulty vs aplikované setpointy, aby
 * uživatel viděl, v čem se simulace liší od Ladybug normy.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealOverview.tsx
 */
import React from 'react';
import {
  FaThermometerHalf, FaSnowflake, FaGlobeEurope,
  FaRulerCombined, FaFire, FaWind,
} from 'react-icons/fa';
import type { RealHPResult } from './hpRealUtils';
import { fmt } from './hpRealUtils';

interface Props { result: RealHPResult; }

const HPRealOverview: React.FC<Props> = ({ result: r }) => {
  const sp = r.parameters.setpoints_applied;
  const lbSp = r.parameters.setpoints_ladybug_default;
  const hr = r.parameters.heat_recovery;
  const heatingOnly = r.parameters.heating_only;
  const overridden =
    sp.heating_setpoint_c !== lbSp.heating_setpoint_c ||
    (!heatingOnly &&
      sp.cooling_setpoint_c !== lbSp.cooling_setpoint_c);

  return (
    <section className="hp-card">
      <div className="hp-card-head">
        <FaGlobeEurope className="hp-card-icon" />
        <div>
          <h2>{r.location.city}</h2>
          <p className="hp-card-sub">
            Budova · Ladybug program „{r.model_info.ladybug_program}"
          </p>
        </div>
      </div>
      <div className="hp-metrics">
        <M icon={<FaThermometerHalf />}
          v={`${r.climate_summary.annual_avg_temp_c} °C`}
          l="Průměrná roční teplota" />
        <M icon={<FaFire />}
          v={fmt(r.climate_summary.heating_degree_days)}
          l="Denostupně (18 °C)" />
        <M icon={<FaSnowflake />}
          v={`${fmt(r.climate_summary.frost_hours)} h`}
          l="Mrazové hodiny" />
        <M v={r.climate_summary.ashrae_climate_zone}
          l="ASHRAE zóna" />
        <M v={`${r.model_info.room_count}`}
          l="Místností" />
        <M icon={<FaRulerCombined />}
          v={`${r.model_info.total_floor_area_m2.toFixed(0)} m²`}
          l="Podlahová plocha" />
        <M v={`${sp.heating_setpoint_c} °C`}
          l={overridden
            ? `Setpoint topení (LB ${lbSp.heating_setpoint_c})`
            : 'Setpoint topení'} />
        {heatingOnly ? (
          <M v="vypnuto"
            l="Chlazení (jen vytápění)" />
        ) : (
          <M v={`${sp.cooling_setpoint_c} °C`}
            l={overridden
              ? `Setpoint chlazení (LB ${lbSp.cooling_setpoint_c})`
              : 'Setpoint chlazení'} />
        )}
        <M icon={<FaWind />}
          v={hr === 0 ? 'Vyp.' : `${Math.round(hr * 100)} %`}
          l={hr === 0 ? 'Rekuperace (bez DOAS)' : 'Rekuperace (ERV)'} />
      </div>
    </section>
  );
};

const M: React.FC<{
  icon?: React.ReactNode; v: string; l: string;
}> = ({ icon, v, l }) => (
  <div className="hp-metric">
    {icon && <span className="hp-metric-icon">{icon}</span>}
    <span className="hp-metric-val">{v}</span>
    <span className="hp-metric-lbl">{l}</span>
  </div>
);

export default HPRealOverview;