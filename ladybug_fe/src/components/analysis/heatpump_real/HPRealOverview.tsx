/**
 * Přehled budovy, klimatu a porovnání VRF vs WSHP.
 *
 * Zobrazuje celoroční metriky — vytápění i chlazení.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealOverview.tsx
 */
import React from 'react';
import {
  FaThermometerHalf, FaSnowflake, FaGlobeEurope,
  FaRulerCombined, FaFire, FaBalanceScale,
  FaWind, FaMountain,
} from 'react-icons/fa';
import type { RealHPResult } from './hpRealUtils';
import { fmt } from './hpRealUtils';

interface Props { result: RealHPResult; }

const HPRealOverview: React.FC<Props> = ({ result: r }) => {
  const vr = r.vrf.annual_renewable_kwh;
  const wr = r.wshp.annual_renewable_kwh;
  const total = vr + wr || 1;
  const vrfPct = (vr / total) * 100;
  const better = r.comparison.better_type === 'WSHP'
    ? 'WSHP (země-voda)' : 'VRF (vzduch-voda)';

  return (
    <>
      {/* ── Klimatický přehled ── */}
      <section className="hp-card">
        <div className="hp-card-head">
          <FaGlobeEurope className="hp-card-icon" />
          <div>
            <h2>{r.location.city}</h2>
            <p className="hp-card-sub">Budova a klima</p>
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
          <M v={`${r.parameters.heating_setpoint_c} °C`}
            l="Setpoint vytápění" />
          <M v={`${r.parameters.cooling_setpoint_c} °C`}
            l="Setpoint chlazení" />
        </div>
      </section>

      {/* ── Porovnání VRF vs WSHP ── */}
      <section className="hp-card">
        <div className="hp-card-head">
          <FaBalanceScale className="hp-card-icon" />
          <div>
            <h2>Porovnání obnovitelné energie</h2>
            <p className="hp-card-sub">
              {better} využije o {r.comparison.advantage_pct} % více OZE
            </p>
          </div>
        </div>

        <div className="hp-compare">
          <div className="hp-compare-bar">
            <div className="hp-bar-ashp"
              style={{ width: `${vrfPct}%` }}>
              <FaWind />
              <span>VRF {fmt(vr)} kWh</span>
            </div>
            <div className="hp-bar-gshp"
              style={{ width: `${100 - vrfPct}%` }}>
              <FaMountain />
              <span>WSHP {fmt(wr)} kWh</span>
            </div>
          </div>

          <div className="hp-compare-detail">
            <Col label="VRF (vzduch-voda)"
              cop={r.vrf.annual_cop}
              heat={r.vrf.annual_heating_kwh}
              cool={r.vrf.annual_cooling_kwh}
              elec={r.vrf.annual_electricity_kwh}
              cost={r.vrf.energy_metrics.annual_cost_czk}
              color="ashp" />
            <div className="hp-compare-vs">VS</div>
            <Col label="WSHP GSHP (země-voda)"
              cop={r.wshp.annual_cop}
              heat={r.wshp.annual_heating_kwh}
              cool={r.wshp.annual_cooling_kwh}
              elec={r.wshp.annual_electricity_kwh}
              cost={r.wshp.energy_metrics.annual_cost_czk}
              color="gshp" />
          </div>
        </div>
      </section>
    </>
  );
};

/* ── helpers ── */

const M: React.FC<{
  icon?: React.ReactNode; v: string; l: string;
}> = ({ icon, v, l }) => (
  <div className="hp-metric">
    {icon && <span className="hp-metric-icon">{icon}</span>}
    <span className="hp-metric-val">{v}</span>
    <span className="hp-metric-lbl">{l}</span>
  </div>
);

const Col: React.FC<{
  label: string; cop: number; heat: number;
  cool: number; elec: number; cost: number; color: string;
}> = ({ label, cop, heat, cool, elec, cost, color }) => (
  <div className={`hp-compare-col ${color}`}>
    <h4>{label}</h4>
    <div className="hp-compare-row">
      <span>COP (celoroční)</span><strong>{cop}</strong>
    </div>
    <div className="hp-compare-row">
      <span>Vytápění</span><strong>{fmt(heat)} kWh</strong>
    </div>
    <div className="hp-compare-row">
      <span>Chlazení</span><strong>{fmt(cool)} kWh</strong>
    </div>
    <div className="hp-compare-row">
      <span>Elektřina</span><strong>{fmt(elec)} kWh</strong>
    </div>
    <div className="hp-compare-row">
      <span>Náklady</span><strong>{fmt(cost)} CZK</strong>
    </div>
  </div>
);

export default HPRealOverview;