/**
 * Sdilene typy a utility pro celorocni simulaci TC.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/hpRealUtils.ts
 */

export interface RoomInfo {
  identifier: string;
  display_name: string;
  floor_area_m2: number;
  dim_x_m: number;
  dim_y_m: number;
}

export interface RoomDemand extends RoomInfo {
  heating_kwh: number;
  cooling_kwh: number;
}

export interface BuildingDemand {
  annual_heating_kwh: number;
  annual_cooling_kwh: number;
  annual_total_kwh: number;
  specific_heating_kwh_m2: number;
  specific_cooling_kwh_m2: number;
  monthly_heating_kwh: number[];
  monthly_cooling_kwh: number[];
  rooms: RoomDemand[];
}

export interface HPSystemResult {
  label: string;
  annual_heating_kwh: number;
  annual_cooling_kwh: number;
  annual_electricity_kwh: number;
  annual_heat_elec_kwh: number;
  annual_cool_elec_kwh: number;
  cop_heating: number;
  cop_cooling: number;
  cop_annual: number;
  monthly_heating_kwh: number[];
  monthly_cooling_kwh: number[];
  monthly_cop_total: number[];
  monthly_cop_heating: number[];
  monthly_cop_cooling: number[];
}

export interface RealHPResult {
  model_info: {
    room_count: number;
    total_floor_area_m2: number;
    building_type: string;
    rooms: RoomInfo[];
  };
  parameters: {
    heat_recovery: number;
    heating_only: boolean;
    setpoints_applied: {
      heating_setpoint_c: number;
      cooling_setpoint_c: number;
    };
  };
  building_demand: BuildingDemand;
  ashp: HPSystemResult;
  gshp: HPSystemResult;
}

export const fmt = (n: number | undefined | null) =>
  (n ?? 0).toLocaleString('cs-CZ', { maximumFractionDigits: 0 });
