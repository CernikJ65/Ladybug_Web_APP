import * as THREE from 'three';

export interface HBGeometry {
  type: string;
  boundary: number[][];
  plane?: { n: number[]; o: number[]; x?: number[] };
}

export interface HBFace {
  type: string;
  identifier: string;
  display_name?: string;
  geometry: HBGeometry;
  face_type?: string;
  boundary_condition?: { type: string; [key: string]: unknown };
}

export interface HBRoom {
  type: string;
  identifier: string;
  display_name?: string;
  faces: HBFace[];
  user_data?: Record<string, unknown>;
}

export interface HBShade {
  type: string;
  identifier?: string;
  display_name?: string;
  geometry: HBGeometry;
}

export interface HBJSONData {
  type?: string;
  identifier?: string;
  display_name?: string;
  version?: string;
  units?: string;
  rooms?: HBRoom[];
  orphaned_shades?: HBShade[];
  shades?: HBShade[];
}

export interface RoomInfo {
  id: number;
  name: string;
  vertexStart: number;
  vertexCount: number;
  faceCount: number;
  wallCount: number;
  floorCount: number;
  roofCount: number;
  area: number;
  height: number;
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
  center: THREE.Vector3;
  footprintEdges: Float32Array;
  roofPoints: Float32Array;
  roofWidth: number;
  roofLength: number;
  userBuildingId?: string;
}

export interface BuildingInfo {
  id: number;
  name: string;
  roomIds: number[];
  faceCount: number;
  area: number;
  minZ: number;
  maxZ: number;
  height: number;
  minX: number; maxX: number;
  minY: number; maxY: number;
  roofWidth: number;
  roofLength: number;
  center: THREE.Vector3;
}

export interface ModelStats {
  name: string;
  version: string;
  units: string;
  faceCount: number;
  roomCount: number;
  buildingCount: number;
  shadeCount: number;
  dimensions: { x: number; y: number; z: number };
}

export type ViewMode = 'rooms' | 'buildings';
