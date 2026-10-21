/**
 * 參考版 ↔ 新版自動比對：
 *  1. 幾何：每個 mesh 的幾何類型、世界座標外框、材質屬性、貼圖、UV、陰影旗標
 *  2. 碰撞方塊、小地圖線段、燈光
 *  3. 像素：同一鏡頭下兩邊各渲染一張，計算差異並畫出熱度圖
 * 結果同時寫到 window.__result。
 */
import { X, Z } from '../../src/core/units';
import { viewpoints } from '../../src/data/layout';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

interface Side {
  win: Any;
  scene: Any;
  renderer: Any;
  camera: Any;
  dbg: Any;
  solids: number[][];
  planSegs: Any[];
  texName: (t: Any) => string;
}

const $ = (id: string) => document.getElementById(id)!;
const status = (s: string) => ($('status').textContent = s);
// 瀏覽器窗格隱藏時 rAF 不會觸發，所以比對流程不依賴兩邊的動畫迴圈：自己設鏡頭、自己渲染
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (cond: () => boolean, ms = 30000) => {
  const t0 = performance.now();
  while (!cond()) {
    if (performance.now() - t0 > ms) throw new Error('等待逾時');
    await new Promise((r) => setTimeout(r, 50));
  }
};

async function openRef(): Promise<Side> {
  const win = ($('fRef') as HTMLIFrameElement).contentWindow as Any;
  await until(() => !!win.__ref);
  const r = win.__ref;
  const byUri = new Map<string, string>(Object.entries(r.TEX as Record<string, string>).map(([k, v]) => [v, k]));
  const maps = Object.values(r.mat).flatMap((m: Any) => [m.map, m.normalMap, m.aoMap].filter(Boolean));
  await until(() => maps.every((t: Any) => t.image && t.image.complete && t.image.naturalWidth > 0));
  return {
    win, scene: r.scene, renderer: r.renderer, camera: r.camera, dbg: win.__dbg, solids: r.solids, planSegs: r.planSegs,
    texName: (t) => byUri.get(t.image?.src) ?? '?',
  };
}

async function openNew(): Promise<Side> {
  const win = ($('fNew') as HTMLIFrameElement).contentWindow as Any;
  await until(() => !!win.__app);
  const a = win.__app;
  await a.ready;
  return {
    win, scene: a.scene, renderer: a.renderer, camera: a.camera, dbg: win.__dbg, solids: a.build.solids, planSegs: a.build.planSegs,
    texName: (t) => t.name || '?',
  };
}

/* ---------- 1. 幾何與材質 ---------- */
const f4 = (n: number) => (Math.abs(n) < 5e-5 ? 0 : n).toFixed(4);
const col = (c: Any) => (c ? `${f4(c.r)},${f4(c.g)},${f4(c.b)}` : '-');

function matSig(s: Side, m: Any): string {
  const t = (x: Any) => (x ? s.texName(x) : '-');
  return [m.type, `c${col(m.color)}`, `r${m.roughness}`, `m${m.metalness}`, `e${col(m.emissive)}x${m.emissiveIntensity}`,
    `o${m.opacity}${m.transparent ? 't' : ''}${m.depthWrite ? '' : 'nd'}`, `${t(m.map)},${t(m.normalMap)},${t(m.roughnessMap)},${t(m.aoMap)}`].join('|');
}

function geoSig(g: Any): string {
  const p = g.parameters ?? {};
  const keep = ['radiusTop', 'radiusBottom', 'radialSegments', 'radius', 'segments', 'innerRadius', 'outerRadius', 'thetaSegments', 'widthSegments', 'heightSegments'];
  return g.type + JSON.stringify(Object.fromEntries(keep.filter((k) => k in p).map((k) => [k, typeof p[k] === 'number' ? +p[k].toFixed(4) : p[k]])));
}

function uvSum(g: Any): string {
  const uv = g.attributes.uv;
  if (!uv) return '-';
  let s = 0;
  for (let i = 0; i < uv.count; i++) s += uv.getX(i) * ((i % 7) + 1) + uv.getY(i) * ((i % 5) + 3);
  return s.toFixed(3);
}

function meshes(s: Side): Map<string, number> {
  s.scene.updateMatrixWorld(true);
  const out = new Map<string, number>();
  s.scene.traverse((o: Any) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const key = [geoSig(g), `${f4(bb.min.x)},${f4(bb.min.y)},${f4(bb.min.z)}~${f4(bb.max.x)},${f4(bb.max.y)},${f4(bb.max.z)}`,
      matSig(s, o.material), `uv${uvSum(g)}`, `${o.castShadow ? 'C' : 'c'}${o.receiveShadow ? 'R' : 'r'}${o.visible ? 'V' : 'v'}`].join(' ');
    out.set(key, (out.get(key) ?? 0) + 1);
  });
  return out;
}

function lightsOf(s: Side): Map<string, number> {
  s.scene.updateMatrixWorld(true);
  const out = new Map<string, number>();
  s.scene.traverse((o: Any) => {
    if (!o.isLight) return;
    const p = o.getWorldPosition(new o.position.constructor());
    let k = `${o.type} c${col(o.color)} i${o.intensity} p${f4(p.x)},${f4(p.y)},${f4(p.z)} vis${o.visible}`;
    if (o.isPointLight) k += ` d${o.distance} decay${o.decay}`;
    if (o.isHemisphereLight) k += ` g${col(o.groundColor)}`;
    if (o.isDirectionalLight) {
      const sc = o.shadow.camera;
      k += ` t${f4(o.target.position.x)},${f4(o.target.position.y)},${f4(o.target.position.z)} sh${o.castShadow}` +
        ` ${o.shadow.mapSize.x} [${sc.left},${sc.right},${sc.top},${sc.bottom},${sc.near},${sc.far}] b${o.shadow.bias} nb${o.shadow.normalBias}`;
    }
    out.set(k, (out.get(k) ?? 0) + 1);
  });
  return out;
}

const multiset = (arr: string[]) => arr.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>());

function diff(a: Map<string, number>, b: Map<string, number>) {
  const onlyA: string[] = [], onlyB: string[] = [];
  for (const [k, n] of a) for (let i = 0; i < n - (b.get(k) ?? 0); i++) onlyA.push(k);
  for (const [k, n] of b) for (let i = 0; i < n - (a.get(k) ?? 0); i++) onlyB.push(k);
  const total = (m: Map<string, number>) => [...m.values()].reduce((x, y) => x + y, 0);
  return { totalRef: total(a), totalNew: total(b), onlyRef: onlyA, onlyNew: onlyB };
}

/* ---------- 3. 像素 ---------- */
interface View { name: string; mode: 'orbit' | 'walk'; night: boolean; cut: boolean; walk?: { x: number; z: number; yaw: number; pitch: number } }

const views: View[] = [
  { name: '俯瞰・夜・剖切', mode: 'orbit', night: true, cut: true },
  { name: '俯瞰・日・剖切', mode: 'orbit', night: false, cut: true },
  { name: '俯瞰・日・不剖切', mode: 'orbit', night: false, cut: false },
  { name: '俯瞰・夜・不剖切', mode: 'orbit', night: true, cut: false },
  ...viewpoints.flatMap((v) => [true, false].map((night) => ({
    name: `${v.label}・${night ? '夜' : '日'}`, mode: 'walk' as const, night, cut: true,
    walk: { x: X(v.at[0]), z: Z(v.at[1]), yaw: v.yaw, pitch: v.pitch ?? -0.08 },
  }))),
];

function apply(s: Side, v: View): void {
  s.dbg.setMode(v.mode);
  s.dbg.setNight(v.night);
  s.dbg.setCut(v.cut);
  if (v.walk) {
    // 等同漫遊迴圈在沒有按鍵時的 step()
    Object.assign(s.dbg.walk, v.walk);
    s.camera.position.set(v.walk.x, 1.6, v.walk.z);
    s.camera.rotation.set(v.walk.pitch, v.walk.yaw, 0, 'YXZ');
  }
}

/** 渲染後在同一個工作中讀取畫布，不需要 preserveDrawingBuffer */
function grab(s: Side): ImageData {
  s.renderer.render(s.scene, s.camera);
  const c = s.renderer.domElement as HTMLCanvasElement;
  const cv = document.createElement('canvas');
  cv.width = c.width; cv.height = c.height;
  const g = cv.getContext('2d')!;
  g.drawImage(c, 0, 0);
  return g.getImageData(0, 0, cv.width, cv.height);
}

