export interface WorldBounds {
  min_x: number; max_x: number; min_y: number; max_y: number;
  width_m: number; depth_m: number;
}

export interface RoofMeta {
  identifier: string; area_m2: number; tilt: number; azimuth: number;
  orientation: string; center: number[]; world_bounds?: WorldBounds;
  /** Vrcholy polygonu hrany střechy v XY (world). Z backendu — viz solar_response.roof_world_polygon. */
  world_polygon?: number[][];
}

export interface Panel {
  id: number; roof_id: string; center: number[];
  tilt: number; azimuth: number; radiation_kwh_m2: number;
  annual_production_kwh: number; area_m2: number;
}

export interface PanelMapProps {
  panels: Panel[];
  roofs?: RoofMeta[];
  panelOrder?: Map<number, number>;
}

export interface OrientedBox {
  cornersWorld: Array<[number, number]>;
  center: [number, number];
  length: number;
  width: number;
  angleRad: number;
}

export interface RoofViewProps {
  roofId: string;
  panels: Panel[];
  roofMeta?: RoofMeta;
  gMinR: number;
  gMaxR: number;
  panelOrder?: Map<number, number>;
}
