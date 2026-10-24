import * as THREE from 'three';
import { X, Z } from '../core/units';
import type { Side } from '../data/layout';
import type { ItemOf } from '../data/query';
import { tolomeoArm } from './fixtures';
import { FACING_YAW, add, gbox, leanOn, rbox, worldUV, type Build } from './prims';
import { cushion, pillow, samples, thickGrid, type PillowOpt } from './shapes';

/*
 * 臥室（2026-10 依調查重做；公尺）：
 *  床    歐規床墊 180 × 200（主臥）／160 × 200（客房），厚 28／25；布面床座 22 高放在內縮的深色踢腳上（IKEA LYNGÖR、Smilow 懸浮床架）
 *  寢具  被子 240 × 260／220 × 240，中間鬆 7、邊緣滾邊 2，兩側垂下約 30，床頭端往回折約 1/4；
 *        歐式方枕 65 × 65（加 5 cm 平邊、鼓 18）×2 立靠、枕頭 50 × 75（鼓 14）×2、腰枕 30 × 50；床尾巾 55 寬、0.8 厚
 *        （IKEA 枕套尺寸、wald 床尾巾、飯店與樣品屋鋪法）
 *  床頭櫃 Article Lenia／EQ3 Marcel：抽屜面板退在櫃框內 3.5 cm，上緣一道木唇當取手
 *  壁燈  Artemide Tolomeo Micro Wall（黑 A010930）：圓形拋光壁座 Ø9.8、下臂約 30、上臂約 32（肘後尾端 4.5）、管徑 1.1、
 *        燈頭 Ø10.8，彈簧藏在管內、不鏽鋼拉線沿管外
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** 朝向 → 世界平面方向（x, 0, z） */
const FACING_DIR: Record<Side, [number, number, number]> = { N: [0, 0, -1], S: [0, 0, 1], E: [1, 0, 0], W: [-1, 0, 0] };

/**
 * 床（床頭朝北，rect 含床頭板）。本地座標：x 橫向（中心 0）、z 從床座床頭端（0）往床尾（L）。
 * 踢腳內縮 10、高 8 → 布面床座到 0.30 → 床墊 → 床單（白）→ 被子＋往回折的一段 → 床尾巾 → 枕頭。
 */
export function bed(b: Build, it: ItemOf<'bed'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, hb = it.headboard?.t ?? 0;
  const W = (x2 - x1) / 100, L = (y2 - y1 - hb) / 100;
  const g = new THREE.Group();
  g.position.set(X((x1 + x2) / 2), 0, Z(y1 + hb));
  b.root.add(g);
  const PL = 0.08, BASE = 0.3, top = BASE + it.mattress, IN = 0.1;

  if (it.headboard) rbox(g, -W / 2 - 0.02, -hb / 100, W / 2 + 0.02, 0, 0, it.headboard.h, mat.headboard, 0.04);
  rbox(g, -W / 2 + IN, IN, W / 2 - IN, L - IN, 0, PL, mat.black, 0.005);
  rbox(g, -W / 2, 0, W / 2, L, PL, BASE, mat.headboard, 0.02);
  // 床墊（套白色床包）：圓邊半徑 RW，被子沿這個圓邊垂下
  const RW = 0.045;
  add(g, cushion(W - 0.01, L - 0.01, it.mattress, { e: RW, r: 0.05, crown: 0.006 }), mat.linen, 0, BASE, L / 2);

  /* ---------- 被子 ---------- */
  // 床墊頂面平的範圍：x ±A、z ≤ B；外表面過了這個範圍就繞著半徑 R（床墊圓邊＋被子邊緣厚）往下垂，角落沿對角線垂得更低
  const A = W / 2 - RW, B = L - RW, TE = 0.02, TM = 0.07;
  const [DW, DL] = it.duvet, FOLD = 0.45, FB = DL / 4;
  const wrap = (u: number, v: number, y0: number, R: number) => {
    const px = THREE.MathUtils.clamp(u, -A, A), pz = Math.min(v, B);
    const ex = u - px, ez = v - pz, d = Math.hypot(ex, ez);
    if (d < 1e-6) return V(u, y0, v);
    const nx = ex / d, nz = ez / d, arc = (Math.PI / 2) * R, cy = y0 - R;
    if (d <= arc) {
      const th = d / R;
      return V(px + nx * R * Math.sin(th), cy + R * Math.cos(th), pz + nz * R * Math.sin(th));
    }
    // 垂下的部分：往下微微外張，沿邊緣有直向的波浪摺
    const s = d - arc, k = Math.min(1, s / 0.3), along = Math.abs(ex) >= Math.abs(ez) ? v : u;
    const out = R + 0.03 * k * k + 0.012 * k * Math.sin(along * 24 + 0.7);
    return V(px + nx * out, cy - s, pz + nz * out);
  };
  // 被子鬆度：中間 7、邊緣 3；頂面再加一點不規則的起伏
  const loft = (u: number, v: number, v0: number) => {
    const px = THREE.MathUtils.clamp(u, -A, A), pz = Math.min(v, B);
    const sx = Math.sqrt(Math.max(0, 1 - (px / A) ** 2)), sz = THREE.MathUtils.smoothstep(pz, v0, v0 + 0.25) * (1 - THREE.MathUtils.smoothstep(pz, B - 0.25, B));
    return TE + (TM - TE) * sx * sz;
  };
  const ripple = (u: number, v: number) => 0.006 * Math.sin(u * 7.3 + v * 2.9) * Math.sin(v * 5.1 - u * 2.3);
  const main = (u: number, v: number) => {
    const p = wrap(u, v, top + TE, RW + TE);
    const px = THREE.MathUtils.clamp(u, -A, A), pz = Math.min(v, B), inside = Math.abs(u - px) < 1e-6 && Math.abs(v - pz) < 1e-6;
    if (inside) p.y = top + loft(u, v, FOLD) + ripple(u, v);
    return p;
  };
  const mainT = (u: number, v: number) => loft(u, v, FOLD);
  // 外表面的法線（往上），用來把折回的一段、床尾巾疊在被子上
  const normalOf = (f: (u: number, v: number) => THREE.Vector3, u: number, v: number) => {
    const e = 0.002, du = f(u + e, v).sub(f(u - e, v)), dv = f(u, v + e).sub(f(u, v - e));
    return dv.cross(du).normalize();
  };
  const us = samples(-DW / 2, DW / 2, 0.05, [-A, A], 0.15, 0.015);
  const vEnd = FOLD + DL - FB;
  add(g, thickGrid(us, samples(FOLD, vEnd, 0.05, [B], 0.15, 0.015), main, mainT), mat.duvet);
  // 往回折的一段（FB 長）：疊在被子上，厚度約一半
  const turn = (u: number, v: number) => main(u, v).addScaledVector(normalOf(main, u, v), 0.5 * mainT(u, v) + 0.004);
  add(g, thickGrid(us, samples(FOLD, FOLD + FB, 0.05), turn, (u, v) => 0.5 * mainT(u, v)), mat.duvet);
  // 床尾巾 55 寬、0.6 cm 厚，橫放在床尾前 45 cm，兩側跟著被子垂下
  const RZ = L - 0.45, RL = 0.55;
  const runner = (u: number, v: number) => main(u, v).addScaledVector(normalOf(main, u, v), 0.009);
  add(g, thickGrid(samples(-DW / 2, DW / 2, 0.05, [-A, A], 0.15, 0.015), samples(RZ - RL / 2, RZ + RL / 2, 0.05), runner, () => 0.008), mat.wool);

  /* ---------- 枕頭 ---------- */
  const deg = Math.PI / 180, S = V(0, 0, 1);
  let seed = x1;
  const P = (w: number, h: number, t: number, m: THREE.Material, x: number, y: number, z: number, tilt: number, roll: number, o: PillowOpt = {}) =>
    leanOn(g, pillow(w, h, t, { seed: ++seed, ...o }), m, V(x, y, z), S, h, tilt * deg, roll * deg);
  // 歐式方枕立靠床頭板，前面兩個枕頭斜靠，最前面一個腰枕
  for (const s of [-1, 1]) {
    P(0.65, 0.65, 0.18, mat.bedOat, s * 0.38, top + 0.04, 0.1, 12, s * 1.5, { flange: 0.05, crease: 0.0025, settle: 0.1, back: 0.85 });
    P(0.75, 0.5, 0.14, mat.linen, s * 0.385, top - 0.005, 0.3, 28, -s * 2, { crease: 0.002, settle: 0.06 });
  }
  P(0.5, 0.3, 0.11, mat.ochre, 0, top + 0.05, 0.5, 18, 1, { crease: 0.003, settle: 0.1 });

  b.solids.push([X(x1), Z(y1), X(x2), Z(y2)]);
}

/** 布面床頭板（客房）：壁掛軟包板，圓角 */
export function headboardPanel(b: Build, it: ItemOf<'headboardPanel'>): void {
  const [x1, y1, x2, y2] = it.rect;
  rbox(b.root, X(x1), Z(y1), X(x2), Z(y2), it.h[0], it.h[1], b.mat.headboard, 0.012);
}

/**
 * 懸浮床頭櫃，參考 Article Lenia（50.2 × 38.7 × 15.2）、EQ3 Marcel：胡桃木單抽屜，壁掛木條藏在背板後；
 * 櫃框板 1.9 cm，抽屜面板退在框內 3.5 cm、四周 3 mm 縫，面板上緣一道往前凸 1.2 cm 的木唇，下面挖空讓手指勾。
 * 本地座標：x 沿正面、z 朝外（front 方向）。
 */
export function nightstand(b: Build, it: ItemOf<'nightstand'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, [h0, h1] = it.h;
  const alongX = it.front === 'N' || it.front === 'S';
  const w = (alongX ? x2 - x1 : y2 - y1) / 100, d = (alongX ? y2 - y1 : x2 - x1) / 100, H = h1 - h0;
  const g = new THREE.Group();
  g.position.set(X((x1 + x2) / 2), h0, Z((y1 + y2) / 2));
  g.rotation.y = FACING_YAW[it.front];
  b.root.add(g);
  const T = 0.019, GAP = 0.003, INSET = 0.035, LIP = 0.022;
  // 櫃框：頂板、底板、兩側板、背板
  gbox(g, w, T, d, 0, H - T / 2, 0, mat.walnut, 0.002);
  gbox(g, w, T, d, 0, T / 2, 0, mat.walnut, 0.002);
  for (const s of [-1, 1]) gbox(g, T, H - 2 * T, d, s * (w / 2 - T / 2), H / 2, 0, mat.walnut, 0.001);
  gbox(g, w - 2 * T, H - 2 * T, T, 0, H / 2, -d / 2 + T / 2, mat.walnut, 0);
  // 抽屜面板（退 3.5 cm）、上緣木唇、唇下的手指凹槽
  const fw = w - 2 * T - 2 * GAP, fh = H - 2 * T - 2 * GAP, fz = d / 2 - INSET;
  gbox(g, w - 2 * T, H - 2 * T, 0.004, 0, H / 2, fz - 0.02, mat.gap, 0);
  gbox(g, fw, fh - LIP, 0.018, 0, T + GAP + (fh - LIP) / 2, fz - 0.009, mat.walnut, 0.001);
  gbox(g, fw, LIP, 0.03, 0, H - T - GAP - LIP / 2, fz + 0.003, mat.walnut, 0.006);
  gbox(g, fw - 0.01, 0.008, 0.012, 0, H - T - GAP - LIP - 0.004, fz + 0.004, mat.gap, 0);
  for (const m of g.children) worldUV((m as THREE.Mesh).geometry, m.position);
  b.solids.push([X(Math.min(x1, x2)), Z(Math.min(y1, y2)), X(Math.max(x1, x2)), Z(Math.max(y1, y2))]);
}

/**
 * 床頭搖臂壁燈，參考 Artemide Tolomeo Micro Wall（黑 A010930）：圓形拋光壁座＋U 形夾座，黑色鋁管下臂 30、上臂 32，
 * 肘後留 4.5 cm 尾端，不鏽鋼拉線沿管外；燈頭 Ø10.8 × 11.5 圓錐，往下照枕頭。
 * at 為壁座（牆面上的點）、h 為壁座中心高，head 為燈頭頂端（上臂末端）位置（平面 px）與高度 headH。
 */
export function wallLamp(b: Build, it: ItemOf<'wallLamp'>): void {
  const { mat } = b;
  const base = V(X(it.at[0]), it.h, Z(it.at[1])), out = V(...FACING_DIR[it.facing]);
  const head = V(X(it.head[0]), it.headH, Z(it.head[1]));
  const plate = new THREE.Group();
  plate.position.copy(base);
  plate.rotation.y = FACING_YAW[it.facing];
  b.root.add(plate);
  // 壁座圓盤 Ø9.8、厚 1.2；U 形夾座伸出 4 cm
  add(plate, new THREE.CylinderGeometry(0.049, 0.049, 0.012, 40).rotateX(Math.PI / 2), mat.steel, 0, 0, 0.006);
  for (const s of [-1, 1]) gbox(plate, 0.004, 0.026, 0.035, s * 0.011, 0, 0.03, mat.steel, 0.0015);
  tolomeoArm(b, base.clone().addScaledVector(out, 0.04), head, 0.3, 0.32);
}
