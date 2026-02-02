import type {
  Face3D,
  Aperture,
  Face,
  HBRoom,
  HBModel,
  Room,
  Project,
  Window
} from './HbjsonBuilderTypes';

export class HBJSONGenerator {
  private static generateId(prefix: string, index: number): string {
    return `${prefix}_${index}`;
  }

  private static createFace3D(points: number[][]): Face3D {
    return {
      type: 'Face3D',
      boundary: points
    };
  }

  private static createAperture(
    identifier: string,
    points: number[][],
    index: number
  ): Aperture {
    return {
      type: 'Aperture',
      identifier: this.generateId(identifier, index),
      display_name: `Okno_${index + 1}`,
      properties: {
        type: 'ApertureProperties',
        energy: {}
      },
      geometry: this.createFace3D(points),
      boundary_condition: {
        type: 'Outdoors'
      }
    };
  }

  private static calculateWindowPoints(
    win: Window,
    wallType: string,
    roomAbsPos: { x: number; y: number; z: number },
    roomDims: { width: number; length: number; height: number }
  ): number[][] {
    const points: number[][] = [];
    const z = roomAbsPos.z + win.positionZ;

    switch (wallType) {
      case 'north':
        {
          const x = roomAbsPos.x + win.positionX;
          const y = roomAbsPos.y;
          points.push(
            [x, y, z],
            [x + win.width, y, z],
            [x + win.width, y, z + win.height],
            [x, y, z + win.height]
          );
        }
        break;
      case 'south':
        {
          const x = roomAbsPos.x + win.positionX;
          const y = roomAbsPos.y + roomDims.length;
          points.push(
            [x, y, z],
            [x + win.width, y, z],
            [x + win.width, y, z + win.height],
            [x, y, z + win.height]
          );
        }
        break;
      case 'east':
        {
          const x = roomAbsPos.x + roomDims.width;
          const y = roomAbsPos.y + win.positionX;
          points.push(
            [x, y, z],
            [x, y + win.width, z],
            [x, y + win.width, z + win.height],
            [x, y, z + win.height]
          );
        }
        break;
      case 'west':
        {
          const x = roomAbsPos.x;
          const y = roomAbsPos.y + win.positionX;
          points.push(
            [x, y, z],
            [x, y + win.width, z],
            [x, y + win.width, z + win.height],
            [x, y, z + win.height]
          );
        }
        break;
    }

    return points;
  }

  private static createWallWithWindows(
    identifier: string,
    points: number[][],
    windows: Window[],
    wallType: string,
    roomAbsPos: { x: number; y: number; z: number },
    roomDims: { width: number; length: number; height: number }
  ): Face {
    const apertures: Aperture[] = [];

    windows
      .filter((win) => win.wall === wallType)
      .forEach((win, idx) => {
        const aperPoints = this.calculateWindowPoints(
          win,
          wallType,
          roomAbsPos,
          roomDims
        );
        if (aperPoints.length > 0) {
          apertures.push(this.createAperture(identifier, aperPoints, idx));
        }
      });

    const face: Face = {
      type: 'Face',
      identifier,
      display_name: identifier,
      properties: {
        type: 'FaceProperties',
        energy: {}
      },
      geometry: this.createFace3D(points),
      face_type: 'Wall',
      boundary_condition: {
        type: 'Outdoors'
      }
    };

    if (apertures.length > 0) {
      face.apertures = apertures;
    }

    return face;
  }

  private static createRoomFaces(
    room: Room,
    floorElevation: number
  ): Face[] {
    const faces: Face[] = [];
    const x = room.positionX;
    const y = room.positionY;
    const z = floorElevation;
    const w = room.width;
    const l = room.length;
    const h = room.height;

    const roomAbsPos = { x, y, z };
    const roomDims = { width: w, length: l, height: h };

    const isGroundFloor = floorElevation === 0;

    faces.push({
      type: 'Face',
      identifier: `${room.id}_Floor`,
      display_name: `${room.name}_Podlaha`,
      properties: { type: 'FaceProperties', energy: {} },
      geometry: this.createFace3D([
        [x, y, z],
        [x + w, y, z],
        [x + w, y + l, z],
        [x, y + l, z]
      ]),
      face_type: 'Floor',
      boundary_condition: { type: isGroundFloor ? 'Ground' : 'Outdoors' }
    });

    faces.push({
      type: 'Face',
      identifier: `${room.id}_Ceiling`,
      display_name: `${room.name}_Strop`,
      properties: { type: 'FaceProperties', energy: {} },
      geometry: this.createFace3D([
        [x, y, z + h],
        [x, y + l, z + h],
        [x + w, y + l, z + h],
        [x + w, y, z + h]
      ]),
      face_type: 'RoofCeiling',
      boundary_condition: { type: 'Outdoors' }
    });

    faces.push(
      this.createWallWithWindows(
        `${room.id}_North`,
        [
          [x, y, z],
          [x + w, y, z],
          [x + w, y, z + h],
          [x, y, z + h]
        ],
        room.windows,
        'north',
        roomAbsPos,
        roomDims
      )
    );

    faces.push(
      this.createWallWithWindows(
        `${room.id}_South`,
        [
          [x, y + l, z],
          [x, y + l, z + h],
          [x + w, y + l, z + h],
          [x + w, y + l, z]
        ],
        room.windows,
        'south',
        roomAbsPos,
        roomDims
      )
    );

    faces.push(
      this.createWallWithWindows(
        `${room.id}_East`,
        [
          [x + w, y, z],
          [x + w, y + l, z],
          [x + w, y + l, z + h],
          [x + w, y, z + h]
        ],
        room.windows,
        'east',
        roomAbsPos,
        roomDims
      )
    );

    faces.push(
      this.createWallWithWindows(
        `${room.id}_West`,
        [
          [x, y, z],
          [x, y, z + h],
          [x, y + l, z + h],
          [x, y + l, z]
        ],
        room.windows,
        'west',
        roomAbsPos,
        roomDims
      )
    );

    return faces;
  }

  public static generateModel(project: Project): HBModel {
    const rooms: HBRoom[] = [];

    project.buildings.forEach((building) => {
      building.floors.forEach((floor) => {
        floor.rooms.forEach((room) => {
          const faces = this.createRoomFaces(
            room,
            floor.elevation
          );

          rooms.push({
            type: 'Room',
            identifier: room.id,
            display_name: room.name,
            properties: {
              type: 'RoomProperties',
              energy: {}
            },
            faces
          });
        });
      });
    });

    return {
      type: 'Model',
      identifier: project.name.replace(/\s+/g, '_'),
      display_name: project.name,
      version: '1.54.6',
      properties: {
        type: 'ModelProperties',
        energy: {}
      },
      rooms
    };
  }

  public static exportToJSON(project: Project): string {
    const model = this.generateModel(project);
    return JSON.stringify(model, null, 2);
  }
}