import * as THREE from 'three';
import { X, Z } from '../core/units';
import type { ItemOf } from '../data/query';
import { add, gbox, leanOn, orient, rbox, worldUV, type Build } from './prims';
import { cushion, drape, pillow, roundedPolygon, slab, type PillowOpt } from './shapes';

/** 地毯；h 為厚度（客廳 Muuto Ply 平織 0.6 cm），inner 為淺色內層（只高出 1 mm，像織出來的色塊） */
export function rug(b: Build, it: ItemOf<'rug'>): void {
  const h = it.h ?? 0.012;
  b.box(it.rect, 0, h, b.mat[it.material], { cast: false });
  if (it.inner) b.box(it.inner, h, h + 0.001, b.mat.rug2, { cast: false });
}

/**
 * 水平 L 形或任意多邊形的軟包塊：平面 pts（公尺）、y0–y1，角圓 r、上下緣倒圓 bevel。
 * r 要比 bevel 大：r186 的 ExtrudeGeometry 拿內縮 bevel 後的輪廓做三角化，圓角縮成同一點會讓 earcut 拉出跨過缺角的三角形。
 */
function padded(g: THREE.Object3D, pts: readonly [number, number][], y0: number, y1: number, m: THREE.Material, r: number, bevel: number): THREE.Mesh {
  const geo = slab(roundedPolygon(pts, Math.max(r, bevel + 0.01)), y1 - y0, bevel);
  const me = add(g, geo, m, 0, y0, 0);
  worldUV(geo, me.position);
  return me;
}

/**
 * L 型沙發，比例參考 &Tradition Develius（模組 89、座高 42、扶手高 60）：外框 207 × 233 不變，
 * 長邊椅背朝西、短邊椅背朝南，兩邊座深都是 92、實際坐深 58。
 * 由下往上：內縮 6 cm、高 4 cm 的深色踢腳（沙發看起來懸浮）→ L 型座台（到 24）→ L 型椅背框（62，上緣倒圓）
 * 與兩側扶手（24 寬、60 高）→ 坐墊 3 塊厚 19（座高 43）→ 椅背墊 5 塊（20 厚、48 高、後仰 7°，靠在座台上）
 * → 抱枕 5 個（50 × 50 ×2、45 × 45 ×2、30 × 50 腰枕）→ 東側扶手披一條三折的毯子（HAY Mono 130 × 180）。
 */
