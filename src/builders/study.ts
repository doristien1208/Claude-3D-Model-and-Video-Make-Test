import * as THREE from 'three';
import { X, Z } from '../core/units';
import type { ItemOf } from '../data/query';
import { FACING_YAW, add, gbox, rbox, type Build } from './prims';
import { drape, thickGrid } from './shapes';

/*
 * 書房（2026-10 依調查重做；公尺）：
 *  書桌  HAY Loop Stand Table 250 × 92.5 × 74，胡桃木皮桌板 2.4（方邊）；支架 64.5 × 37 × 72（見 LOOP）
 *  螢幕  Apple Studio Display 62.3 × 47.8（含傾斜支架）、面板 36.2 × 3.1、邊框 1.25、支架深 16.8；
 *        Magic Keyboard（含數字鍵）41.9 × 11.5 × 0.41–1.09、Magic Mouse 11.35 × 5.71 × 2.16
 *  椅子  Vitra Eames EA 117（見 CHAIR）
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** 書桌面高 */
export const DESK_TOP = 0.74;

/** 書桌：rect 為桌板，使用者坐在 y1（北）側 */
export function desk(b: Build, it: ItemOf<'desk'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, T = 0.024;
  const g = new THREE.Group();
  g.position.set(X((x1 + x2) / 2), 0, Z((y1 + y2) / 2));
  b.root.add(g);
  const W = (x2 - x1) / 100, D = (y2 - y1) / 100;
  rbox(g, -W / 2, -D / 2, W / 2, D / 2, DESK_TOP - T, DESK_TOP, mat.walnut, 0.003);
  trestles(b, g, W, D, DESK_TOP - T);
  b.solids.push([X(x1), Z(y1), X(x2), Z(y2)]);
}

/** HAY Loop Stand 支架尺寸（HAY 型錄線圖）：支架中心離桌端 48.8；頂橫桿寬 64.5；三支腳在桌深 15.6／46.2／76.8 處，腳底前後張開 ±18.5 */
const LOOP = { fromEnd: 0.488, rail: 0.645, legs: [0.156, 0.462, 0.768], spread: 0.185, tube: 0.03 };

/**
 * HAY Loop Stand 的兩個支架：3 cm 黑色方管。頂橫桿貼在桌板下、沿桌深；三支腳從橫桿往下，
 * 側看是一個 A 字（外側兩支往桌端張、中間一支往內張），成三腳架；兩支架之間桌板下一道支撐框（250 長的桌才有）。
 */
function trestles(b: Build, g: THREE.Group, W: number, D: number, top: number): void {
  const { mat } = b;
  const L = LOOP, t = L.tube, yr = top - t / 2;
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - L.fromEnd);
    gbox(g, t, t, L.rail, x, yr, 0, mat.black, 0.003);
    L.legs.forEach((f, i) => {
      const z = f - D / 2, lean = i === 1 ? -s : s;
      beam(g, V(x, yr, z), V(x + lean * L.spread, 0, z), t, t, mat.black);
    });
  }
  // 支撐框：兩支架之間、對齊外側兩支腳
  const span = W - 2 * L.fromEnd - t;
  for (const z of [L.legs[0] - D / 2, L.legs[2] - D / 2]) gbox(g, span, t, t, 0, yr, z, mat.black, 0.003);
}

/** 方管：從 a 到 c（群組本地公尺），斷面 w × d */
function beam(g: THREE.Object3D, a: THREE.Vector3, c: THREE.Vector3, w: number, d: number, m: THREE.Material): THREE.Mesh {
  const dir = c.clone().sub(a);
  const me = gbox(g, w, dir.length(), d, 0, 0, 0, m, 0.003);
  me.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  me.position.copy(a).add(c).multiplyScalar(0.5);
  return me;
}

/**
 * 辦公椅，參考 Vitra Eames Aluminium Chair EA 117：兩側鋁擠側框從座面前緣一路彎上來成椅背，
 * 黑色皮革吊帶繃在側框之間（橫向車縫的肋條），扶手是鋁柱＋黑色扶手墊，下方升降氣壓棒、五爪腳＋滾輪。
 * 本地座標：x 橫向、−z 為正面（朝桌子）。
 */
