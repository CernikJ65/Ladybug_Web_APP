/**
 * Sdílené typy a utility pro celoroční simulaci TČ.
 *
 * Odděleno od komponent kvůli react-refresh pravidlu.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/hpRealUtils.ts
 */

/* ── typy ── */

export interface EnergyMetrics {
  savings_vs_direct_kwh: number;
  savings_czk: number;
  co2_savings_kg: number;
  annual_cost_czk: number;
  cost_direct_czk: number;
  specific_demand_kwh_m2: number;
}

export interface HPSystemResult {
  label: string;
  annual_heating_kwh: number;
  annual_cooling_kwh: number;
  annual_electricity_kwh: number;
  annual_renewable_kwh: number;
  annual_cop: number;
  monthly_heating_kwh: number[];
  monthly_cooling_kwh: number[];
  monthly_electricity_kwh: number[];
  monthly_renewable_kwh: number[];
  monthly_cop: number[];
  energy_metrics: EnergyMetrics;
}

export interface ClimateSummary {
  annual_avg_temp_c: number;
  heating_degree_days: number;
  frost_hours: number;
  ashrae_climate_zone: string;
}

export interface RealHPResult {
  location: { city: string; latitude: number; longitude: number };
  climate_summary: ClimateSummary;
  model_info: {
    room_count: number;
    total_floor_area_m2: number;
    building_type: string;
  };
  parameters: {
    heating_setpoint_c: number;
    cooling_setpoint_c: number;
    heat_recovery: number;
    electricity_price_czk: number;
    grid_co2_kg_per_mwh: number;
    hvac_vintage: string;
  };
  vrf: HPSystemResult;
  wshp: HPSystemResult;
  comparison: {
    better_type: string;
    difference_kwh: number;
    advantage_pct: number;
  };
}

/* ── formátování ── */

export const fmt = (n: number) =>
  n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });