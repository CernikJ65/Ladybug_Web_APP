export interface Location {
  latitude: number;
  longitude: number;
  timezone: string;
  city: string;
}

export interface Window {
  id: string;
  width: number;
  height: number;
  positionX: number;
  positionZ: number;
  wall: 'north' | 'south' | 'east' | 'west';
}

export interface Room {
  id: string;
  name: string;
  positionX: number;
  positionY: number;
  width: number;
  length: number;
  height: number;
  windows: Window[];
}

export interface Floor {
  id: string;
  name: string;
  elevation: number;
  rooms: Room[];
}

export interface Building {
  id: string;
  name: string;
  positionX: number;
  positionY: number;
  floors: Floor[];
}

export interface Project {
  name: string;
  location: Location;
  buildings: Building[];
}

export interface Face3D {
  type: 'Face3D';
  boundary: number[][];
}

export interface Aperture {
  type: 'Aperture';
  identifier: string;
  display_name: string;
  properties: {
    type: 'ApertureProperties';
    energy: Record<string, never>;
  };
  geometry: Face3D;
  boundary_condition: {
    type: 'Outdoors';
  };
}

export interface Face {
  type: 'Face';
  identifier: string;
  display_name: string;
  properties: {
    type: 'FaceProperties';
    energy: Record<string, never>;
  };
  geometry: Face3D;
  face_type: 'Wall' | 'Floor' | 'RoofCeiling';
  boundary_condition: {
    type: 'Outdoors' | 'Ground';
  };
  apertures?: Aperture[];
}

export interface HBRoom {
  type: 'Room';
  identifier: string;
  display_name: string;
  properties: {
    type: 'RoomProperties';
    energy: Record<string, never>;
  };
  faces: Face[];
}

export interface HBModel {
  type: 'Model';
  identifier: string;
  display_name: string;
  version: string;
  properties: {
    type: 'ModelProperties';
    energy: Record<string, never>;
  };
  rooms: HBRoom[];
}