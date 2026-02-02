import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import './HbjsonViewer.css';

interface Building {
  id: number;
  meshIndices: number[];
  center: THREE.Vector3;
  totalArea: number;
  minHeight: number;
  maxHeight: number;
  height: number;
  color: number;
}

interface ModelStats {
  name: string;
  faceCount: number;
  buildingCount: number;
  dimensions: { x: number; y: number; z: number };
  totalArea: number;
}

interface ShadeGeometry {
  type: string;
  boundary: number[][];
}

interface Shade {
  geometry: ShadeGeometry;
  identifier?: string;
}

interface HBFace {
  type: string;
  identifier: string;
  geometry: ShadeGeometry;
  face_type?: string;
}

interface HBRoom {
  type: string;
  identifier: string;
  display_name?: string;
  faces: HBFace[];
}

interface HBJSONData {
  display_name?: string;
  orphaned_shades?: Shade[];
  shades?: Shade[];
  rooms?: HBRoom[];
}

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const BUILDING_COLORS = [
  0x4a90e2, 0xe24a4a, 0x4ae290, 0xe2904a, 0x904ae2,
  0xe24a90, 0x4ae24a, 0x4a4ae2, 0xe2e24a, 0x4ae2e2,
  0xe24ae2, 0x90e24a, 0x4a90e2, 0xe2904a, 0x904ae2
] as const;

const HbjsonViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const groundRef = useRef<THREE.Mesh | null>(null);
  
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const wireframesRef = useRef<THREE.LineSegments[]>([]);
  const buildingsRef = useRef<Building[]>([]);
  const selectedBuildingRef = useRef<Building | null>(null);
  const hoveredBuildingRef = useRef<number | null>(null);
  
  const selectedMeshIndicesRef = useRef<Set<number>>(new Set());
  const isBoxSelectingRef = useRef(false);
  const selectionBoxRef = useRef<SelectionBox | null>(null);
  const selectionBoxElementRef = useRef<HTMLDivElement | null>(null);
  const originalHbjsonDataRef = useRef<HBJSONData | null>(null);
  
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const cameraTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const targetZoomDistanceRef = useRef(500);
  
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const previousMouseRef = useRef({ x: 0, y: 0 });
  const mouseDownTimeRef = useRef(0);
  const initialCameraPosRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const hasAutoLoadedRef = useRef(false);
  const lastRaycastTimeRef = useRef(0);
  const isPointerVisibleRef = useRef(false);
  const keysPressed = useRef<Set<string>>(new Set());
  
  const visualizeModelFnRef = useRef<((data: HBJSONData) => void) | null>(null);
  const selectBuildingByIdFnRef = useRef<((id: number) => void) | null>(null);
  const resetSelectionFnRef = useRef<(() => void) | null>(null);
  const detectBuildingsFnRef = useRef<(() => void) | null>(null);
  const exportSelectedFnRef = useRef<(() => void) | null>(null);
  
  const interactionModeRef = useRef<'building' | 'rotate'>('building');
  const highlightHoverRef = useRef(true);
  const opacityRef = useRef(80);
  const buildingDistanceRef = useRef(5);
  
  const [renderMode, setRenderMode] = useState<'solid' | 'wireframe' | 'both'>('solid');
  const [interactionMode, setInteractionMode] = useState<'building' | 'rotate'>('building');
  const [opacity, setOpacity] = useState(80);
  const [buildingDistance, setBuildingDistance] = useState(5);
  const [showGrid, setShowGrid] = useState(true);
  const [showShadows, setShowShadows] = useState(true);
  const [highlightHover, setHighlightHover] = useState(true);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [selectedBuildingInfo, setSelectedBuildingInfo] = useState<Building | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMeshCount, setSelectedMeshCount] = useState(0);

  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);

  useEffect(() => {
    highlightHoverRef.current = highlightHover;
  }, [highlightHover]);

  useEffect(() => {
    opacityRef.current = opacity;
  }, [opacity]);

  useEffect(() => {
    buildingDistanceRef.current = buildingDistance;
  }, [buildingDistance]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let isMounted = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 2000, 6000);
    sceneRef.current = scene;

    raycasterRef.current.params.Line = raycasterRef.current.params.Line || {};
    raycasterRef.current.params.Line.threshold = 1.0;
    raycasterRef.current.params.Points = raycasterRef.current.params.Points || {};
    raycasterRef.current.params.Points.threshold = 1.0;
    raycasterRef.current.near = 0;
    raycasterRef.current.far = Infinity;

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      1,
      10000
    );
    camera.position.set(500, 300, 500);
    camera.lookAt(cameraTargetRef.current);
    cameraRef.current = camera;
    targetZoomDistanceRef.current = camera.position.distanceTo(cameraTargetRef.current);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(500, 800, 500);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -1000;
    sunLight.shadow.camera.right = 1000;
    sunLight.shadow.camera.top = 1000;
    sunLight.shadow.camera.bottom = -1000;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-500, 300, -500);
    scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0x888888, 0x444444, 0.4);
    scene.add(hemiLight);

    const groundGeometry = new THREE.PlaneGeometry(5000, 5000);
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: 0x0a0a0a,
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    groundRef.current = ground;

    const grid = new THREE.GridHelper(2000, 100, 0x333333, 0x1a1a1a);
    grid.position.y = 0.1;
    scene.add(grid);
    gridRef.current = grid;

    const model = new THREE.Group();
    scene.add(model);
    modelRef.current = model;

    const selectionBoxEl = document.createElement('div');
    selectionBoxEl.style.position = 'absolute';
    selectionBoxEl.style.border = '2px solid #2563eb';
    selectionBoxEl.style.background = 'rgba(37, 99, 235, 0.1)';
    selectionBoxEl.style.pointerEvents = 'none';
    selectionBoxEl.style.display = 'none';
    selectionBoxEl.style.zIndex = '100';
    container.appendChild(selectionBoxEl);
    selectionBoxElementRef.current = selectionBoxEl;

    const getWorldVertices = (mesh: THREE.Mesh): THREE.Vector3[] => {
      const vertices: THREE.Vector3[] = [];
      const pos = mesh.geometry.attributes.position;

      for (let i = 0; i < pos.count; i++) {
        const vertex = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        mesh.localToWorld(vertex);
        vertices.push(vertex);
      }

      return vertices;
    };

    const createAdjacencyGraph = (threshold: number): Map<number, number[]> => {
      const graph = new Map<number, number[]>();

      for (let i = 0; i < meshesRef.current.length; i++) {
        const mesh1 = meshesRef.current[i];
        const vertices1 = getWorldVertices(mesh1);

        for (let j = i + 1; j < meshesRef.current.length; j++) {
          const mesh2 = meshesRef.current[j];

          const dx = (mesh1.userData.centerX as number) - (mesh2.userData.centerX as number);
          const dy = (mesh1.userData.centerY as number) - (mesh2.userData.centerY as number);
          const centerDist = Math.sqrt(dx * dx + dy * dy);

          if (centerDist > threshold * 3) continue;

          const vertices2 = getWorldVertices(mesh2);
          let hasConnection = false;

          for (const v1 of vertices1) {
            for (const v2 of vertices2) {
              const dist = Math.sqrt(
                Math.pow(v1.x - v2.x, 2) + Math.pow(v1.z - v2.z, 2)
              );
              const heightDiff = Math.abs(v1.y - v2.y);

              if (dist < threshold * 0.2 && heightDiff < 15) {
                hasConnection = true;
                break;
              }
            }
            if (hasConnection) break;
          }

          if (hasConnection) {
            if (!graph.has(i)) graph.set(i, []);
            if (!graph.has(j)) graph.set(j, []);
            graph.get(i)!.push(j);
            graph.get(j)!.push(i);
          }
        }
      }

      return graph;
    };

    const detectBuildings = () => {
      const threshold = buildingDistanceRef.current;
      buildingsRef.current = [];

      meshesRef.current.forEach(mesh => {
        mesh.userData.buildingId = null;
      });

      const adjacencyGraph = createAdjacencyGraph(threshold);
      const visited = new Set<number>();

      meshesRef.current.forEach((_, idx) => {
        if (visited.has(idx)) return;

        const building: Building = {
          id: buildingsRef.current.length,
          meshIndices: [],
          center: new THREE.Vector3(),
          totalArea: 0,
          minHeight: Infinity,
          maxHeight: -Infinity,
          height: 0,
          color: BUILDING_COLORS[buildingsRef.current.length % BUILDING_COLORS.length]
        };

        const stack = [idx];
        visited.add(idx);

        while (stack.length > 0) {
          const currentIdx = stack.pop()!;
          building.meshIndices.push(currentIdx);

          const neighbors = adjacencyGraph.get(currentIdx) || [];
          neighbors.forEach(neighborIdx => {
            if (!visited.has(neighborIdx)) {
              visited.add(neighborIdx);
              stack.push(neighborIdx);
            }
          });
        }

        building.meshIndices.forEach(meshIdx => {
          const mesh = meshesRef.current[meshIdx];
          mesh.userData.buildingId = building.id;
          building.center.x += mesh.userData.centerX as number;
          building.center.y += mesh.userData.centerY as number;
          building.center.z += mesh.userData.centerZ as number;
          building.totalArea += mesh.userData.area as number;
          building.minHeight = Math.min(building.minHeight, mesh.userData.centerZ as number);
          building.maxHeight = Math.max(building.maxHeight, mesh.userData.centerZ as number);
        });

        building.center.divideScalar(building.meshIndices.length);
        building.height = building.maxHeight - building.minHeight;

        buildingsRef.current.push(building);
      });

      buildingsRef.current.forEach(building => {
        building.meshIndices.forEach(meshIdx => {
          meshesRef.current[meshIdx].userData.buildingColor = building.color;
        });
      });

      setBuildings([...buildingsRef.current]);
    };

    const visualizeModelInner = (data: HBJSONData) => {
      originalHbjsonDataRef.current = data;
      
      meshesRef.current.forEach(mesh => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        model.remove(mesh);
      });
      wireframesRef.current.forEach(wf => {
        wf.geometry.dispose();
        (wf.material as THREE.Material).dispose();
        model.remove(wf);
      });
      
      const mergedMesh = model.getObjectByName('mergedModel');
      if (mergedMesh) {
        (mergedMesh as THREE.Mesh).geometry.dispose();
        ((mergedMesh as THREE.Mesh).material as THREE.Material).dispose();
        model.remove(mergedMesh);
      }
      
      meshesRef.current = [];
      wireframesRef.current = [];
      buildingsRef.current = [];
      selectedBuildingRef.current = null;
      hoveredBuildingRef.current = null;
      selectedMeshIndicesRef.current.clear();
      setSelectedMeshCount(0);

      const shades = data.orphaned_shades || data.shades || [];
      const faces: Shade[] = [];

      if (data.rooms && data.rooms.length > 0) {
        data.rooms.forEach((room) => {
          room.faces.forEach((face) => {
            faces.push({
              geometry: face.geometry,
              identifier: face.identifier
            } as Shade);
          });
        });
      }

      const allShapes = [...shades, ...faces];

      if (allShapes.length === 0) {
        setStats(null);
        return;
      }

      let minZ = Infinity, maxZ = -Infinity;
      allShapes.forEach((shade: Shade) => {
        const geom = shade.geometry;
        if (!geom || geom.type !== 'Face3D' || !geom.boundary) return;
        geom.boundary.forEach((coord: number[]) => {
          minZ = Math.min(minZ, coord[2]);
          maxZ = Math.max(maxZ, coord[2]);
        });
      });

      let count = 0;
      let totalArea = 0;

      allShapes.forEach((shade: Shade, idx: number) => {
        const geom = shade.geometry;
        if (!geom || geom.type !== 'Face3D' || !geom.boundary) return;

        const boundary = geom.boundary;
        if (boundary.length < 3) return;

        const vertices: THREE.Vector3[] = [];
        boundary.forEach((coord: number[]) => {
          vertices.push(new THREE.Vector3(coord[0], coord[2], -coord[1]));
        });

        const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
        const indices: number[] = [];
        for (let i = 1; i < vertices.length - 1; i++) {
          indices.push(0, i, i + 1);
        }
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        let area = 0;
        for (let i = 1; i < vertices.length - 1; i++) {
          const v1 = vertices[i].clone().sub(vertices[0]);
          const v2 = vertices[i + 1].clone().sub(vertices[0]);
          area += v1.cross(v2).length() / 2;
        }
        totalArea += area;

        let centerX = 0, centerY = 0, centerZ = 0;
        boundary.forEach((coord: number[]) => {
          centerX += coord[0];
          centerY += coord[1];
          centerZ += coord[2];
        });
        centerX /= boundary.length;
        centerY /= boundary.length;
        centerZ /= boundary.length;

        const avgZ = centerZ;
        const t = (avgZ - minZ) / (maxZ - minZ + 0.001);
        const lightness = 0.45 + t * 0.35;
        const color = new THREE.Color().setHSL(0, 0, lightness);

        const currentOpacity = opacityRef.current / 100;
        const material = new THREE.MeshLambertMaterial({
          color: color,
          side: THREE.DoubleSide,
          transparent: currentOpacity < 1.0,
          opacity: currentOpacity
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          originalColor: color.getHex(),
          shadeIndex: idx,
          shadeId: shade.identifier,
          centerX,
          centerY,
          centerZ,
          area,
          buildingId: null
        };
        model.add(mesh);
        meshesRef.current.push(mesh);

        const wireframeGeo = new THREE.EdgesGeometry(geometry);
        const wireframeMat = new THREE.LineBasicMaterial({
          color: 0x888888,
          transparent: true,
          opacity: 0.3
        });
        const wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
        wireframe.visible = false;
        model.add(wireframe);
        wireframesRef.current.push(wireframe);

        count++;
      });

      if (count > 500) {
        console.log(`Merging ${count} geometries`);
        
        if (count > 3000) {
          setHighlightHover(false);
        }
        
        const mergedGeometry = new THREE.BufferGeometry();
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        let vertexOffset = 0;

        meshesRef.current.forEach((mesh) => {
          const geom = mesh.geometry;
          const pos = geom.attributes.position;
          const norm = geom.attributes.normal;
          const color = (mesh.material as THREE.MeshLambertMaterial).color;
          
          for (let i = 0; i < pos.count; i++) {
            positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
            normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
            colors.push(color.r, color.g, color.b);
          }
          
          const idx = geom.index;
          if (idx) {
            for (let i = 0; i < idx.count; i++) {
              indices.push(idx.getX(i) + vertexOffset);
            }
          }
          
          vertexOffset += pos.count;
          mesh.visible = false;
        });

        mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        mergedGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        mergedGeometry.setIndex(indices);

        const currentOpacity = opacityRef.current / 100;
        const mergedMaterial = new THREE.MeshLambertMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          transparent: currentOpacity < 1.0,
          opacity: currentOpacity
        });

        const mergedMesh = new THREE.Mesh(mergedGeometry, mergedMaterial);
        mergedMesh.castShadow = count <= 1000;
        mergedMesh.receiveShadow = count <= 1000;
        mergedMesh.name = 'mergedModel';
        model.add(mergedMesh);
      }

      detectBuildings();

      if (count > 1000) {
        renderer.shadowMap.enabled = false;
        meshesRef.current.forEach(mesh => {
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        });
      }

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const dist = maxDim / (2 * Math.tan(fov / 2)) * 1.8;

      cameraTargetRef.current.copy(center);

      if (groundRef.current) groundRef.current.position.y = box.min.y - 1;
      if (gridRef.current) gridRef.current.position.y = box.min.y - 0.9;

      const angle = Math.PI / 4;
      camera.position.set(
        center.x + dist * Math.cos(angle),
        center.y + dist * 0.6,
        center.z + dist * Math.sin(angle)
      );
      camera.lookAt(cameraTargetRef.current);

      targetZoomDistanceRef.current = camera.position.distanceTo(cameraTargetRef.current);

      initialCameraPosRef.current = {
        pos: camera.position.clone(),
        target: cameraTargetRef.current.clone()
      };

      setStats({
        name: data.display_name || 'Model',
        faceCount: count,
        buildingCount: buildingsRef.current.length,
        dimensions: { x: size.x, y: size.y, z: size.z },
        totalArea
      });
    };

    const selectBuildingByIdInner = (buildingId: number) => {
      if (selectedBuildingRef.current) {
        const prevBuilding = selectedBuildingRef.current;
        prevBuilding.meshIndices.forEach(meshIdx => {
          const mesh = meshesRef.current[meshIdx];
          const material = mesh.material as THREE.MeshLambertMaterial;
          material.color.setHex(mesh.userData.originalColor as number);
          material.emissive = new THREE.Color(0x000000);
          material.emissiveIntensity = 0;
          
          const mergedMesh = model.getObjectByName('mergedModel');
          if (mergedMesh) {
            mesh.visible = false;
          }
        });
      }

      selectedBuildingRef.current = buildingsRef.current.find(b => b.id === buildingId) || null;
      if (!selectedBuildingRef.current) {
        setSelectedBuildingInfo(null);
        return;
      }

      const building = selectedBuildingRef.current;

      building.meshIndices.forEach(meshIdx => {
        const mesh = meshesRef.current[meshIdx];
        const material = mesh.material as THREE.MeshLambertMaterial;
        
        const highlightColor = new THREE.Color(0xff6600);
        material.color.set(highlightColor);
        material.emissive.set(0xff3300);
        material.emissiveIntensity = 0.8;
        
        mesh.visible = true;
      });

      setSelectedBuildingInfo(building);
    };

    const resetSelectionInner = () => {
      selectedMeshIndicesRef.current.forEach(meshIdx => {
        const mesh = meshesRef.current[meshIdx];
        const material = mesh.material as THREE.MeshLambertMaterial;
        material.color.setHex(mesh.userData.originalColor as number);
        material.emissive = new THREE.Color(0x000000);
        material.emissiveIntensity = 0;
        
        const mergedMesh = model.getObjectByName('mergedModel');
        if (mergedMesh) {
          mesh.visible = false;
        }
      });
      selectedMeshIndicesRef.current.clear();
      setSelectedMeshCount(0);
      
      if (selectedBuildingRef.current) {
        const building = selectedBuildingRef.current;
        building.meshIndices.forEach(meshIdx => {
          const mesh = meshesRef.current[meshIdx];
          const material = mesh.material as THREE.MeshLambertMaterial;
          material.color.setHex(mesh.userData.originalColor as number);
          material.emissive = new THREE.Color(0x000000);
          material.emissiveIntensity = 0;
          
          const mergedMesh = model.getObjectByName('mergedModel');
          if (mergedMesh) {
            mesh.visible = false;
          }
        });
      }

      selectedBuildingRef.current = null;
      setSelectedBuildingInfo(null);
    };

    const resetViewInner = () => {
      if (initialCameraPosRef.current) {
        camera.position.copy(initialCameraPosRef.current.pos);
        cameraTargetRef.current.copy(initialCameraPosRef.current.target);
        camera.lookAt(cameraTargetRef.current);
        targetZoomDistanceRef.current = camera.position.distanceTo(cameraTargetRef.current);
      }
    };

    const performBoxSelection = () => {
      if (!selectionBoxRef.current) return;

      const box = selectionBoxRef.current;
      const minX = Math.min(box.startX, box.endX);
      const maxX = Math.max(box.startX, box.endX);
      const minY = Math.min(box.startY, box.endY);
      const maxY = Math.max(box.startY, box.endY);

      const width = container.clientWidth;
      const height = container.clientHeight;

      const newSelection = new Set<number>();

      const mergedMesh = model.getObjectByName('mergedModel') as THREE.Mesh | undefined;
      const wasMergedVisible = mergedMesh?.visible || false;
      if (mergedMesh) {
        mergedMesh.visible = false;
      }

      meshesRef.current.forEach((mesh, meshIdx) => {
        const wasVisible = mesh.visible;
        mesh.visible = true;

        const center = new THREE.Vector3(
          mesh.userData.centerX as number,
          mesh.userData.centerZ as number,
          -(mesh.userData.centerY as number)
        );

        const projected = center.clone().project(camera);
        const screenX = (projected.x + 1) / 2 * width;
        const screenY = (-projected.y + 1) / 2 * height;

        if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
          newSelection.add(meshIdx);
        }

        mesh.visible = wasVisible;
      });

      if (mergedMesh) {
        mergedMesh.visible = wasMergedVisible;
      }

      selectedMeshIndicesRef.current.forEach(meshIdx => {
        const mesh = meshesRef.current[meshIdx];
        const material = mesh.material as THREE.MeshLambertMaterial;
        material.color.setHex(mesh.userData.originalColor as number);
        material.emissive = new THREE.Color(0x000000);
        material.emissiveIntensity = 0;
        
        if (mergedMesh) {
          mesh.visible = false;
        }
      });

      selectedMeshIndicesRef.current = newSelection;
      setSelectedMeshCount(newSelection.size);

      newSelection.forEach(meshIdx => {
        const mesh = meshesRef.current[meshIdx];
        const material = mesh.material as THREE.MeshLambertMaterial;
        
        const highlightColor = new THREE.Color(0x9333ea);
        material.color.set(highlightColor);
        material.emissive.set(0x7c3aed);
        material.emissiveIntensity = 0.7;
        
        mesh.visible = true;
      });
    };

    const exportSelectedInner = () => {
      if (!originalHbjsonDataRef.current) {
        alert('Nejsou dostupná data pro export');
        return;
      }

      let meshIndicesToExport: number[] = [];

      if (selectedMeshIndicesRef.current.size > 0) {
        meshIndicesToExport = Array.from(selectedMeshIndicesRef.current);
      } else if (selectedBuildingRef.current) {
        meshIndicesToExport = selectedBuildingRef.current.meshIndices;
      } else {
        alert('Není vybrána žádná oblast');
        return;
      }

      const selectedShadeIndices = new Set<number>();
      meshIndicesToExport.forEach(meshIdx => {
        const mesh = meshesRef.current[meshIdx];
        const shadeIndex = mesh.userData.shadeIndex as number;
        if (shadeIndex !== undefined) {
          selectedShadeIndices.add(shadeIndex);
        }
      });

      const originalShades = originalHbjsonDataRef.current.orphaned_shades || originalHbjsonDataRef.current.shades || [];
      const selectedShades = originalShades.filter((_, idx) => selectedShadeIndices.has(idx));

      if (selectedShades.length === 0) {
        alert('Nebyla nalezena žádná data pro export');
        return;
      }

      const exportData: HBJSONData = {
        ...originalHbjsonDataRef.current,
        display_name: `${originalHbjsonDataRef.current.display_name || 'Model'}_export_${selectedShades.length}_faces`,
        orphaned_shades: selectedShades,
        shades: undefined
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${selectedShades.length}_faces.hbjson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    visualizeModelFnRef.current = visualizeModelInner;
    selectBuildingByIdFnRef.current = selectBuildingByIdInner;
    resetSelectionFnRef.current = resetSelectionInner;
    detectBuildingsFnRef.current = detectBuildings;
    exportSelectedFnRef.current = exportSelectedInner;

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (keysPressed.current.size > 0) {
        const panSpeed = Math.max(2, camera.position.distanceTo(cameraTargetRef.current) * 0.01);
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        
        const right = new THREE.Vector3();
        right.crossVectors(camera.up, direction).normalize();
        
        const panOffset = new THREE.Vector3();
        
        if (keysPressed.current.has('arrowright') || keysPressed.current.has('d')) {
          panOffset.add(right.clone().multiplyScalar(panSpeed));
        }
        if (keysPressed.current.has('arrowleft') || keysPressed.current.has('a')) {
          panOffset.add(right.clone().multiplyScalar(-panSpeed));
        }
        if (keysPressed.current.has('arrowup') || keysPressed.current.has('w')) {
          panOffset.add(camera.up.clone().multiplyScalar(panSpeed));
        }
        if (keysPressed.current.has('arrowdown') || keysPressed.current.has('s')) {
          panOffset.add(camera.up.clone().multiplyScalar(-panSpeed));
        }
        
        cameraTargetRef.current.add(panOffset);
        camera.position.add(panOffset);
      }

      const currentDist = camera.position.distanceTo(cameraTargetRef.current);
      if (Math.abs(currentDist - targetZoomDistanceRef.current) > 0.1) {
        const newDist = THREE.MathUtils.lerp(currentDist, targetZoomDistanceRef.current, 0.1);
        const direction = camera.position.clone().sub(cameraTargetRef.current).normalize();
        camera.position.copy(cameraTargetRef.current).add(direction.multiplyScalar(newDist));
      }

      renderer.render(scene, camera);
    };
    animate();

    const highlightBuilding = (buildingId: number | null) => {
      if (buildingId === null || selectedBuildingRef.current || selectedMeshIndicesRef.current.size > 0) return;

      const building = buildingsRef.current.find(b => b.id === buildingId);
      if (!building) return;

      building.meshIndices.forEach(meshIdx => {
        const mesh = meshesRef.current[meshIdx];
        const material = mesh.material as THREE.MeshLambertMaterial;
        
        const hoverColor = new THREE.Color(0xffff00);
        material.color.set(hoverColor);
        material.emissive.set(0xffaa00);
        material.emissiveIntensity = 0.5;
        
        mesh.visible = true;
      });
    };

    const unhighlightBuilding = (buildingId: number | null) => {
      if (buildingId === null || selectedBuildingRef.current || selectedMeshIndicesRef.current.size > 0) return;

      const building = buildingsRef.current.find(b => b.id === buildingId);
      if (!building) return;

      building.meshIndices.forEach(meshIdx => {
        const mesh = meshesRef.current[meshIdx];
        const material = mesh.material as THREE.MeshLambertMaterial;
        
        material.color.setHex(mesh.userData.originalColor as number);
        material.emissive = new THREE.Color(0x000000);
        material.emissiveIntensity = 0;
        
        const mergedMesh = model.getObjectByName('mergedModel');
        if (mergedMesh) {
          mesh.visible = false;
        }
      });
    };

    const canvas = renderer.domElement;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && e.shiftKey && interactionModeRef.current === 'building') {
        isBoxSelectingRef.current = true;
        selectionBoxRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          endX: e.clientX,
          endY: e.clientY
        };
        
        if (selectionBoxElementRef.current) {
          selectionBoxElementRef.current.style.display = 'block';
          selectionBoxElementRef.current.style.left = e.clientX + 'px';
          selectionBoxElementRef.current.style.top = e.clientY + 'px';
          selectionBoxElementRef.current.style.width = '0px';
          selectionBoxElementRef.current.style.height = '0px';
        }
        
        e.preventDefault();
        return;
      }

      isDraggingRef.current = true;
      isPanningRef.current = e.button === 2;
      mouseDownTimeRef.current = Date.now();
      previousMouseRef.current = { x: e.clientX, y: e.clientY };
      canvas.classList.add('grabbing');
      targetZoomDistanceRef.current = camera.position.distanceTo(cameraTargetRef.current);
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isBoxSelectingRef.current && selectionBoxRef.current && selectionBoxElementRef.current) {
        selectionBoxRef.current.endX = e.clientX;
        selectionBoxRef.current.endY = e.clientY;
        
        const startX = selectionBoxRef.current.startX;
        const startY = selectionBoxRef.current.startY;
        const endX = selectionBoxRef.current.endX;
        const endY = selectionBoxRef.current.endY;
        
        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        selectionBoxElementRef.current.style.left = left + 'px';
        selectionBoxElementRef.current.style.top = top + 'px';
        selectionBoxElementRef.current.style.width = width + 'px';
        selectionBoxElementRef.current.style.height = height + 'px';
        
        return;
      }

      if (!isDraggingRef.current && interactionModeRef.current === 'building' && highlightHoverRef.current) {
        const now = Date.now();
        if (now - lastRaycastTimeRef.current > 100) {
          lastRaycastTimeRef.current = now;
          
          mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
          mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;

          raycasterRef.current.setFromCamera(mouseRef.current, camera);
          
          const mergedMesh = model.getObjectByName('mergedModel') as THREE.Mesh | undefined;
          const wasMergedVisible = mergedMesh?.visible || false;
          if (mergedMesh) {
            mergedMesh.visible = false;
          }
          
          const raycastTargets = meshesRef.current.length > 2000 
            ? meshesRef.current.slice(0, 2000) 
            : meshesRef.current;
          
          const visibilityStates = new Map<THREE.Mesh, boolean>();
          raycastTargets.forEach(mesh => {
            visibilityStates.set(mesh, mesh.visible);
            mesh.visible = true;
          });
          
          const intersects = raycasterRef.current.intersectObjects(raycastTargets);
          
          raycastTargets.forEach(mesh => {
            mesh.visible = visibilityStates.get(mesh) || false;
          });
          
          if (mergedMesh) {
            mergedMesh.visible = wasMergedVisible;
          }

          if (intersects.length > 0) {
            const hoveredMesh = intersects[0].object as THREE.Mesh;
            const buildingId = hoveredMesh.userData.buildingId as number | null;

            if (buildingId !== hoveredBuildingRef.current) {
              if (hoveredBuildingRef.current !== null) {
                unhighlightBuilding(hoveredBuildingRef.current);
              }
              hoveredBuildingRef.current = buildingId;
              highlightBuilding(buildingId);
              
              if (!isPointerVisibleRef.current) {
                canvas.classList.add('pointer');
                isPointerVisibleRef.current = true;
              }
            }
          } else {
            if (hoveredBuildingRef.current !== null) {
              unhighlightBuilding(hoveredBuildingRef.current);
              hoveredBuildingRef.current = null;
              
              if (isPointerVisibleRef.current) {
                canvas.classList.remove('pointer');
                isPointerVisibleRef.current = false;
              }
            }
          }
        }
      }

      if (!isDraggingRef.current) return;

      const dx = e.clientX - previousMouseRef.current.x;
      const dy = e.clientY - previousMouseRef.current.y;

      if (isPanningRef.current) {
        const panSpeed = Math.max(0.5, camera.position.distanceTo(cameraTargetRef.current) * 0.001);
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        const right = new THREE.Vector3();
        right.crossVectors(camera.up, direction).normalize();

        const panOffset = right.clone().multiplyScalar(-dx * panSpeed);
        panOffset.add(camera.up.clone().multiplyScalar(dy * panSpeed));

        cameraTargetRef.current.add(panOffset);
        camera.position.add(panOffset);
      } else {
        const offset = camera.position.clone().sub(cameraTargetRef.current);
        const spherical = new THREE.Spherical().setFromVector3(offset);

        spherical.theta -= dx * 0.01;
        spherical.phi += dy * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

        offset.setFromSpherical(spherical);
        camera.position.copy(cameraTargetRef.current).add(offset);
      }

      camera.lookAt(cameraTargetRef.current);
      previousMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      if (isBoxSelectingRef.current) {
        performBoxSelection();
        isBoxSelectingRef.current = false;
        selectionBoxRef.current = null;
        
        if (selectionBoxElementRef.current) {
          selectionBoxElementRef.current.style.display = 'none';
        }
        
        return;
      }

      isDraggingRef.current = false;
      isPanningRef.current = false;
      canvas.classList.remove('grabbing');
    };

    const handleClick = (e: MouseEvent) => {
      if (interactionModeRef.current !== 'building') return;
      if (e.shiftKey) return;

      const timeSinceDown = Date.now() - mouseDownTimeRef.current;
      if (timeSinceDown > 200) return;

      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      
      const mergedMesh = model.getObjectByName('mergedModel') as THREE.Mesh | undefined;
      const wasMergedVisible = mergedMesh?.visible || false;
      if (mergedMesh) {
        mergedMesh.visible = false;
      }
      
      const raycastTargets = meshesRef.current;
      
      const visibilityStates = new Map<THREE.Mesh, boolean>();
      raycastTargets.forEach(mesh => {
        visibilityStates.set(mesh, mesh.visible);
        mesh.visible = true;
      });
      
      const intersects = raycasterRef.current.intersectObjects(raycastTargets);
      
      raycastTargets.forEach(mesh => {
        mesh.visible = visibilityStates.get(mesh) || false;
      });
      
      if (mergedMesh) {
        mergedMesh.visible = wasMergedVisible;
      }

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        const buildingId = clickedMesh.userData.buildingId as number | null;

        if (buildingId !== null) {
          selectBuildingByIdInner(buildingId);
        }
      } else {
        resetSelectionInner();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 40;
      else if (e.deltaMode === 2) delta *= 800;

      const zoomFactor = delta > 0 ? 1.2 : 0.8;
      targetZoomDistanceRef.current *= zoomFactor;
      targetZoomDistanceRef.current = Math.max(10, Math.min(5000, targetZoomDistanceRef.current));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const movementKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
      if (movementKeys.includes(e.key)) {
        keysPressed.current.add(e.key.toLowerCase());
        e.preventDefault();
        return;
      }
      
      if (e.key === 'r' || e.key === 'R') {
        resetViewInner();
      } else if (e.key === 'Escape') {
        resetSelectionInner();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    if (!hasAutoLoadedRef.current) {
      hasAutoLoadedRef.current = true;
      fetch('/mnt/user-data/uploads/Model.hbjson')
        .then(response => response.json())
        .then((data: HBJSONData) => {
          if (isMounted) {
            visualizeModelInner(data);
          }
        })
        .catch(() => {
          if (isMounted) {
            console.log('Model.hbjson nebyl automaticky načten');
          }
        });
    }

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationId);
      
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      renderer.dispose();
      scene.clear();
      
      if (selectionBoxElementRef.current && container.contains(selectionBoxElementRef.current)) {
        container.removeChild(selectionBoxElementRef.current);
      }
      
      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      setTimeout(() => {
        try {
          const data = JSON.parse(event.target?.result as string) as HBJSONData;
          if (visualizeModelFnRef.current) {
            visualizeModelFnRef.current(data);
          }
        } catch (err) {
          const error = err as Error;
          alert('Chyba při načítání: ' + error.message);
        } finally {
          setIsLoading(false);
        }
      }, 100);
    };
    reader.readAsText(file);
  };

  const handleRenderModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value as 'solid' | 'wireframe' | 'both';
    setRenderMode(mode);

    meshesRef.current.forEach((mesh, idx) => {
      mesh.visible = mode !== 'wireframe';
      wireframesRef.current[idx].visible = mode !== 'solid';
    });
  };

  const handleInteractionModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value as 'building' | 'rotate';
    setInteractionMode(mode);
  };

  const handleHighlightHoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHighlightHover(e.target.checked);
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setOpacity(value);
    
    const opacityValue = value / 100;
    const isTransparent = opacityValue < 1.0;
    
    meshesRef.current.forEach(mesh => {
      const material = mesh.material as THREE.MeshLambertMaterial;
      material.opacity = opacityValue;
      material.transparent = isTransparent;
      material.needsUpdate = true;
    });
    
    if (modelRef.current) {
      const mergedMesh = modelRef.current.getObjectByName('mergedModel') as THREE.Mesh;
      if (mergedMesh) {
        const material = mergedMesh.material as THREE.MeshLambertMaterial;
        material.opacity = opacityValue;
        material.transparent = isTransparent;
        material.needsUpdate = true;
      }
    }
  };

  const handleBuildingDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setBuildingDistance(value);

    if (meshesRef.current.length > 0) {
      if (detectBuildingsFnRef.current) {
        detectBuildingsFnRef.current();
      }
      if (resetSelectionFnRef.current) {
        resetSelectionFnRef.current();
      }
    }
  };

  const handleGridToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setShowGrid(checked);
    if (gridRef.current) gridRef.current.visible = checked;
  };

  const handleShadowsToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setShowShadows(checked);
    if (rendererRef.current) rendererRef.current.shadowMap.enabled = checked;
    meshesRef.current.forEach(mesh => {
      mesh.castShadow = checked;
      mesh.receiveShadow = checked;
    });
  };

  const handleExportSelected = () => {
    if (exportSelectedFnRef.current) {
      exportSelectedFnRef.current();
    }
  };

  return (
    <div className="hbjson-viewer">
      <div className="hbjson-viewer__info">
        <h3>HBJSON Model Viewer</h3>

        <div className="hbjson-viewer__file-input">
          <input
            type="file"
            id="fileInput"
            accept=".hbjson,.json"
            onChange={handleFileChange}
          />
          <label htmlFor="fileInput" className="hbjson-viewer__file-label">
            Načíst HBJSON soubor
          </label>
        </div>

        <div className="hbjson-viewer__controls">
          <div className="hbjson-viewer__control-group">
            <label>Režim zobrazení</label>
            <select value={renderMode} onChange={handleRenderModeChange}>
              <option value="solid">Plné plochy</option>
              <option value="wireframe">Drátěný model</option>
              <option value="both">Kombinované</option>
            </select>
          </div>

          <div className="hbjson-viewer__control-group">
            <label>Režim interakce</label>
            <select value={interactionMode} onChange={handleInteractionModeChange}>
              <option value="building">Výběr budov</option>
              <option value="rotate">Rotace pohledu</option>
            </select>
          </div>

          <div className="hbjson-viewer__control-group">
            <label>
              Průhlednost <span className="hbjson-viewer__value">{opacity}%</span>
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={opacity}
              onChange={handleOpacityChange}
            />
          </div>

          <div className="hbjson-viewer__control-group">
            <label>
              Práh vzdálenosti budov <span className="hbjson-viewer__value">{buildingDistance}m</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={buildingDistance}
              onChange={handleBuildingDistanceChange}
            />
          </div>

          <div className="hbjson-viewer__control-group">
            <button onClick={() => resetSelectionFnRef.current?.()}>Zrušit výběr</button>
          </div>
          
          <div className="hbjson-viewer__control-group">
            <button 
              onClick={handleExportSelected}
              disabled={selectedMeshCount === 0 && !selectedBuildingInfo}
              style={{
                opacity: (selectedMeshCount > 0 || selectedBuildingInfo) ? 1 : 0.5,
                cursor: (selectedMeshCount > 0 || selectedBuildingInfo) ? 'pointer' : 'not-allowed'
              }}
            >
              Exportovat vybranou část ({selectedMeshCount > 0 ? `${selectedMeshCount} ploch` : (selectedBuildingInfo ? '1 budova' : '0')})
            </button>
          </div>

          <div className="hbjson-viewer__checkbox">
            <input
              type="checkbox"
              id="gridToggle"
              checked={showGrid}
              onChange={handleGridToggle}
            />
            <label htmlFor="gridToggle">Zobrazit mřížku</label>
          </div>

          <div className="hbjson-viewer__checkbox">
            <input
              type="checkbox"
              id="shadowsToggle"
              checked={showShadows}
              onChange={handleShadowsToggle}
            />
            <label htmlFor="shadowsToggle">Stíny</label>
          </div>

          <div className="hbjson-viewer__checkbox">
            <input
              type="checkbox"
              id="highlightHover"
              checked={highlightHover}
              onChange={handleHighlightHoverChange}
            />
            <label htmlFor="highlightHover">Zvýraznit při najetí</label>
          </div>
        </div>

        {(selectedBuildingInfo || selectedMeshCount > 0) && (
          <div className="hbjson-viewer__selection-info">
            <h4>
              {selectedMeshCount > 0 
                ? `Box Selection: ${selectedMeshCount} ploch`
                : 'Vybraná budova'
              }
            </h4>
            <div>
              {selectedMeshCount > 0 ? (
                <>
                  <strong>Vybraných ploch:</strong> {selectedMeshCount}<br />
                  <strong>Celková plocha:</strong> {
                    Array.from(selectedMeshIndicesRef.current)
                      .reduce((sum, meshIdx) => sum + (meshesRef.current[meshIdx]?.userData.area as number || 0), 0)
                      .toFixed(1)
                  } m²
                </>
              ) : selectedBuildingInfo ? (
                <>
                  <strong>ID budovy:</strong> {selectedBuildingInfo.id + 1}<br />
                  <strong>Počet ploch:</strong> {selectedBuildingInfo.meshIndices.length}<br />
                  <strong>Celková plocha:</strong> {selectedBuildingInfo.totalArea.toFixed(1)} m²<br />
                  <strong>Výška:</strong> {selectedBuildingInfo.height.toFixed(1)} m<br />
                  <strong>Min. výška:</strong> {selectedBuildingInfo.minHeight.toFixed(1)} m<br />
                  <strong>Max. výška:</strong> {selectedBuildingInfo.maxHeight.toFixed(1)} m
                </>
              ) : null}
            </div>
          </div>
        )}

        <div className="hbjson-viewer__stats">
          {stats ? (
            <>
              <strong>Model:</strong> {stats.name}<br />
              <strong>Ploch:</strong> {stats.faceCount.toLocaleString()}<br />
              <strong>Budov:</strong> {stats.buildingCount}<br />
              <strong>Rozměr:</strong> {stats.dimensions.x.toFixed(1)}×{stats.dimensions.z.toFixed(1)}×{stats.dimensions.y.toFixed(1)} m<br />
              <strong>Plocha:</strong> {stats.totalArea.toFixed(0)} m²
            </>
          ) : (
            'Načti HBJSON soubor...'
          )}
        </div>

        {buildings.length > 0 && (
          <div className="hbjson-viewer__building-list-container">
            <h4>Detekované budovy ({buildings.length}):</h4>
            {buildings.length > 100 && (
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                Zobrazeno prvních 100 z {buildings.length} budov
              </div>
            )}
            <div className="hbjson-viewer__building-list">
              {buildings.slice(0, 100).map((building, idx) => (
                <div
                  key={building.id}
                  className={`hbjson-viewer__building-item ${
                    selectedBuildingInfo?.id === building.id ? 'selected' : ''
                  }`}
                  onClick={() => selectBuildingByIdFnRef.current?.(building.id)}
                >
                  <span>Budova {idx + 1} ({building.meshIndices.length} ploch)</span>
                  <div
                    className="hbjson-viewer__building-color"
                    style={{ backgroundColor: `#${building.color.toString(16).padStart(6, '0')}` }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="hbjson-viewer__help">
          <strong>Ovládání:</strong>
          Levé tlačítko = výběr budovy<br />
          <strong style={{color: '#2563eb'}}>Shift + tažení = box select</strong><br />
          Pravé tlačítko = posouvání<br />
          Kolečko = zoom<br />
          Šipky / WASD = pohyb kamery<br />
          R = reset pohledu<br />
          ESC = zrušit výběr
        </div>
      </div>

      {isLoading && (
        <div className="hbjson-viewer__loading">
          <div className="hbjson-viewer__spinner" />
          <div>Načítám model...</div>
        </div>
      )}

      <div ref={containerRef} className="hbjson-viewer__canvas-container" />
    </div>
  );
};

export default HbjsonViewer;