export function sofaL(b: Build, it: ItemOf<'sofaL'>): void {
  const { mat } = b;
  const [ox, oy, ex, ey] = it.rect;
  const W = (ex - ox) / 100, L = (ey - oy) / 100;
  const D = 0.92, ARM = 0.24, BK = 0.12, PL = 0.04, DECK = 0.24, SEAT = 0.43, ARM_H = 0.6, BACK_H = 0.62;
  const g = new THREE.Group();
  g.position.set(X(ox), 0, Z(oy));
  b.root.add(g);
  const up = mat.sofa;

  // 踢腳（內縮 6 cm）
  const k = 0.06;
  padded(g, [[k, k], [D - k, k], [D - k, L - D + k], [W - k, L - D + k], [W - k, L - k], [k, L - k]], 0, PL, mat.black, 0.01, 0);
  // 座台、椅背框、扶手
  padded(g, [[BK, ARM], [D, ARM], [D, L - D], [W - ARM, L - D], [W - ARM, L - BK], [BK, L - BK]], PL, DECK, up, 0.02, 0.02);
  padded(g, [[0, 0], [BK, 0], [BK, L - BK], [W, L - BK], [W, L], [0, L]], PL, BACK_H, up, 0.03, 0.03);
  rbox(g, BK, 0, D, ARM, PL, ARM_H, up, 0.035);
  rbox(g, W - ARM, L - D, W, L - BK, PL, ARM_H, up, 0.035);

  // 坐墊：椅背墊下緣前方到座前緣（58 深）；長邊分兩塊（第二塊含轉角）、短邊一塊
  const T = 0.004, front = 0.34, zEnd = L - front;   // 椅背墊下緣前緣離外框
  const seat = (x0: number, z0: number, x1: number, z1: number) =>
    add(g, cushion(x1 - x0 - T, z1 - z0 - T, SEAT - DECK, { e: 0.045, r: 0.035, crown: 0.012 }), up, (x0 + x1) / 2, DECK, (z0 + z1) / 2);
  const zMid = (ARM + zEnd) / 2;
  seat(front, ARM, D, zMid);
  seat(front, zMid, D, zEnd);
  seat(D, L - D, W - ARM, zEnd);

  // 椅背墊：下緣前緣貼著坐墊後緣，往後仰靠在椅背框上緣
  const TILT = 7 * (Math.PI / 180), BH = 0.48, BT = 0.2;
  const back = (w: number, at: THREE.Vector3, out: THREE.Vector3) => {
    const geo = cushion(w - T, BH, BT, { e: 0.05, r: 0.04, crown: 0.015, crownBottom: 0.008 }).translate(0, -BT, 0);
    // 以下緣前緣為軸後仰：先把高度方向移到 0–BH
    geo.translate(0, 0, BH / 2);
    const side = new THREE.Vector3(-out.z, 0, out.x);
    orient(geo, side, out, new THREE.Vector3(0, 1, 0));
    geo.applyMatrix4(new THREE.Matrix4().makeRotationAxis(side, TILT));
    return add(g, geo, up, at.x, at.y, at.z);
  };
  const E = new THREE.Vector3(1, 0, 0), N = new THREE.Vector3(0, 0, -1);
  const wn = 3, ww = (L - BK - ARM) / wn;
  for (let i = 0; i < wn; i++) back(ww, new THREE.Vector3(front, DECK, ARM + ww * (i + 0.5)), E);
  const sn = 2, sw = (W - ARM - front) / sn;
  for (let i = 0; i < sn; i++) back(sw, new THREE.Vector3(front + sw * (i + 0.5), DECK, zEnd), N);

  // 抱枕：靠在椅背墊前、下緣陷進坐墊約 1 cm，後仰約 18°。厚度依型錄（R&B、Mercana：50 × 50 約 13–15、45 × 45 約 10–12、
  // 腰枕約 10–12）；靠著時填充往下沉（下緣厚、上緣薄），上緣略往前翻，方枕上緣輕輕手刀；bouclé 幾乎不起皺、麻布皺褶明顯
  let seed = ox;
  const P = (w: number, h: number, t: number, m: THREE.Material, bottom: THREE.Vector3, out: THREE.Vector3, tilt: number, roll: number, o: PillowOpt) =>
    leanOn(g, pillow(w, h, t, { seed: ++seed, settle: 0.15, back: 0.85, ...o }), m, bottom, out, h, tilt * (Math.PI / 180), roll * (Math.PI / 180));
  const sy = SEAT - 0.012, BOUCLE = { crease: 0.0012, chop: 0.035, roll: 0.015 }, LINEN = { crease: 0.003, chop: 0.03, roll: 0.012 };
  P(0.5, 0.5, 0.14, mat.pillowCream, new THREE.Vector3(front + 0.1, sy, 0.56), E, 18, -4, BOUCLE);
  P(0.45, 0.45, 0.12, mat.ochre, new THREE.Vector3(front + 0.2, sy, 0.7), E, 22, 6, LINEN);
  P(0.5, 0.5, 0.14, mat.pillowCream, new THREE.Vector3(front + 0.1, sy, zEnd - 0.34), E, 17, 3, BOUCLE);
  P(0.45, 0.45, 0.12, mat.ochre, new THREE.Vector3(front + 0.4, sy, zEnd - 0.1), N, 20, -5, LINEN);
  P(0.5, 0.3, 0.11, mat.pillowRust, new THREE.Vector3(W - ARM - 0.45, sy, zEnd - 0.08), N, 14, 2, { crease: 0.003, settle: 0.1 });

  // 披毯：刷毛羊毛約 0.8 kg（約 2.5 mm 厚），三折後 43 寬、0.8 cm 厚，從坐墊上爬過東側扶手、在外側垂下；垂下的部分有直向波浪摺
  const TH = 0.008, h2 = TH / 2, ax = W - ARM, top = ARM_H, rr = 0.035 + h2;
  const path: [number, number][] = [[ax - 0.18, sy + 0.006], [ax - 0.13, sy + 0.003], [ax - 0.05, sy - 0.003], [ax - 0.016, sy + 0.01],
    [ax - h2, sy + 0.08], [ax - h2, top - 0.035]];
  for (let i = 1; i <= 4; i++) {
    const a = Math.PI - (i / 4) * (Math.PI / 2);
    path.push([ax + 0.035 + rr * Math.cos(a), top - 0.035 + rr * Math.sin(a)]);
  }
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI / 2 - (i / 4) * (Math.PI / 2);
    path.push([W - 0.035 + rr * Math.cos(a), top - 0.035 + rr * Math.sin(a)]);
  }
  path.push([W + h2 + 0.001, 0.45], [W + h2 + 0.003, 0.33], [W + h2 + 0.006, 0.22], [W + h2 + 0.01, 0.12]);
  // 路徑長：繞過外側圓角之後開始垂下
  let hang = 0, len = 0;
  for (let i = 1; i < path.length; i++) {
    len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (!hang && path[i][0] >= W + h2 && path[i][1] <= top - 0.035) hang = len;
  }
  // 垂下處的直向波浪摺（波長 11 cm、往下漸大到 9 mm），坐墊與扶手上只有 1–2 mm 的鬆軟起伏
  const TW = 0.43, zc = 1.76, rip = (s: number, z: number) =>
    0.009 * THREE.MathUtils.smoothstep(s, hang, hang + 0.3) * Math.sin(z * 55 + 1.3) + 0.0015 * Math.sin(s * 31 + z * 17) * Math.sin(z * 23 - s * 9);
  add(g, drape(path, TW, TH, rip), mat.wool, 0, 0, zc);
  // 流蘇：下緣每 1.2 cm 一根，長 3 cm，跟著波浪
  const [fx, fy] = path[path.length - 1], fringe = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0018, 0.0012, 0.03, 4), mat.wool, 36);
  const fm = new THREE.Matrix4();
  for (let i = 0; i < 36; i++) {
    const z = -TW / 2 + 0.006 + (i * (TW - 0.012)) / 35;
    fringe.setMatrixAt(i, fm.makeTranslation(fx + rip(len, z) + 0.001 * Math.sin(i * 2.1), fy - 0.016, zc + z));
  }
  fringe.castShadow = true;
  g.add(fringe);

  b.solids.push([X(ox), Z(oy), X(ox) + D, Z(ey)], [X(ox) + D, Z(ey) - D, X(ex), Z(ey)]);
}

