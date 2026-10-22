import * as THREE from 'three';
import './ui/style.css';
import { buildHouse } from './builders';
import { CURTAIN_PRESETS } from './builders/curtains';
import { createOrbit, ORBIT_FOV } from './cameras/orbit';
import { WALK_FOV, WalkController } from './cameras/walk';
import { viewpoints, walkStart } from './data/layout';
import { Lighting } from './lighting/lighting';
import { createMaterials } from './materials/library';
import { TextureLibrary } from './materials/textures';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EnvProbes } from './render/envProbes';
import { FROSTED_T, hemisphereMean } from './render/hdriGlow';
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
const lights = new Lighting(scene, renderer, materials.mat, house.build.areaLights);
// 每區環境反射探針；日夜切換時發光強度會整體改變的材質不複製
const probes = new EnvProbes(renderer, scene, house.build.root, new Set([materials.mat.glow, materials.mat.glowSoft]));

/* ---------- 窗外景觀（Poly Haven CC0 HDRI；先跑 npm run fetch:hdri） ---------- */
const OUTDOOR = {
  day: { file: 'hotel_rooftop_balcony_4k.hdr', intensity: 1.0, rotation: 0 },
  night: { file: 'shanghai_bund_4k.hdr', intensity: 0.8, rotation: 0 },
} as const;
const hdri: Partial<Record<'day' | 'night', THREE.Texture>> = {};
/** 每片霧面玻璃在日／夜的發光亮度（窗外 HDRI 朝外半球的平均 × 透光率） */
const frostedGlow: Partial<Record<'day' | 'night', THREE.Color[]>> = {};
/** 貼圖與 HDRI 都載入後才拍環境探針 */
let probesReady = false;
/**
 * 換了反射圖的材質要重新編譯；r186 會平行編譯著色器，沒編好的物件那一格直接不畫，
 * 所以編譯期間暫停渲染、保留上一格畫面，避免房子閃一下不見。
 */
let compiling: Promise<void> | null = null;
function compileThenRender(): void {
  const p = renderer!.compileAsync(scene, camera).catch(() => {}).then(() => { if (compiling === p) compiling = null; });
  compiling = p;
}

/* ---------- 狀態 ---------- */
let night = true, cut = true, mode: Mode = 'orbit';
// 俯瞰時剖掉 1.45 m 以上的牆
const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.45);

const { orbit, goHome } = createOrbit(camera, renderer.domElement);
const walk = new WalkController(camera, renderer.domElement, house.build.solids, walkStart);
walk.dynamicSolids = house.doors.solids;
createPanel(house.doors, house.build.curtains);
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

/** 漫遊時窗外用 HDRI（室外地面隱藏）；俯瞰時維持純色背景與地面 */
function applyOutdoor(walkView: boolean): void {
  const key = night ? 'night' : 'day', tex = hdri[key];
  if (walkView && tex) {
    scene.background = tex;
    scene.backgroundIntensity = OUTDOOR[key].intensity;
    scene.backgroundRotation.set(0, OUTDOOR[key].rotation, 0);
  } else {
    lights.apply(night);
  }
  house.ground.visible = !(walkView && tex);
}

/** 拍環境探針前把場景切到漫遊狀態，回傳還原函式 */
function probeState(): () => void {
  const clip = renderer!.clippingPlanes, ceil = house.ceiling.visible;
  renderer!.clippingPlanes = [];
  house.ceiling.visible = true;
  applyOutdoor(true);
  for (const r of house.build.reflectors) r.visible = false;
  return () => {
    renderer!.clippingPlanes = clip;
    house.ceiling.visible = ceil;
    applyOutdoor(mode === 'walk');
    for (const r of house.build.reflectors) r.visible = true;
  };
}

const BLACK = new THREE.Color(0);
/** 霧面玻璃亮度跟著日夜（要在拍環境探針之前設好） */
function applyFrosted(): void {
  const glow = frostedGlow[night ? 'night' : 'day'];
  house.build.frosted.forEach((f, i) => (f.mesh.material as THREE.MeshStandardMaterial).emissive.copy(glow?.[i] ?? BLACK));
}

function applyLight(): void {
  lights.apply(night);
  applyOutdoor(mode === 'walk');
  applyFrosted();
  if (probesReady) {
    probes.apply(night ? 'night' : 'day', probeState);
    compileThenRender();
  }
  dock.showNight(night);
  // 窗簾展示狀態跟著日夜切換
  const p = night ? CURTAIN_PRESETS.night : CURTAIN_PRESETS.day;
  for (const c of house.build.curtains) { c.set('sheer', p.sheer); c.set('main', p.main); }
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
  applyOutdoor(m === 'walk');
  applyCut();
  // 剖切開關與天花板顯示會改變著色器組合
  if (probesReady) compileThenRender();
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
  if (!compiling) renderer!.render(scene, camera);
  requestAnimationFrame(loop);
}
applyLight();
setMode('orbit');
// 貼圖與窗外 HDRI 載入後，換上窗外景觀並拍環境探針
const hdrLoader = new HDRLoader().setPath(`${import.meta.env.BASE_URL}hdri/`);
const outdoorReady = Promise.all((['day', 'night'] as const).map(async (k) => {
  const t = await hdrLoader.loadAsync(OUTDOOR[k].file);
  t.mapping = THREE.EquirectangularReflectionMapping;
  hdri[k] = t;
  const { rotation, intensity } = OUTDOOR[k];
  frostedGlow[k] = house.build.frosted.map((f) => hemisphereMean(t, f.out, rotation).multiplyScalar(FROSTED_T * intensity));
})).catch((e) => console.warn('窗外 HDRI 載入失敗（請先執行 npm run fetch:hdri）', e));
Promise.all([textures.ready, outdoorReady]).then(() => {
  probesReady = true;
  applyLight();
});
requestAnimationFrame(loop);

/* ---------- 除錯／比對介面（與參考版 window.__dbg 相同） ---------- */
Object.assign(window, {
  __dbg: { setMode, walk: walk.state, applyLight, setNight, setCut, camera, orbit, setDoor: (id: string, t: number) => house.doors.set(id, t),
    setCurtain: (id: string, layer: 'sheer' | 'main', t: number) => house.build.curtains.find((c) => c.id === id)?.set(layer, t) },
  __app: { THREE, scene, renderer, camera, build: house.build, doors: house.doors, probes, ready: textures.ready },
});