export function officeChair(b: Build, it: ItemOf<'officeChair'>): void {
  const { mat } = b;
  const [x, y] = it.at, [fx, fy] = it.faceTo;
  const g = new THREE.Group();
  g.position.set(X(x), 0, Z(y));
  g.rotation.y = Math.atan2(-(fx - x), -(fy - y));
  b.root.add(g);
  const C = CHAIR;
  // 側框的中心線（[深度, 高]，從座面前緣到椅背頂）：座面略往後傾，椅背後仰
  const rail: [number, number][] = [];
  const seatF: [number, number] = [-C.seatD / 2, C.seatH], seatB: [number, number] = [C.seatD / 2 - 0.06, C.seatH - 0.03];
  for (let i = 0; i <= 8; i++) rail.push([seatF[0] + (seatB[0] - seatF[0]) * (i / 8), seatF[1] + (seatB[1] - seatF[1]) * (i / 8) - 0.012 * Math.sin((i / 8) * Math.PI)]);
  // 座面與椅背之間的圓弧（半徑 9 cm），再沿後仰角往上到椅背頂
  const R = 0.09, back = C.backTilt, cx = seatB[0], cy = seatB[1] + R;
  for (let i = 1; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2 - back);
    rail.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  const [lx, ly] = rail[rail.length - 1], len = C.backTop - ly;
  for (let i = 1; i <= 6; i++) rail.push([lx + Math.tan(back) * len * (i / 6), ly + len * (i / 6)]);
  // 側框（鋁擠，寬 1.5、深 3）：沿中心線掃出，轉成 x 為寬
  for (const s of [-1, 1]) {
    const geo = drape(rail, 0.015, C.railDepth).rotateY(-Math.PI / 2);
    add(g, geo, mat.chrome, s * (C.slingW / 2 + 0.008), 0, 0);
  }
  // 吊帶：沿側框弧長往前凹（座面下垂、椅背往後鼓），每 5 cm 一道橫向肋條
  const path = new THREE.CatmullRomCurve3(rail.map(([d, h]) => V(0, h, d)));
  const plen = path.getLength(), sag = (v: number) => (v < 0.46 ? 0.014 : 0.02) * Math.sin(Math.PI * Math.min(1, (v < 0.46 ? v : v - 0.46) / (v < 0.46 ? 0.46 : plen - 0.46)));
  const hw = C.slingW / 2;
  const sheetAt = (u: number, v: number) => {
    const t = Math.min(1, v / plen), p = path.getPointAt(t), tan = path.getTangentAt(t);
    const n = V(0, tan.z, -tan.y).normalize();        // 吊帶正面法線（朝使用者）
    return p.add(V(u, 0, 0)).addScaledVector(n, 0.006 - sag(v) * (1 - (u / hw) ** 2));
  };
  const us = Array.from({ length: 17 }, (_, i) => -hw + (2 * hw * i) / 16), vs = Array.from({ length: 61 }, (_, i) => (plen * i) / 60);
  add(g, thickGrid(us, vs, sheetAt, () => 0.006), mat.chair);
  for (let v = 0.03; v < plen - 0.02; v += C.rib) {
    const a = sheetAt(-hw + 0.01, v), c = sheetAt(hw - 0.01, v);
    add(g, new THREE.CylinderGeometry(0.0035, 0.0035, a.distanceTo(c), 8).rotateZ(Math.PI / 2), mat.chair, (a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2);
  }
  // 扶手：鋁柱從座面下的橫樑升起，上面黑色扶手墊
  for (const s of [-1, 1]) {
    const ax = s * (hw + 0.02);
    gbox(g, 0.018, C.armH - C.seatH + 0.06, 0.03, ax, (C.armH + C.seatH - 0.06) / 2, 0.06, mat.chrome, 0.004);
    gbox(g, 0.05, 0.022, 0.29, ax, C.armH, -0.04, mat.black, 0.01);
  }
  // 座下：鋁橫樑、底座機構、氣壓棒、五爪腳＋滾輪
  gbox(g, C.slingW + 0.03, 0.025, 0.05, 0, C.seatH - 0.08, 0.02, mat.chrome, 0.006);
  gbox(g, 0.16, 0.05, 0.2, 0, C.seatH - 0.12, 0.02, mat.black, 0.01);
  add(g, new THREE.CylinderGeometry(0.025, 0.025, C.seatH - 0.145 - 0.1, 20), mat.black, 0, 0.1 + (C.seatH - 0.245) / 2, 0.02);
  add(g, new THREE.CylinderGeometry(0.035, 0.045, 0.06, 24), mat.chrome, 0, 0.09, 0.02);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2, r = C.baseD / 2 - 0.03;
    const arm = gbox(g, 0.035, 0.03, r, Math.sin(a) * r / 2, 0.075, 0.02 + Math.cos(a) * r / 2, mat.chrome, 0.008);
    arm.rotation.y = a;
    // 雙輪滾輪 Ø6
    for (const k2 of [-1, 1]) {
      const wheel = add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.012, 20).rotateZ(Math.PI / 2), mat.black, 0, 0.03, 0);
      wheel.position.set(Math.sin(a) * r + Math.cos(a) * k2 * 0.009, 0.03, 0.02 + Math.cos(a) * r - Math.sin(a) * k2 * 0.009);
      wheel.rotation.y = a;
    }
  }
  b.solids.push([X(x) - C.baseD / 2, Z(y) - C.baseD / 2, X(x) + C.baseD / 2, Z(y) + C.baseD / 2]);
}

