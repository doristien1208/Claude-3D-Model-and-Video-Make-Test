import type * as THREE from 'three';
import { CEILING_H as H, CURTAIN_BOX, site, windowSpecs, type WindowSpec } from '../data/layout';
import { findOpening, isHorizontal } from '../data/query';
import { rectAlong, type BoxOpt, type Build } from './prims';

/* ---------- 尺寸（px = cm，高度為 m） ---------- */
const SETBACK = 2;   // 外框離外牆面
const DEPTH = 7;     // 外框深
const FW = 5;        // 外框面寬（高度方向 0.05 m）
const MULLION = 6;   // 推射窗扇之間的中梃
const SASH = 4;      // 推射窗扇框寬
const SASH_D = 4.5;  // 推射窗扇深（貼外框室內側）
const GLASS = 0.6;   // 玻璃厚
const SILL_OUT = 3;  // 石材窗台凸出牆面
const PAD = 0.6;     // 牆體在開口邊多伸出的量（見 architecture.ts），窗洞側面實際在 s + PAD

/** 外牆上一扇窗的局部座標：ce 為外牆面、ci 為室內牆面，σ 為由外往內的方向 */
export interface WinFrame {
  hor: boolean;
  s: number;
  e: number;
  bot: number;
  top: number;
  ce: number;
  ci: number;
  σ: 1 | -1;
}

export function winFrame(openingId: string): WinFrame {
  const { wall, opening } = findOpening(openingId);
  const hor = isHorizontal(wall), c = hor ? wall.a[1] : wall.a[0];
  const [fx1, fy1, fx2, fy2] = site.floor;
  const σ = (hor ? (fy1 + fy2) / 2 : (fx1 + fx2) / 2) > c ? 1 : -1;
  return { hor, s: opening.s, e: opening.e, bot: opening.bot, top: opening.top, ce: c - (σ * wall.t) / 2, ci: c + (σ * wall.t) / 2, σ };
}

export const windowSpec = (openingId: string): WindowSpec | undefined => windowSpecs.find((w) => w.opening === openingId);

/** 固定窗＋推射窗：外框、中楣、固定玻璃、推射窗扇（含把手）、室內窗台 */
function windowUnit(b: Build, spec: WindowSpec, ceiling: THREE.Group): void {
  const { mat } = b;
  const f = winFrame(spec.opening);
  const { s, e, bot, top, ce, ci, σ } = f;
  const B = (a0: number, a1: number, k0: number, k1: number, h0: number, h1: number, m: THREE.Material, opt?: BoxOpt) =>
    b.box(rectAlong(f.hor, a0, a1, k0, k1), h0, h1, m, opt);
  const k0 = ce + σ * SETBACK, k1 = ce + σ * (SETBACK + DEPTH), kc = (k0 + k1) / 2;
  const F = FW / 100, glass = spec.frosted ? mat.frosted : mat.glass;

  // 外框
  B(s, e, k0, k1, top - F, top, mat.alu);
  B(s, e, k0, k1, bot, bot + F, mat.alu);
  B(s, s + FW, k0, k1, bot + F, top - F, mat.alu);
  B(e - FW, e, k0, k1, bot + F, top - F, mat.alu);

  // 推射窗扇在下方一排（或整扇）；寬於 1.2 m 分兩扇
  const aTop = spec.awning === 'all' ? top - F : bot + (spec.awningH ?? 0.5);
  if (spec.awning === 'bottom') {
    B(s + FW, e - FW, k0, k1, aTop - 0.03, aTop + 0.03, mat.alu);
    B(s + FW, e - FW, kc - GLASS / 2, kc + GLASS / 2, aTop + 0.03, top - F, glass, { cast: false });
  }
  const sashTop = spec.awning === 'all' ? top - F : aTop - 0.03;
  const inner = e - s - 2 * FW, n = inner > 120 ? 2 : 1, span = (inner - (n - 1) * MULLION) / n;
  const q0 = k1 - σ * SASH_D, q1 = k1 - σ * 0.3, qc = (q0 + q1) / 2, S = SASH / 100;
  for (let i = 0; i < n; i++) {
    const a0 = s + FW + i * (span + MULLION), a1 = a0 + span, h0 = bot + F, h1 = sashTop;
    if (i > 0) B(a0 - MULLION, a0, k0, k1, h0, h1, mat.alu);
    B(a0, a1, q0, q1, h0, h0 + S, mat.alu);
    B(a0, a1, q0, q1, h1 - S, h1, mat.alu);
    B(a0, a0 + SASH, q0, q1, h0 + S, h1 - S, mat.alu);
    B(a1 - SASH, a1, q0, q1, h0 + S, h1 - S, mat.alu);
    B(a0 + SASH, a1 - SASH, qc - GLASS / 2, qc + GLASS / 2, h0 + S, h1 - S, glass, { cast: false });
    // 推射窗把手：下框中央，往室內凸出 2 cm
    const am = (a0 + a1) / 2;
    B(am - 5, am + 5, q1, q1 + σ * 2, h0 + 0.012, h0 + 0.028, mat.black);
  }

  // 室內窗台：上緣比窗洞底高 1 cm
  if (spec.sill === 'stone') B(s, e, k1, ci + σ * SILL_OUT, bot - 0.01, bot + 0.01, mat.stoneWarm);
  else if (spec.sill === 'flush') B(s, e, k1, ci, bot - 0.01, bot + 0.01, mat.stone);
  else {
    // 衛浴：窗洞內側（側面、上方、窗台）都貼石材，與牆面石材平齊
    const t = ci + σ * 1, o = { cast: false };
    B(s, e, k1, t, bot - 0.01, bot + 0.01, mat.tileLight, o);
    B(s + PAD, s + PAD + 0.5, k1, t, bot, top, mat.tileLight, o);
    B(e - PAD - 0.5, e - PAD, k1, t, bot, top, mat.tileLight, o);
    B(s, e, k1, t, top - 0.005, top, mat.tileLight, o);
  }

  // 窗簾盒：做滿整面牆的面板＋兩端封板＋盒內軌道，跟天花板同一組（俯瞰時隱藏）
  if (spec.curtainBox) {
    const { from, to } = spec.curtainBox, D = CURTAIN_BOX.depth, h0 = CURTAIN_BOX.h0;
    for (const m of [
      B(from, to, ci + σ * (D - 2), ci + σ * D, h0, H, mat.ceil),
      B(from, from + 2, ci, ci + σ * D, h0, H, mat.ceil),
      B(to - 2, to, ci, ci + σ * D, h0, H, mat.ceil),
      B(from + 2, to - 2, ci + σ * 8, ci + σ * 9, 2.74, 2.76, mat.alu),
    ]) ceiling.add(m);
  }
}

export function buildWindows(b: Build, ceiling: THREE.Group): void {
  for (const spec of windowSpecs) windowUnit(b, spec, ceiling);
}
