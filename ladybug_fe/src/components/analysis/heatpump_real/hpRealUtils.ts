/**
 * Sdílené typy a utility pro celoroční simulaci TČ.
 *
 * Elektřina je agregovaná z EnergyPlus end-use meterů:
 *   Heating / Cooling / Fans / Pumps / HeatRejection
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/hpRealUtils.ts
 */

/* ── typy ── */

export interface BuildingDemand {
  annual_heating_kwh: number;
  annual_cooling_kwh: number;
  annual_total_kwh: number;
  specific_heating_kwh_m2: number;
  specific_cooling_kwh_m2: number;
  monthly_heating_kwh: number[];
  monthly_cooling_kwh: number[];
}

export interface HPSystemResult {
  label: string;
  annual_heating_kwh: number;
  annual_cooling_kwh: number;
  annual_produced_kwh: number;
  annual_electricity_kwh: number;
  annual_heat_elec_kwh: number;
  annual_cool_elec_kwh: number;
  annual_fan_elec_kwh: number;
  annual_pump_elec_kwh: number;
  annual_heatrej_elec_kwh: number;
  cop_heating: number;
  cop_cooling: number;
  cop_annual: number;
  monthly_heating_kwh: number[];
  monthly_cooling_kwh: number[];
  monthly_heat_elec_kwh: number[];
  monthly_cool_elec_kwh: number[];
  monthly_electricity_kwh: number[];
  monthly_cop_heating: number[];
  monthly_cop_cooling: number[];
  monthly_cop_total: number[];
  electricity_breakdown: Record<string, number>;
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
    ladybug_program: string;
  };
  parameters: {
    heat_recovery: number;
    heating_only: boolean;
    setpoints_applied: {
      heating_setpoint_c: number;
      cooling_setpoint_c: number;
    };
    setpoints_ladybug_default: {
      heating_setpoint_c: number;
      cooling_setpoint_c: number;
    };
  };
  building_demand: BuildingDemand;
  ashp: HPSystemResult;
  gshp: HPSystemResult;
}

/* ── formátování ── */

export const fmt = (n: number) =>
  n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });
