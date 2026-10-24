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
import { EnvProbes } from './render/envProbes';
import { LightMask } from './render/lightMask';
import { mergeStatic } from './render/mergeStatic';
import { createRenderer } from './render/renderer';
import { WindowView } from './render/windowView';
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
// 每區環境反射探針；日夜切換時發光強度會整體改變的材質不複製。同一批材質再加上燈光遮罩（燈只照亮所在空間）
const lightMask = new LightMask();
const lights = new Lighting(scene, renderer, materials.mat, house.build.areaLights, (p) => lightMask.groupAt(p));
const probes = new EnvProbes(renderer, scene, house.build.root, new Set([materials.mat.glow, materials.mat.glowSoft, materials.mat.screen]), (s) => lightMask.patch(s));
// 探針已依區域分好材質，接著合併靜態物件（會動的門、窗簾、鏡面、霧面玻璃不合併；天花板群組各自合併）；?nomerge 可關閉
if (!new URLSearchParams(location.search).has('nomerge')) {
  const skip = new Set<THREE.Object3D>([...house.build.reflectors, ...house.build.frosted.map((f) => f.mesh), house.ceiling]);
  const r1 = mergeStatic(house.build.root, skip), r2 = mergeStatic(house.ceiling, new Set(skip));
  console.info(`合併靜態物件：${r1.before + r2.before} → ${r1.after + r2.after} 個 mesh`);
}
lightMask.update(scene);

/* ---------- 窗外景觀（台中實拍照片；先跑 npm run fetch:backplates） ---------- */
const view = new WindowView(scene);
let viewReady = false;
/** 貼圖與窗外照片都載入後才拍環境探針 */
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

/** 漫遊時窗外顯示照片（室外地面隱藏）；俯瞰時只有純色背景與地面 */
function applyOutdoor(walkView: boolean): void {
  const show = walkView && viewReady;
  view.show(show ? (night ? 'night' : 'day') : null);
  house.ground.visible = !show;
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
    applyMirrors();
  };
}

/** 鏡面即時反射每格都要把場景再畫一次：只在漫遊時開，俯瞰時看到的是底下的金屬鏡板（環境探針反射） */
function applyMirrors(): void {
  for (const r of house.build.reflectors) r.visible = mode === 'walk';
}

const BLACK = new THREE.Color(0);
/** 霧面玻璃亮度跟著日夜（要在拍環境探針之前設好） */
function applyFrosted(): void {
  const key = night ? 'night' : 'day';
  for (const f of house.build.frosted) (f.mesh.material as THREE.MeshStandardMaterial).emissive.copy(view.frostedGlow(key, f.out) ?? BLACK);
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
  for (const c of house.build.curtains) c.set(night ? CURTAIN_PRESETS.night : CURTAIN_PRESETS.day);
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
  applyMirrors();
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
// 貼圖與窗外照片載入後，換上窗外景觀並拍環境探針
const viewLoaded = view.load(`${import.meta.env.BASE_URL}backplates/`, renderer.capabilities.getMaxAnisotropy())
  .then(() => { viewReady = true; })
  .catch((e) => console.warn('窗外照片載入失敗（請先執行 npm run fetch:backplates）', e));
Promise.all([textures.ready, viewLoaded]).then(() => {
  probesReady = true;
  applyLight();
});
requestAnimationFrame(loop);

/* ---------- 除錯／比對介面（與參考版 window.__dbg 相同） ---------- */
Object.assign(window, {
  __dbg: { setMode, walk: walk.state, applyLight, setNight, setCut, camera, orbit, setDoor: (id: string, t: number) => house.doors.set(id, t),
    setCurtain: (id: string, t: number) => house.build.curtains.find((c) => c.id === id)?.set(t) },
  __app: { THREE, scene, renderer, camera, build: house.build, doors: house.doors, probes, view, lights, lightMask, ready: textures.ready },
});
