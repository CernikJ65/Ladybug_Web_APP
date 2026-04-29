import * as THREE from 'three';

export interface SceneSetupResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  ground: THREE.Mesh;
  grid: THREE.GridHelper;
}

export function createScene(container: HTMLDivElement, cameraTarget: THREE.Vector3): SceneSetupResult {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 2000, 6000);

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.5, 15000);
  camera.position.set(500, 300, 500);
  camera.lookAt(cameraTarget);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(500, 800, 500); sun.castShadow = true;
  sun.shadow.camera.left = -1000; sun.shadow.camera.right = 1000;
  sun.shadow.camera.top = 1000; sun.shadow.camera.bottom = -1000;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.28);
  fill.position.set(-400, 200, -400); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0x888888, 0x444444, 0.28));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x0a0a0a, side: THREE.DoubleSide }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(2000, 100, 0x333333, 0x1a1a1a);
  grid.position.y = 0.1; scene.add(grid);

  return { scene, camera, renderer, ground, grid };
}
