import * as THREE from 'three';
import { BULKHEAD_H, CEILING_H as H, coves, lighting, type Cove } from '../data/layout';
import { rectAlong, type Build } from './prims';

/*
 * 局部降板與間接燈。參考：
 *  - 跌級燈溝：擋光板比燈條高、開口（擋光板上緣到天花）至少 150 mm（Odelic、Nulty「150 mm 原則」）；燈條藏在擋光板後 40–75 mm
 *  - 洗牆燈溝：貼牆與天花的交角留 70–100 mm 的縫（Fuji Sash スリットコーニス、Panasonic）
 *  - 光暈：擋光板正上方最亮、往室內漸淡；開口越大越柔和（Odelic、DAIKO）
 * 燈條用面光源（RectAreaLight）實際照亮天花與牆面，每公尺流明見 layout.ts lighting.strips。
 */
const BOARD = 2;        // 降板板厚（px，高度方向 0.02 m）
const LIP = 0.03;       // 擋光板比板面高（m）

function trough(b: Build, c: Extract<Cove, { kind: 'trough' }>, ceiling: THREE.Group): void {
  const { mat } = b;
  const k = (d: number) => c.face + c.into * d; // 離牆 d px 的 across 座標
  const R = (a0: number, a1: number, d0: number, d1: number) => rectAlong(c.hor, a0, a1, k(d0), k(d1));
  const top = BULKHEAD_H + BOARD / 100;
  const parts = [
    b.box(R(c.from, c.to, 0, c.width), BULKHEAD_H, top, mat.ceil),                         // 降板底板
    b.box(R(c.from, c.to, c.width - 2, c.width), BULKHEAD_H, top + LIP, mat.ceil),          // 擋光板
  ];
  if (c.cap) {
    const a = c.cap === 'from' ? c.from : c.to - 2;
    parts.push(b.box(R(a, a + 2, 0, c.width), BULKHEAD_H, H, mat.ceil));                    // 自由端封板
  }
  // COB 燈條：板面上、擋光板後 5 cm，往上打天花
  const led = b.box(R(c.from + 3, c.to - 3, c.width - 7.5, c.width - 5.5), top, top + 0.008, mat.glow, { cast: false });
  b.glow.push(led);
  for (const m of [...parts, led]) ceiling.add(m);
  const [x, y] = c.hor ? [(c.from + c.to) / 2, k(c.width - 6.5)] : [k(c.width - 6.5), (c.from + c.to) / 2];
  b.stripLight(x, y, top + 0.009, (c.to - c.from - 6) / 100, 0.02, c.hor, 'up', lighting.strips.cove);
}

function washSlot(b: Build, c: Extract<Cove, { kind: 'washSlot' }>, ceiling: THREE.Group): void {
  const { mat } = b;
  const k = (d: number) => c.face + c.into * d;
  const R = (a0: number, a1: number, d0: number, d1: number) => rectAlong(c.hor, a0, a1, k(d0), k(d1));
  const lit = Math.abs(c.litFace - c.face);           // 被照面離牆的距離
  const s0 = lit, s1 = lit + c.slot;                  // 縫的範圍（離牆）
  const parts = [
    b.box(R(c.from, c.to, s1, c.depth), BULKHEAD_H, BULKHEAD_H + BOARD / 100, mat.ceil),   // 底板
    b.box(R(c.from, c.to, s1, s1 + 2), BULKHEAD_H, H, mat.ceil),                           // 縫側立板
    b.box(R(c.from, c.to, c.depth - 2, c.depth), BULKHEAD_H, H, mat.ceil),                 // 前緣面板
  ];
  if (c.cap) {
    const a = c.cap === 'from' ? c.from : c.to - 2;
    parts.push(b.box(R(a, a + 2, 0, c.depth), BULKHEAD_H, H, mat.ceil));
  }
  // 燈條：縫內靠近天花，往下沿被照面洗牆
  const led = b.box(R(c.from + 2, c.to - 2, s0 + 3, s0 + 5), H - 0.03, H - 0.02, mat.glow, { cast: false });
  b.glow.push(led);
  for (const m of [...parts, led]) ceiling.add(m);
  const [x, y] = c.hor ? [(c.from + c.to) / 2, k(s0 + 4)] : [k(s0 + 4), (c.from + c.to) / 2];
  b.stripLight(x, y, H - 0.031, (c.to - c.from - 4) / 100, 0.02, c.hor, 'down', lighting.strips.cove);
}

export function buildCoves(b: Build, ceiling: THREE.Group): void {
  for (const c of coves) {
    if (c.kind === 'trough') trough(b, c, ceiling);
    else washSlot(b, c, ceiling);
  }
}
