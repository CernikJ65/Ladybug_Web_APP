import type { RoofMeta } from './panelMapTypes';

export interface PanelResult {
  id: number;
  roof_id: string;
  center: number[];
  area_m2: number;
  tilt: number;
  azimuth: number;
  radiation_kwh_m2: number;
  annual_production_kwh: number;
  capacity_kwp: number;
}

export interface OptimizationResult {
  num_panels: number;
  total_production_kwh: number;
  total_capacity_kwp: number;
  total_area_m2: number;
  avg_radiation_kwh_m2: number;
  panels: PanelResult[];
}

export interface SystemLosses {
  age: number;
  light_induced_degradation: number;
  soiling: number;
  snow: number;
  manufacturer_nameplate_tolerance: number;
  cell_characteristic_mismatch: number;
  wiring: number;
  electrical_connection: number;
  grid_availability: number;
  total: number;
}

export interface AnalysisResult {
  model_info: {
    model_name: string;
    total_roof_area_m2: number;
    roof_count: number;
    roof_surface_count?: number;
  };
  location: {
    city: string;
    latitude: number;
    longitude: number;
  };
  optimal_orientation: {
    tilt_degrees: number;
    azimuth_degrees: number;
    cardinal_direction?: string;
  };
  panel_config: {
    pv_efficiency: number;
    module_type: string;
    mounting_type: string;
    panel_width_m?: number;
    panel_height_m?: number;
    panel_area_m2?: number;
    spacing_m?: number;
    active_area_fraction?: number;
    panel_age_years?: number;
    system_losses?: SystemLosses;
  };
  simulation_engine: string;
  roofs: RoofMeta[];
  optimization: {
    max_panels_available: number;
    requested_count: number;
    result: OptimizationResult;
  };
}

export interface CachedState {
  hbjsonFile: File | null;
  epwFile: File | null;
  result: AnalysisResult | null;
  error: string | null;
  numPanels: number;
  pvEff: number;
  maxTilt: number;
  mountType: string;
}
