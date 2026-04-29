/**
 * TS smlouvy s backendem PED optimalizatoru.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/pedTypes.ts
 */

export interface ConsumptionBreakdown {
  heating: number;
  cooling: number;
  fans: number;
  pumps: number;
  heat_rejection: number;
  lights: number;
  equipment: number;
  total: number;
}

export interface MonthRow {
  month: string;
  consumption_kwh: number;
  pv_kwh: number;
  balance_kwh: number;
  is_positive: boolean;
}

export interface VariantSystem {
  key: string;
  label: string;
  available: boolean;
  unavailable_reason: string;
  has_hp: boolean;
  hp_type: string;
  hp_label: string;
  hp_cost_czk: number;
  num_panels: number;
  pv_cost_czk: number;
  total_cost_czk: number;
  remaining_czk: number;
}

export interface HpPerformance {
  heat_delivered_kwh: number;
  heat_demand_per_m2_kwh: number;
  heating_electricity_kwh: number;
  system_electricity_kwh: number;
  free_heat_kwh: number;
  scop: number;
}

export interface PedVariant {
  system: VariantSystem;
  consumption_kwh: ConsumptionBreakdown | null;
  consumption_per_m2_kwh: number | null;
  pv_production_kwh: number | null;
  balance_kwh: number | null;
  ped_ratio: number | null;
  is_ped: boolean;
  deficit_kwh: number | null;
  heating_uncovered: boolean;
  hp_performance: HpPerformance | null;
  monthly: MonthRow[];
}

export interface PedModelInfo {
  room_count: number;
  total_floor_area_m2: number;
  building_type: string;
}

export interface PedPvSettings {
  engine: string;
  mounting_type: string;
}

export type MountingType = 'FixedOpenRack' | 'FixedRoofMounted';

export interface PedApiResult {
  location: string;
  model_info: PedModelInfo;
  pv_settings: PedPvSettings;
  max_panels_available: number;
  budget_czk: number;
  variants: PedVariant[];
  best_index: number;
}