function compareImages(a: ImageData, b: ImageData) {
  const n = a.width * a.height, heat = new ImageData(a.width, a.height);
  let sum = 0, over10 = 0, over30 = 0;
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const d = Math.max(Math.abs(a.data[j] - b.data[j]), Math.abs(a.data[j + 1] - b.data[j + 1]), Math.abs(a.data[j + 2] - b.data[j + 2]));
    sum += d;
    if (d > 10) over10++;
    if (d > 30) over30++;
    const gray = (b.data[j] + b.data[j + 1] + b.data[j + 2]) / 12;
    heat.data[j] = Math.min(255, gray + d * 6);
    heat.data[j + 1] = gray;
    heat.data[j + 2] = gray;
    heat.data[j + 3] = 255;
  }
  return { mean: +(sum / n).toFixed(2), pct10: +((over10 / n) * 100).toFixed(2), pct30: +((over30 / n) * 100).toFixed(2), heat };
}

function toCanvas(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/* ---------- 主流程 ---------- */
async function run() {
  status('等待兩邊載入與貼圖…');
  const [ref, neu] = await Promise.all([openRef(), openNew()]);
  for (const s of [ref, neu]) { s.dbg.setMode('orbit'); s.dbg.setNight(true); s.dbg.setCut(true); }
  // 先各渲染一次，讓貼圖上傳到 GPU、著色器編譯完成
  grab(ref); grab(neu);
  await sleep(300);

  status('比對幾何…');
  const solidKey = (s: number[]) => s.map((v) => v.toFixed(6)).join(',');
  const segKey = (p: Any) => JSON.stringify(p, (_k, v) => (typeof v === 'number' ? +v.toFixed(4) : v));
  const result: Any = {
    meshes: diff(meshes(ref), meshes(neu)),
    lights: diff(lightsOf(ref), lightsOf(neu)),
    solids: diff(multiset(ref.solids.map(solidKey)), multiset(neu.solids.map(solidKey))),
    planSegs: diff(multiset(ref.planSegs.map(segKey)), multiset(neu.planSegs.map(segKey))),
    views: [] as Any[],
  };

  const sum = (label: string, d: Any) =>
    `<tr><td>${label}</td><td>${d.totalRef}</td><td>${d.totalNew}</td>` +
    `<td class="${d.onlyRef.length + d.onlyNew.length ? 'bad' : 'ok'}">${d.onlyRef.length} / ${d.onlyNew.length}</td></tr>`;
  $('summary').innerHTML = `<table><tr><th>項目</th><th>參考版</th><th>新版</th><th>只在參考版 / 只在新版</th></tr>` +
    sum('Mesh', result.meshes) + sum('燈光', result.lights) + sum('碰撞方塊', result.solids) + sum('小地圖線段', result.planSegs) + `</table>`;

  for (const v of views) {
    status(`像素比對：${v.name}`);
    apply(ref, v); apply(neu, v);
    // 第一次渲染可能還在編譯新的著色器組合（例如剖切開關），先丟掉一張
    grab(ref); grab(neu);
    await sleep(30);
    const a = grab(ref), b = grab(neu);
    const c = compareImages(a, b);
    result.views.push({ name: v.name, size: `${a.width}x${a.height}`, mean: c.mean, pct10: c.pct10, pct30: c.pct30 });
    const row = document.createElement('div');
    row.className = 'view';
    row.dataset.view = v.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<b>${v.name}</b><br>平均差 ${c.mean}／255<br>差 &gt;10：${c.pct10}%<br>差 &gt;30：${c.pct30}%`;
    row.append(meta, toCanvas(a), toCanvas(b), toCanvas(c.heat));
    $('views').append(row);
  }

  $('detail').textContent = JSON.stringify({
    meshes: { onlyRef: result.meshes.onlyRef, onlyNew: result.meshes.onlyNew },
    lights: { onlyRef: result.lights.onlyRef, onlyNew: result.lights.onlyNew },
    solids: { onlyRef: result.solids.onlyRef, onlyNew: result.solids.onlyNew },
    planSegs: { onlyRef: result.planSegs.onlyRef, onlyNew: result.planSegs.onlyNew },
  }, null, 1);
  status('完成');
  (window as Any).__result = result;
}

run().catch((e) => { status(`失敗：${e?.message ?? e}`); console.error(e); });
