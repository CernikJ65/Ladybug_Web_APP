import * as THREE from 'three';

export interface InputRefs {
  raycaster: React.RefObject<THREE.Raycaster>;
  cameraTarget: React.RefObject<THREE.Vector3>;
  targetZoom: React.RefObject<number>;
  initialCam: React.RefObject<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>;
  isDragging: React.RefObject<boolean>;
  isPanning: React.RefObject<boolean>;
  prevMouse: React.RefObject<{ x: number; y: number }>;
  mouseDownTime: React.RefObject<number>;
  keys: React.RefObject<Set<string>>;
  lastRaycast: React.RefObject<number>;
  isBoxSelecting: React.RefObject<boolean>;
  boxStart: React.RefObject<{ x: number; y: number }>;
  boxEnd: React.RefObject<{ x: number; y: number }>;
  boxEl: React.RefObject<HTMLDivElement | null>;
  highlightHover: React.RefObject<boolean>;
  solidMesh: React.RefObject<THREE.Mesh | null>;
}

export interface InputCallbacks {
  triHitToEntityId: (faceIndex: number) => number;
  doSelectEntity: (id: number, additive: boolean) => void;
  doClearSelection: () => void;
  doHoverEntity: (id: number | null) => void;
  doBoxSelect: () => void;
  resetView: () => void;
}

