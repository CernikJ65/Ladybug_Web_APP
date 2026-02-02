import React, { useState } from 'react';
import LocationForm from './LocationForm';
import BuildingList from './BuildingList';
import FloorList from './FloorList';
import RoomList from './RoomList';
import WindowList from './WindowList';
import { HBJSONGenerator } from './HbjsonGenerator';
import type { Project, Building, Floor, Room, Window, Location } from './HbjsonBuilderTypes';
import './HbjsonBuilder.css';

const HBJSONBuilder: React.FC = () => {
  const [project, setProject] = useState<Project>({
    name: 'Nový projekt',
    location: {
      latitude: 50.0755,
      longitude: 14.4378,
      timezone: 'Europe/Prague',
      city: 'Praha'
    },
    buildings: []
  });

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const selectedBuilding = project.buildings.find(b => b.id === selectedBuildingId);
  const selectedFloor = selectedBuilding?.floors.find(f => f.id === selectedFloorId);
  const selectedRoom = selectedFloor?.rooms.find(r => r.id === selectedRoomId);

  const updateLocation = (field: keyof Location, value: string | number) => {
    setProject(prev => ({
      ...prev,
      location: { ...prev.location, [field]: value }
    }));
  };

  const addBuilding = () => {
    const newBuilding: Building = {
      id: `building_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Budova ${project.buildings.length + 1}`,
      positionX: 0,
      positionY: 0,
      floors: []
    };
    setProject(prev => ({
      ...prev,
      buildings: [...prev.buildings, newBuilding]
    }));
    setSelectedBuildingId(newBuilding.id);
  };

  const removeBuilding = (buildingId: string) => {
    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.filter(b => b.id !== buildingId)
    }));
    if (selectedBuildingId === buildingId) {
      setSelectedBuildingId(null);
      setSelectedFloorId(null);
      setSelectedRoomId(null);
    }
  };

  const updateBuilding = (buildingId: string, field: keyof Building, value: string | number) => {
    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.map(b =>
        b.id === buildingId ? { ...b, [field]: value } : b
      )
    }));
  };

  const addFloor = () => {
    if (!selectedBuildingId) return;

    const building = project.buildings.find(b => b.id === selectedBuildingId);
    if (!building) return;

    const newFloor: Floor = {
      id: `floor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Patro ${building.floors.length + 1}`,
      elevation: building.floors.length * 3,
      rooms: []
    };

    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.map(b =>
        b.id === selectedBuildingId
          ? { ...b, floors: [...b.floors, newFloor] }
          : b
      )
    }));
    setSelectedFloorId(newFloor.id);
  };

  const removeFloor = (floorId: string) => {
    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        floors: b.floors.filter(f => f.id !== floorId)
      }))
    }));
    if (selectedFloorId === floorId) {
      setSelectedFloorId(null);
      setSelectedRoomId(null);
    }
  };

  const updateFloor = (floorId: string, field: keyof Floor, value: string | number) => {
    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        floors: b.floors.map(f =>
          f.id === floorId ? { ...f, [field]: value } : f
        )
      }))
    }));
  };

  const addRoom = () => {
    if (!selectedFloorId) return;

    const floor = selectedBuilding?.floors.find(f => f.id === selectedFloorId);
    if (!floor) return;

    const newRoom: Room = {
      id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Místnost ${floor.rooms.length + 1}`,
      positionX: 0,
      positionY: 0,
      width: 5,
      length: 5,
      height: 3,
      windows: []
    };

    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        floors: b.floors.map(f =>
          f.id === selectedFloorId
            ? { ...f, rooms: [...f.rooms, newRoom] }
            : f
        )
      }))
    }));
    setSelectedRoomId(newRoom.id);
  };

  const removeRoom = (roomId: string) => {
    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        floors: b.floors.map(f => ({
          ...f,
          rooms: f.rooms.filter(r => r.id !== roomId)
        }))
      }))
    }));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
  };

  const updateRoom = (roomId: string, field: keyof Room, value: string | number) => {
    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        floors: b.floors.map(f => ({
          ...f,
          rooms: f.rooms.map(r =>
            r.id === roomId ? { ...r, [field]: value } : r
          )
        }))
      }))
    }));
  };

  const addWindow = () => {
    if (!selectedRoomId) return;

    const newWindow: Window = {
      id: `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      width: 1.5,
      height: 1.5,
      positionX: 1,
      positionZ: 1,
      wall: 'north'
    };

    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        floors: b.floors.map(f => ({
          ...f,
          rooms: f.rooms.map(r =>
            r.id === selectedRoomId
              ? { ...r, windows: [...r.windows, newWindow] }
              : r
          )
        }))
      }))
    }));
  };

  const removeWindow = (windowId: string) => {
    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        floors: b.floors.map(f => ({
          ...f,
          rooms: f.rooms.map(r => ({
            ...r,
            windows: r.windows.filter(w => w.id !== windowId)
          }))
        }))
      }))
    }));
  };

  const updateWindow = (windowId: string, field: keyof Window, value: string | number) => {
    setProject(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => ({
        ...b,
        floors: b.floors.map(f => ({
          ...f,
          rooms: f.rooms.map(r => ({
            ...r,
            windows: r.windows.map(w =>
              w.id === windowId ? { ...w, [field]: value } : w
            )
          }))
        }))
      }))
    }));
  };

  const exportHBJSON = () => {
    const json = HBJSONGenerator.exportToJSON(project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.hbjson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="hbjson-builder">
      <div className="builder-header">
        <h2>{project.name}</h2>
        <button onClick={exportHBJSON} className="btn-export">
          Exportovat HBJSON
        </button>
      </div>

      <div className="builder-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <LocationForm location={project.location} onUpdateLocation={updateLocation} />
          <BuildingList
            buildings={project.buildings}
            selectedBuilding={selectedBuildingId}
            onSelectBuilding={setSelectedBuildingId}
            onAddBuilding={addBuilding}
            onRemoveBuilding={removeBuilding}
            onUpdateBuilding={updateBuilding}
          />
        </div>

        {selectedBuilding && (
          <FloorList
            buildingId={selectedBuildingId!}
            floors={selectedBuilding.floors}
            selectedFloor={selectedFloorId}
            onSelectFloor={setSelectedFloorId}
            onAddFloor={addFloor}
            onRemoveFloor={removeFloor}
            onUpdateFloor={updateFloor}
          />
        )}

        {selectedFloor && (
          <RoomList
            floorId={selectedFloorId!}
            rooms={selectedFloor.rooms}
            selectedRoom={selectedRoomId}
            onSelectRoom={setSelectedRoomId}
            onAddRoom={addRoom}
            onRemoveRoom={removeRoom}
            onUpdateRoom={updateRoom}
          />
        )}

        {selectedRoom && (
          <div className="builder-section">
            <div className="builder-section-header">
              <h3>Detail místnosti</h3>
            </div>
            <div className="builder-form">
              <div className="builder-info">
                <strong>{selectedRoom.name}</strong><br />
                Rozměry: {selectedRoom.width}×{selectedRoom.length}×{selectedRoom.height}m<br />
                Plocha: {(selectedRoom.width * selectedRoom.length).toFixed(1)}m²<br />
                Objem: {(selectedRoom.width * selectedRoom.length * selectedRoom.height).toFixed(1)}m³
              </div>

              <WindowList
                roomId={selectedRoomId!}
                windows={selectedRoom.windows}
                onAddWindow={addWindow}
                onRemoveWindow={removeWindow}
                onUpdateWindow={updateWindow}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HBJSONBuilder;