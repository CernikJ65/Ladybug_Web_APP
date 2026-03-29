/**
 * Sdílené utility a typy pro analýzu tepelných čerpadel.
 *
 * Odděleno od komponent kvůli react-refresh pravidlu
 * (soubor s komponentou smí exportovat jen komponenty).
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump/hpUtils.ts
 */

/* ── typy ── */

export interface EnergyMetrics {
  electricity_kwh: number;
  savings_vs_direct_kwh: number;
  savings_czk: number;
  co2_savings_kg: number;
  co2_savings_tons: number;
  specific_heat_demand_kwh_m2: number;
  peak_heating_kw: number;
  monthly_electricity_kwh: number[];
  annual_cost_hp_czk: number;
  annual_cost_direct_czk: number;
}

export interface RoomResult {
  id: string;
  name: string;
  floor_area_m2: number;
  annual_renewable_kwh: number;
}

export interface HPTypeResult {
  label: string;
  annual_renewable_kwh: number;
  annual_avg_cop: number;
  monthly_avg_cop: number[];
  monthly_renewable_kwh: number[];
  rooms: RoomResult[];
  energy_metrics: EnergyMetrics;
}

export interface ClimateSummary {
  annual_avg_temp_c: number;
  heating_degree_days: number;
  frost_hours: number;
  ashrae_climate_zone: string;
}

export interface AnalysisResult {
  location: { city: string; latitude: number; longitude: number };
  climate_summary: ClimateSummary;
  model_info: {
    room_count: number;
    total_floor_area_m2: number;
    building_type: string;
  };
  simulation: { engine: string; total_heating_kwh: number };
  ashp: HPTypeResult;
  gshp: HPTypeResult;
  comparison: {
    better_type: string;
    difference_kwh: number;
    advantage_percent: number;
  };
}

/* ── formátování ── */

export const fmt = (n: number) =>
  n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });