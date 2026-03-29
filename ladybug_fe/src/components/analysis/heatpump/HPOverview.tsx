/**
 * Přehled budovy, klimatu a porovnání ASHP vs GSHP.
 *
 * Zobrazuje klíčové metriky z výsledků simulace
 * a vizuální porovnání dvou typů tepelných čerpadel.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump/HPOverview.tsx
 */
import React from 'react';
import {
  FaThermometerHalf, FaSnowflake, FaGlobeEurope,
  FaRulerCombined, FaFire, FaBalanceScale,
  FaWind, FaMountain,
} from 'react-icons/fa';
import type { AnalysisResult } from './hpUtils';
import { fmt } from './hpUtils';

interface Props { result: AnalysisResult; }

const HPOverview: React.FC<Props> = ({ result: r }) => {
  const ashpR = r.ashp.annual_renewable_kwh;
  const gshpR = r.gshp.annual_renewable_kwh;
  const total = ashpR + gshpR || 1;
  const ashpPct = (ashpR / total) * 100;
  const better = r.comparison.better_type === 'GSHP'
    ? 'Země–voda' : 'Vzduch–voda';

  return (
    <>
      {/* ── Klimatický a stavební přehled ── */}
      <section className="hp-card">
        <div className="hp-card-head">
          <FaGlobeEurope className="hp-card-icon" />
          <div>
            <h2>{r.location.city}</h2>
            <p className="hp-card-sub">Přehled budovy a klimatu</p>
          </div>
        </div>

        <div className="hp-metrics">
          <Metric
            icon={<FaThermometerHalf />}
            value={`${r.climate_summary.annual_avg_temp_c} °C`}
            label="Průměrná roční teplota"
          />
          <Metric
            icon={<FaFire />}
            value={fmt(r.climate_summary.heating_degree_days)}
            label="Denostupně (base 18 °C)"
          />
          <Metric
            icon={<FaSnowflake />}
            value={`${fmt(r.climate_summary.frost_hours)} h`}
            label="Mrazové hodiny (< 0 °C)"
          />
          <Metric
            value={r.climate_summary.ashrae_climate_zone}
            label="ASHRAE klim. zóna"
          />
          <Metric
            value={`${r.model_info.room_count}`}
            label="Počet místností"
          />
          <Metric
            icon={<FaRulerCombined />}
            value={`${r.model_info.total_floor_area_m2.toFixed(0)} m²`}
            label="Podlahová plocha"
          />
          <Metric
            value={`${fmt(r.simulation.total_heating_kwh)} kWh`}
            label="Roční tepelná potřeba"
          />
          <Metric
            value={`${r.ashp.energy_metrics.specific_heat_demand_kwh_m2} kWh/m²`}
            label="Měrná potřeba tepla"
          />
        </div>
      </section>

      {/* ── Porovnání ── */}
      <section className="hp-card">
        <div className="hp-card-head">
          <FaBalanceScale className="hp-card-icon" />
          <div>
            <h2>Porovnání OZE výroby</h2>
            <p className="hp-card-sub">
              {better} vyrobí o {r.comparison.advantage_percent} %
              více obnovitelné energie
            </p>
          </div>
        </div>

        <div className="hp-compare">
          <div className="hp-compare-bar">
            <div className="hp-bar-ashp"
              style={{ width: `${ashpPct}%` }}>
              <FaWind />
              <span>ASHP {fmt(ashpR)} kWh</span>
            </div>
            <div className="hp-bar-gshp"
              style={{ width: `${100 - ashpPct}%` }}>
              <FaMountain />
              <span>GSHP {fmt(gshpR)} kWh</span>
            </div>
          </div>

          <div className="hp-compare-detail">
            <CompareCol
              label="Vzduch–voda (ASHP)"
              cop={r.ashp.annual_avg_cop}
              elec={r.ashp.energy_metrics.electricity_kwh}
              cost={r.ashp.energy_metrics.annual_cost_hp_czk}
              co2={r.ashp.energy_metrics.co2_savings_kg}
              color="ashp"
            />
            <div className="hp-compare-vs">VS</div>
            <CompareCol
              label="Země–voda (GSHP)"
              cop={r.gshp.annual_avg_cop}
              elec={r.gshp.energy_metrics.electricity_kwh}
              cost={r.gshp.energy_metrics.annual_cost_hp_czk}
              co2={r.gshp.energy_metrics.co2_savings_kg}
              color="gshp"
            />
          </div>
        </div>
      </section>
    </>
  );
};

/* ── pomocné ── */

const Metric: React.FC<{
  icon?: React.ReactNode; value: string; label: string;
}> = ({ icon, value, label }) => (
  <div className="hp-metric">
    {icon && <span className="hp-metric-icon">{icon}</span>}
    <span className="hp-metric-val">{value}</span>
    <span className="hp-metric-lbl">{label}</span>
  </div>
);

const CompareCol: React.FC<{
  label: string; cop: number; elec: number;
  cost: number; co2: number; color: string;
}> = ({ label, cop, elec, cost, co2, color }) => (
  <div className={`hp-compare-col ${color}`}>
    <h4>{label}</h4>
    <div className="hp-compare-row">
      <span>Průměrný COP</span><strong>{cop}</strong>
    </div>
    <div className="hp-compare-row">
      <span>Spotřeba el.</span><strong>{fmt(elec)} kWh</strong>
    </div>
    <div className="hp-compare-row">
      <span>Roční náklady</span><strong>{fmt(cost)} CZK</strong>
    </div>
    <div className="hp-compare-row">
      <span>Úspora CO₂</span><strong>{fmt(co2)} kg</strong>
    </div>
  </div>
);

export default HPOverview;