import * as THREE from 'three';
import './ui/style.css';
import { buildHouse } from './builders';
import { createOrbit, ORBIT_FOV } from './cameras/orbit';
import { WALK_FOV, WalkController } from './cameras/walk';
import { viewpoints, walkStart } from './data/layout';
import { Lighting } from './lighting/lighting';
import { createMaterials } from './materials/library';
import { TextureLibrary } from './materials/textures';
import { createRenderer } from './render/renderer';
import { createDock, showWebGLError, type Mode } from './ui/dock';
import { Minimap } from './ui/minimap';
import { createPanel } from './ui/panel';

const renderer = createRenderer(document.getElementById('stage')!);
if (!renderer) {
  showWebGLError();
  throw new Error('WebGL 無法啟用');
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(ORBIT_FOV, 1, 0.05, 200);

const textures = new TextureLibrary(renderer);
const materials = createMaterials(textures);
const house = buildHouse(materials);
scene.add(house.build.root, house.ground);
const lights = new Lighting(scene, renderer, materials.mat);

/* ---------- 狀態 ---------- */
let night = true, cut = true, mode: Mode = 'orbit';
// 俯瞰時剖掉 1.45 m 以上的牆
const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.45);

const { orbit, goHome } = createOrbit(camera, renderer.domElement);
const walk = new WalkController(camera, renderer.domElement, house.build.solids, walkStart);
walk.dynamicSolids = house.doors.solids;
createPanel(house.doors);
const minimap = new Minimap(document.getElementById('mapc') as HTMLCanvasElement, house.build.planSegs, walk);

const dock = createDock(viewpoints, {
  setMode,
  setNight,
  toggleCut: () => setCut(!cut),
  jump(v) {
    setMode('walk');
    walk.jumpTo(v);
  },
});

function applyLight(): void {
  lights.apply(night);
  dock.showNight(night);
}
function setNight(v: boolean): void {
  night = v;
  applyLight();
}
function applyCut(): void {
  renderer!.clippingPlanes = mode === 'orbit' && cut ? [clipPlane] : [];
  house.ceiling.visible = mode === 'walk';
  dock.showCut(cut);
}
function setCut(v: boolean): void {
  cut = v;
  applyCut();
}
function setMode(m: Mode): void {
  mode = m;
  orbit.enabled = m === 'orbit';
  walk.enabled = m === 'walk';
  if (m === 'orbit') goHome();
  else camera.fov = WALK_FOV;
  camera.updateProjectionMatrix();
  dock.showMode(m);
  applyCut();
  renderer!.domElement.focus();
}

/* ---------- 迴圈 ---------- */
function resize(): void {
  const w = innerWidth, h = innerHeight;
  renderer!.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let last = performance.now();
function loop(t: number): void {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (mode === 'walk') {
    walk.update(dt);
    minimap.draw();
  } else orbit.update();
  renderer!.render(scene, camera);
  requestAnimationFrame(loop);
}
applyLight();
setMode('orbit');
requestAnimationFrame(loop);

/* ---------- 除錯／比對介面（與參考版 window.__dbg 相同） ---------- */
Object.assign(window, {
  __dbg: { setMode, walk: walk.state, applyLight, setNight, setCut, camera, orbit, setDoor: (id: string, t: number) => house.doors.set(id, t) },
  __app: { THREE, scene, renderer, camera, build: house.build, doors: house.doors, ready: textures.ready },
});