export function attachInputHandlers(
  scene: THREE.Scene, camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer, container: HTMLDivElement,
  refs: InputRefs, cb: InputCallbacks,
): () => void {
  const canvas = renderer.domElement;

  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 && e.shiftKey) {
      refs.isBoxSelecting.current = true;
      refs.boxStart.current = { x: e.clientX, y: e.clientY };
      refs.boxEnd.current = { x: e.clientX, y: e.clientY };
      if (refs.boxEl.current) { refs.boxEl.current.style.display = 'block'; refs.boxEl.current.style.left = e.clientX + 'px'; refs.boxEl.current.style.top = e.clientY + 'px'; refs.boxEl.current.style.width = '0'; refs.boxEl.current.style.height = '0'; }
      e.preventDefault(); return;
    }
    refs.isDragging.current = true; refs.isPanning.current = e.button === 2;
    refs.mouseDownTime.current = Date.now(); refs.prevMouse.current = { x: e.clientX, y: e.clientY };
    refs.targetZoom.current = camera.position.distanceTo(refs.cameraTarget.current);
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (refs.isBoxSelecting.current && refs.boxEl.current) {
      refs.boxEnd.current = { x: e.clientX, y: e.clientY };
      refs.boxEl.current.style.left = Math.min(refs.boxStart.current.x, e.clientX) + 'px';
      refs.boxEl.current.style.top = Math.min(refs.boxStart.current.y, e.clientY) + 'px';
      refs.boxEl.current.style.width = Math.abs(e.clientX - refs.boxStart.current.x) + 'px';
      refs.boxEl.current.style.height = Math.abs(e.clientY - refs.boxStart.current.y) + 'px';
      return;
    }
    if (!refs.isDragging.current && refs.highlightHover.current && refs.solidMesh.current) {
      const now = Date.now();
      if (now - refs.lastRaycast.current < 80) return;
      refs.lastRaycast.current = now;
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      refs.raycaster.current.setFromCamera(mouse, camera);
      const hits = refs.raycaster.current.intersectObject(refs.solidMesh.current);
      if (hits.length > 0 && hits[0].faceIndex != null) {
        const eid = cb.triHitToEntityId(hits[0].faceIndex!);
        if (eid >= 0) { cb.doHoverEntity(eid); canvas.style.cursor = 'pointer'; return; }
      }
      cb.doHoverEntity(null); canvas.style.cursor = 'grab'; return;
    }
    if (!refs.isDragging.current) return;
    canvas.style.cursor = 'grabbing';
    const dx = e.clientX - refs.prevMouse.current.x, dy = e.clientY - refs.prevMouse.current.y;
    if (refs.isPanning.current) {
      const panSpeed = Math.max(0.5, camera.position.distanceTo(refs.cameraTarget.current) * 0.001);
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const right = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
      const offset = right.clone().multiplyScalar(-dx * panSpeed).add(camera.up.clone().multiplyScalar(dy * panSpeed));
      refs.cameraTarget.current.add(offset); camera.position.add(offset);
    } else {
      const offset = camera.position.clone().sub(refs.cameraTarget.current);
      const sph = new THREE.Spherical().setFromVector3(offset);
      sph.theta -= dx * 0.01; sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + dy * 0.01));
      offset.setFromSpherical(sph); camera.position.copy(refs.cameraTarget.current).add(offset);
    }
    camera.lookAt(refs.cameraTarget.current); refs.prevMouse.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseUp = () => {
    if (refs.isBoxSelecting.current) { cb.doBoxSelect(); refs.isBoxSelecting.current = false; if (refs.boxEl.current) refs.boxEl.current.style.display = 'none'; return; }
    refs.isDragging.current = false; refs.isPanning.current = false; canvas.style.cursor = 'grab';
  };

  const onClick = (e: MouseEvent) => {
    if (e.shiftKey || Date.now() - refs.mouseDownTime.current > 200 || !refs.solidMesh.current) return;
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    refs.raycaster.current.setFromCamera(mouse, camera);
    const hits = refs.raycaster.current.intersectObject(refs.solidMesh.current);
    if (hits.length > 0 && hits[0].faceIndex != null) {
      const eid = cb.triHitToEntityId(hits[0].faceIndex!);
      if (eid >= 0) { cb.doSelectEntity(eid, e.ctrlKey || e.metaKey); return; }
    }
    cb.doClearSelection();
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 40; else if (e.deltaMode === 2) d *= 800;
    refs.targetZoom.current *= d > 0 ? 1.2 : 0.8;
    refs.targetZoom.current = Math.max(10, Math.min(5000, refs.targetZoom.current));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)) { refs.keys.current.add(k); e.preventDefault(); }
    if (k === 'r') cb.resetView();
    if (k === 'escape') cb.doClearSelection();
  };

  const onKeyUp = (e: KeyboardEvent) => { refs.keys.current.delete(e.key.toLowerCase()); };
  const onResize = () => { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); };

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  let animId: number;
  const animate = () => {
    animId = requestAnimationFrame(animate);
    if (refs.keys.current.size > 0) {
      const sp = Math.max(2, camera.position.distanceTo(refs.cameraTarget.current) * 0.01);
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const right = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
      const off = new THREE.Vector3();
      if (refs.keys.current.has('arrowright') || refs.keys.current.has('d')) off.add(right.clone().multiplyScalar(sp));
      if (refs.keys.current.has('arrowleft') || refs.keys.current.has('a')) off.add(right.clone().multiplyScalar(-sp));
      if (refs.keys.current.has('arrowup') || refs.keys.current.has('w')) off.add(camera.up.clone().multiplyScalar(sp));
      if (refs.keys.current.has('arrowdown') || refs.keys.current.has('s')) off.add(camera.up.clone().multiplyScalar(-sp));
      refs.cameraTarget.current.add(off); camera.position.add(off);
    }
    const cur = camera.position.distanceTo(refs.cameraTarget.current);
    if (Math.abs(cur - refs.targetZoom.current) > 0.05) {
      const nd = THREE.MathUtils.lerp(cur, refs.targetZoom.current, 0.1);
      const d = camera.position.clone().sub(refs.cameraTarget.current).normalize();
      camera.position.copy(refs.cameraTarget.current).add(d.multiplyScalar(nd));
    }
    renderer.render(scene, camera);
  };
  animate();

  return () => {
    cancelAnimationFrame(animId);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('wheel', onWheel);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