/** EA 117 尺寸（見 officeChair） */
/** 座寬 52.5（吊帶 49＋兩側框）、座深 46.5、座高 38.5–50.5 取 46、椅背 40.7 高（總高 = 座高 + 44.5）、扶手在座面上 26；五爪腳 Ø62（估）、雙輪 Ø6；吊帶熱壓橫縫間距 4.8；側框 3.5 × 1.5（估） */
const CHAIR = { seatH: 0.46, seatD: 0.465, slingW: 0.49, backTop: 0.905, backTilt: 0.2, armH: 0.72, railDepth: 0.035, baseD: 0.62, rib: 0.048 };

/**
 * 桌上螢幕＋鍵盤滑鼠：at 為螢幕面板中心（平面），facing 為螢幕朝向（使用者方向）。
 * 本地座標：x 沿螢幕寬、z 朝使用者。
 */
export function monitor(b: Build, it: ItemOf<'monitor'>): void {
  const { mat } = b;
  const g = new THREE.Group();
  g.position.set(X(it.at[0]), DESK_TOP, Z(it.at[1]));
  g.rotation.y = FACING_YAW[it.facing];
  b.root.add(g);
  const PW = 0.623, PH = 0.362, PD = 0.031, H = 0.478, FOOT = 0.168;
  // 面板（鋁背殼＋玻璃正面）：下緣離桌 H − PH
  const y0 = H - PH;
  rbox(g, -PW / 2, -PD / 2, PW / 2, PD / 2, y0, H, mat.aluminium, 0.006);
  const glass = add(g, new THREE.PlaneGeometry(PW - 0.004, PH - 0.004), mat.tv, 0, y0 + PH / 2, PD / 2 + 0.0005);
  glass.receiveShadow = false;
  // 支架：一片鋁板（約 18 寬、1.1 厚）從面板背面中段（離桌約 27）往下、在桌面彎成腳（深 16.8）
  const SW = 0.18, ST = 0.011;
  gbox(g, SW, 0.27, ST, 0, 0.135 + 0.006, -PD / 2 - 0.035, mat.aluminium, 0.004);
  gbox(g, SW, ST, FOOT, 0, ST / 2, -FOOT / 2 + 0.03, mat.aluminium, 0.004);
  // 鍵盤（前低後高的楔形）與滑鼠
  const kb = gbox(g, 0.419, 0.008, 0.115, 0, 0.004, 0.33, mat.aluminium, 0.003);
  kb.rotation.x = -0.05;
  gbox(g, 0.4, 0.002, 0.1, 0, 0.0085, 0.33, mat.plateWhite, 0.0008);
  const mouse = add(g, new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.plateWhite, 0.3, 0, 0.33);
  mouse.scale.set(0.057, 0.022 * 2, 0.114);
}