/**
 * 茶几，參考 Gubi Epic Ø80（GamFratesi，型錄）：洞石圓桌板厚 2 cm、方邊（微倒角 1.5 mm），
 * 六角柱底座每邊 23 cm（對角 46、對邊 39.8），總高 38.5。
 */
export function coffeeTable(b: Build, it: ItemOf<'coffeeTable'>): void {
  const { mat } = b;
  const [x, y] = it.at, H = 0.385, T = 0.02, n = 96;
  const g = new THREE.Group();
  g.position.set(X(x), 0, Z(y));
  b.root.add(g);
  const circle = Array.from({ length: n }, (_, i) => new THREE.Vector2(it.r * Math.cos((i / n) * 2 * Math.PI), it.r * Math.sin((i / n) * 2 * Math.PI)));
  const top = add(g, slab(new THREE.Shape(circle), T, 0.0015), mat.travertine, 0, H - T, 0);
  worldUV(top.geometry, top.getWorldPosition(new THREE.Vector3()));
  const hex = Array.from({ length: 6 }, (_, i): [number, number] => [0.23 * Math.cos((i * Math.PI) / 3), 0.23 * Math.sin((i * Math.PI) / 3)]);
  const base = add(g, slab(roundedPolygon(hex, 0.006), H - T, 0.003), mat.travertine);
  worldUV(base.geometry, new THREE.Vector3(X(x), 0, Z(y)));
  b.solids.push([X(x) - it.r, Z(y) - it.r, X(x) + it.r, Z(y) + it.r]);
}

/** 方料：從 a 到 b（群組本地公尺），斷面 w × d（w 沿本地 x），邊緣小圓角 */
function beam(g: THREE.Object3D, a: THREE.Vector3, c: THREE.Vector3, w: number, d: number, m: THREE.Material, r = 0.004): THREE.Mesh {
  const dir = c.clone().sub(a);
  const me = gbox(g, w, dir.length(), d, 0, 0, 0, m, r);
  me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  me.position.copy(a).add(c).multiplyScalar(0.5);
  worldUV(me.geometry, me.position);
  return me;
}

/** 薄片格網（x 寬 w、z 深 d、厚 t 沿 y），f(x, y, z) 把每一點搬到新位置；用來做皮革吊帶座面、椅背 */
function sheet(w: number, d: number, t: number, nx: number, nz: number, f: (x: number, y: number, z: number) => THREE.Vector3): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, t, d, nx, 1, nz), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const o = f(p.getX(i), p.getY(i), p.getZ(i));
    p.setXYZ(i, o.x, o.y, o.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * 皮革單椅，參考 Fredericia The Spanish Chair 2226（Børge Mogensen），尺寸依官方線圖：寬 82.5、深 60、高 67、座高 33。
 * 胡桃木實木框：扶手板 15 寬 × 2.6 厚、上緣 53.4，內緣與椅腳內面齊、往外懸出 9 cm；椅腳 6 × 3.2（寬面朝前），
 * 前腳往前張 3°、後腳後傾 8°（腳底在扶手接點後 7 cm）；椅背柱後傾 15° 到 67（頂蓋）。
 * 鞍皮座面包住兩側座框（前高 36.7、後 32.4，前端伸出前腳 6 cm），下方三條橫帶、扣環在中心兩側 15 cm；
 * 椅背皮 38–65 高、約 47 寬，上緣往後垂約 6 cm，兩側以皮帶繞在椅背柱上。前腳之間一支橫撐（14–20.6）。
 * 本地座標：x 橫向、y 向上、−z 為正面（朝 faceTo）。
 */
export function armchair(b: Build, it: ItemOf<'armchair'>): void {
  const { mat } = b;
  const [x, y] = it.at, [fx, fy] = it.faceTo;
  const g = new THREE.Group();
  g.position.set(X(x), 0, Z(y));
  g.rotation.y = Math.atan2(-(fx - x), -(fy - y));
  b.root.add(g);
  const V = (a: number, c: number, d: number) => new THREE.Vector3(a, c, d);
  const DEG = Math.PI / 180, ARM_T = 0.534, ARM_B = ARM_T - 0.026, LEG_X = 0.2625 + 0.03;

  for (const s of [-1, 1]) {
    // 椅腳（寬面朝前）：前腳往前張、後腳往後傾
    beam(g, V(s * LEG_X, ARM_B, -0.235), V(s * LEG_X, 0, -0.235 - ARM_B * Math.tan(3 * DEG)), 0.06, 0.032, mat.walnut);
    beam(g, V(s * LEG_X, ARM_B, 0.21), V(s * LEG_X, 0, 0.28), 0.06, 0.032, mat.walnut);
    // 扶手板：內緣齊椅腳內面
    const am = gbox(g, 0.15, ARM_T - ARM_B, 0.5, s * (0.2625 + 0.075), (ARM_T + ARM_B) / 2, -0.02, mat.walnut, 0.008);
    worldUV(am.geometry, am.position);
    // 椅背柱（後傾 15°）＋頂蓋
    const p0 = V(s * 0.248, 0.3, 0.19), p1 = V(s * 0.248, 0.658, 0.19 + 0.358 * Math.tan(15 * DEG));
    beam(g, p0, p1, 0.032, 0.032, mat.walnut);
    const cap = beam(g, p1, p1.clone().add(V(0, 0.012, 0.012 * Math.tan(15 * DEG))), 0.04, 0.04, mat.walnut, 0.005);
    cap.castShadow = true;
    // 包皮座框：前端伸出前腳 6 cm，往後降 4.3 cm
    beam(g, V(s * 0.245, 0.3445, -0.31), V(s * 0.245, 0.3015, 0.2), 0.034, 0.05, mat.saddle, 0.01);
    // 椅背皮繞柱的皮帶與扣環（外側看得到）
    const band = (h: number) => p0.clone().lerp(p1, (h - 0.3) / 0.358);
    beam(g, band(0.38), band(0.44), 0.042, 0.042, mat.saddle, 0.008);
    gbox(g, 0.006, 0.03, 0.026, s * 0.27, 0.41, band(0.41).z, mat.steel, 0.002);
  }
  // 前腳橫撐、座面後緣橫料
  gbox(g, 0.525, 0.066, 0.022, 0, 0.173, -0.248, mat.walnut, 0.004);
  gbox(g, 0.47, 0.04, 0.03, 0, 0.29, 0.2, mat.walnut, 0.004);

  // 座面：兩側座框之間的鞍皮，中間下垂 2.5 cm，跟著座框前高後低
  const seatY = (z: number) => 0.3695 + ((z + 0.31) / 0.51) * (0.3265 - 0.3695);
  const seat = add(g, sheet(0.5, 0.51, 0.005, 20, 6, (sx, sy, sz) => {
    const z = sz - 0.055;
    return V(sx, seatY(z) - 0.025 * (1 - (sx / 0.25) ** 2) + sy, z);
  }), mat.saddle);
  worldUV(seat.geometry, seat.position);
  // 座面下三條橫帶與扣環（離地 27–29）
  for (const z of [-0.11, 0.05, 0.2]) {
    add(g, sheet(0.49, 0.03, 0.004, 12, 1, (sx, sy, sz) => V(sx, 0.315 - 0.03 * (1 - (sx / 0.245) ** 2) + sy, z + sz)), mat.saddle);
    for (const s of [-1, 1]) gbox(g, 0.035, 0.006, 0.036, s * 0.15, 0.286, z, mat.steel, 0.002);
  }

  // 椅背皮：38–65 高，沿椅背柱後傾，上緣往後垂 6 cm（下緣 2.5）；薄片的 z 當高度、厚度轉成前後
  const backZ = (h: number) => 0.19 + (h - 0.3) * Math.tan(15 * DEG);
  const backL = add(g, sheet(0.47, 0.27, 0.005, 16, 8, (sx, sy, sz) => {
    const v = (sz + 0.135) / 0.27, h = 0.38 + 0.27 * v, bow = (0.025 + 0.035 * v) * (1 - (sx / 0.235) ** 2);
    return V(sx, h, backZ(h) + bow - sy);
  }), mat.saddle);
  worldUV(backL.geometry, backL.position);

  b.solids.push([X(x) - 0.38, Z(y) - 0.38, X(x) + 0.38, Z(y) + 0.38]);
}

/** HAY About A Stool AAS 32 Low 尺寸（見 barStool） */
/** HAY 型錄：落地 47 × 43、座高 65、靠背頂在座面上 10、腳踏離地 23；座殼約 41 × 37（估）、腳 4.5 × 2 模壓夾板（估）、腳踏鋼管 Ø1.8（估） */
const STOOL = { seatH: 0.65, backH: 0.75, seatW: 0.41, seatD: 0.37, footW: 0.47, footD: 0.43, legW: 0.045, legT: 0.022, ringH: 0.23, back: 0.012 };

/**
 * 吧台椅，參考 HAY About A Stool AAS 32 Low（Hee Welling）：47 × 43 × 75、座高 65。
 * 胡桃木四腳往外微張、座面下四片牽板；模壓木皮座面，後半圈升起一道矮弧形靠背（中間 75、兩側較低）；
 * 黑色粉體烤漆鋼管腳踏框。正面朝北（中島），靠背在南。
 */
export function barStool(b: Build, it: ItemOf<'barStool'>): void {
  const { mat } = b;
  const [x, y] = it.at, S = STOOL;
  const g = new THREE.Group();
  g.position.set(X(x), 0, Z(y));
  b.root.add(g);
  const top = S.seatH - 0.015;
  // 椅腳：座面下角往地面外張
  const legTop = (sx: number, sz: number) => new THREE.Vector3(sx * (S.seatW / 2 - 0.03), top - 0.005, sz * (S.seatD / 2 - 0.03));
  const legBot = (sx: number, sz: number) => new THREE.Vector3(sx * (S.footW / 2 - S.legW / 2), 0, sz * (S.footD / 2 - S.legT / 2));
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) beam(g, legTop(sx, sz), legBot(sx, sz), S.legW, S.legT, mat.walnut, 0.006);
  // 座下牽板
  for (const [w, d, px, pz] of [[S.seatW - 0.06, 0.018, 0, -(S.seatD / 2 - 0.04)], [S.seatW - 0.06, 0.018, 0, S.seatD / 2 - 0.04],
    [0.018, S.seatD - 0.06, -(S.seatW / 2 - 0.04), 0], [0.018, S.seatD - 0.06, S.seatW / 2 - 0.04, 0]] as const) {
    const ap = gbox(g, w, 0.045, d, px, top - 0.03, pz, mat.walnut, 0.003);
    worldUV(ap.geometry, ap.position);
  }
  // 座面（模壓木皮，中間微凹）
  const seat = add(g, cushion(S.seatW, S.seatD, 0.015, { e: 0.007, r: 0.06, crown: -0.008 }), mat.walnut, 0, top, 0);
  worldUV(seat.geometry, seat.position);
  // 靠背：沿座面後半圈的弧形板，頂緣中間高、往兩側降低
  const n = 24, outer: THREE.Vector2[] = [], inner: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (i / n);   // 0 = 東側、π/2 = 正後方、π = 西側
    const rx = S.seatW / 2 - 0.005, rz = S.seatD / 2 - 0.005;
    outer.push(new THREE.Vector2(rx * Math.cos(a), rz * Math.sin(a)));
    inner.push(new THREE.Vector2((rx - S.back) * Math.cos(a), (rz - S.back) * Math.sin(a)));
  }
  const bandGeo = slab(new THREE.Shape([...outer, ...inner.reverse()]), S.backH - S.seatH + 0.01, 0.003);
  const p = bandGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0.02) continue;
    const a = Math.atan2(p.getZ(i), p.getX(i)), k = 0.55 + 0.45 * Math.sin(Math.max(0, a));
    p.setY(i, p.getY(i) * k);
  }
  bandGeo.computeVertexNormals();
  const band = add(g, bandGeo, mat.walnut, 0, S.seatH - 0.01, 0);
  worldUV(band.geometry, band.position);
  // 腳踏：黑色鋼管框繞四腳
  const ring = corners.map(([sx, sz]) => legTop(sx, sz).lerp(legBot(sx, sz), 1 - S.ringH / (top - 0.005)));
  for (let i = 0; i < 4; i++) {
    const a = ring[i], c = ring[(i + 1) % 4], dir = c.clone().sub(a);
    const tube = add(g, new THREE.CylinderGeometry(0.009, 0.009, dir.length() + S.legT, 12), mat.black);
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    tube.position.copy(a).add(c).multiplyScalar(0.5);
  }
  b.solids.push([X(x) - S.footW / 2, Z(y) - S.footD / 2, X(x) + S.footW / 2, Z(y) + S.footD / 2]);
}
