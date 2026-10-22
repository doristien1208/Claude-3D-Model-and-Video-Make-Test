import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { X, Z } from '../core/units';
import { CEILING_H as H, CURTAIN_BOX, site, windowSpecs, type WindowSpec } from '../data/layout';
import { findOpening, isHorizontal } from '../data/query';
import { rectAlong, worldUV, type BoxOpt, type Build } from './prims';

/*
 * 鋁窗斷面（px = cm），參考 YKK AP 台灣 YRB-A 型錄斷面圖：
 *  外框：側 2.5、上 3.0、下 5.5，框深 7
 *  橫拉扇：外側立框 4.15、中間交會立框各 2.0（重疊後看到約 4）、上 4.1、下 4.6，扇深 2.8
 *  固定玻璃壓條：2.5；中楣芯 2.0
 *  推射扇：側 6.6、上 5.5、下 4.5，扇深 4
 *  細框固定窗（客廳）：外框 2.5＋壓條 2.0，下框 3.0＋2.0
 */
const SETBACK = 1;    // 外框離外牆面
const DEPTH = 7;
const FRAME = { side: 2.5, head: 3.0, sill: 5.5 };
const SLIDE = { stile: 4.15, meet: 2.0, top: 4.1, bottom: 4.6, depth: 2.8 };
const BEAD = 2.5;
const TRANSOM = 2.0;
const AWNING = { side: 6.6, top: 5.5, bottom: 4.5, depth: 4 };
const GLASS = 0.6;
const SILL_OUT = 2, SILL_EAR = 2.5, SILL_T = 0.02; // 人造石窗台：凸出牆面 2 cm、兩側各長 2.5 cm、厚 2 cm
const PAD = 0.6;      // 牆體在窗洞邊多伸出的量（見 architecture.ts）

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

function windowUnit(b: Build, spec: WindowSpec, ceiling: THREE.Group): void {
  const { mat } = b;
  const f = winFrame(spec.opening);
  const { s, e, bot, top, ce, ci, σ } = f;
  // 霧面玻璃每扇窗一份材質（發光亮度依窗戶朝向不同）
  const glass = spec.frosted ? mat.frosted.clone() : mat.glass;
  const out = f.hor ? new THREE.Vector3(0, 0, -σ) : new THREE.Vector3(-σ, 0, 0);
  // across 以「離外框外側的深度」表示：0 = 外框外緣，DEPTH = 外框內緣
  const k = (d: number) => ce + σ * (SETBACK + d);
  const B = (a0: number, a1: number, d0: number, d1: number, h0: number, h1: number, m: THREE.Material, opt?: BoxOpt) =>
    b.box(rectAlong(f.hor, a0, a1, k(d0), k(d1)), h0, h1, m, opt);
  const m = (v: number) => v / 100; // px → m（高度方向）
  /** 玻璃片（在深度 dc 中央） */
  const pane = (a0: number, a1: number, dc: number, h0: number, h1: number) => {
    const me = B(a0, a1, dc - GLASS / 2, dc + GLASS / 2, h0, h1, glass, { cast: false });
    if (spec.frosted) b.frosted.push({ mesh: me, out });
  };

  /* 外框 */
  const fr = spec.type === 'fixed' ? { side: 2.5, head: 2.5, sill: 3.0 } : FRAME;
  B(s, e, 0, DEPTH, top - m(fr.head), top, mat.alu);
  B(s, e, 0, DEPTH, bot, bot + m(fr.sill), mat.alu);
  B(s, s + fr.side, 0, DEPTH, bot + m(fr.sill), top - m(fr.head), mat.alu);
  B(e - fr.side, e, 0, DEPTH, bot + m(fr.sill), top - m(fr.head), mat.alu);
  const a0 = s + fr.side, a1 = e - fr.side, h0 = bot + m(fr.sill), h1 = top - m(fr.head);

  /** 固定玻璃：四周壓條＋玻璃（玻璃在外框深度中央） */
  const fixedLite = (x0: number, x1: number, y0: number, y1: number, bead = BEAD, d0 = 1.5, d1 = DEPTH - 1.5) => {
    B(x0, x1, d0, d1, y0, y0 + m(bead), mat.alu);
    B(x0, x1, d0, d1, y1 - m(bead), y1, mat.alu);
    B(x0, x0 + bead, d0, d1, y0 + m(bead), y1 - m(bead), mat.alu);
    B(x1 - bead, x1, d0, d1, y0 + m(bead), y1 - m(bead), mat.alu);
    const dc = (d0 + d1) / 2;
    pane(x0 + bead, x1 - bead, dc, y0 + m(bead), y1 - m(bead));
  };
  /** 橫拉扇：dIn 為扇的深度位置（靠室內或靠室外軌道）；lockAt 為鎖的位置（along） */
  const slideSash = (x0: number, x1: number, y0: number, y1: number, d0: number, meetAtStart: boolean, lockAt?: number) => {
    const d1 = d0 + SLIDE.depth, dc = d0 + SLIDE.depth / 2;
    const sw0 = meetAtStart ? SLIDE.meet : SLIDE.stile, sw1 = meetAtStart ? SLIDE.stile : SLIDE.meet;
    B(x0, x1, d0, d1, y0, y0 + m(SLIDE.bottom), mat.alu);
    B(x0, x1, d0, d1, y1 - m(SLIDE.top), y1, mat.alu);
    B(x0, x0 + sw0, d0, d1, y0 + m(SLIDE.bottom), y1 - m(SLIDE.top), mat.alu);
    B(x1 - sw1, x1, d0, d1, y0 + m(SLIDE.bottom), y1 - m(SLIDE.top), mat.alu);
    pane(x0 + sw0, x1 - sw1, dc, y0 + m(SLIDE.bottom), y1 - m(SLIDE.top));
    if (lockAt !== undefined) {
      // 月牙鎖／把手：扇框室內面、扇高中段
      const ym = (y0 + y1) / 2;
      B(lockAt - 1, lockAt + 1, d1, d1 + 1.6, ym - 0.05, ym + 0.05, mat.blackSatin);
    }
  };
  const IN = DEPTH - 0.4 - SLIDE.depth, OUT = 0.4; // 室內軌道、室外軌道的扇深度起點

  switch (spec.type) {
    case 'slideOverFixed': {
      // 下固定（到 splitH）＋中楣＋上方雙扇橫拉，中間交會
      const sp = spec.splitH ?? 1.2;
      B(a0, a1, 0, DEPTH, sp - m(TRANSOM), sp, mat.alu);
      fixedLite(a0, a1, h0, sp - m(TRANSOM));
      const w = (a1 - a0 + SLIDE.meet) / 2;
      slideSash(a0, a0 + w, sp, h1, IN, false, a0 + w - SLIDE.meet / 2);
      slideSash(a1 - w, a1, sp, h1, OUT, true);
      break;
    }
    case 'slideFixedSlide': {
      // 中間固定玻璃在室外側；兩側橫拉扇在室內軌道，可滑到固定玻璃前；鎖在靠窗框的立框
      const inner = a1 - a0, w = inner / 4 + SLIDE.meet / 2;
      fixedLite(a0 + w - SLIDE.meet, a1 - w + SLIDE.meet, h0, h1, BEAD, 0.4, 0.4 + SLIDE.depth + 1);
      slideSash(a0, a0 + w, h0, h1, IN, false, a0 + SLIDE.stile / 2);
      slideSash(a1 - w, a1, h0, h1, IN, true, a1 - SLIDE.stile / 2);
      break;
    }
    case 'awning': {
      // 整扇推射：扇框貼外框室內側，把手在下框中央
      const d0 = DEPTH - 0.3 - AWNING.depth, d1 = DEPTH - 0.3, dc = (d0 + d1) / 2;
      B(a0, a1, d0, d1, h0, h0 + m(AWNING.bottom), mat.alu);
      B(a0, a1, d0, d1, h1 - m(AWNING.top), h1, mat.alu);
      B(a0, a0 + AWNING.side, d0, d1, h0 + m(AWNING.bottom), h1 - m(AWNING.top), mat.alu);
      B(a1 - AWNING.side, a1, d0, d1, h0 + m(AWNING.bottom), h1 - m(AWNING.top), mat.alu);
      pane(a0 + AWNING.side, a1 - AWNING.side, dc, h0 + m(AWNING.bottom), h1 - m(AWNING.top));
      const am = (a0 + a1) / 2;
      B(am - 6, am + 6, d1, d1 + 2, h0 + 0.012, h0 + 0.03, mat.blackSatin);
      break;
    }
    case 'fixed':
      // 一整片固定玻璃，壓條 2 cm
      fixedLite(a0, a1, h0, h1, 2.0);
      break;
  }

  /* 室外鋁製窗台泛水（往外凸出 3 cm） */
  B(s - 1, e + 1, -3 - SETBACK, 0.5, bot - 0.03, bot, mat.alu);

  /* 室內窗台 */
  if (spec.sill === 'stone') {
    // 人造石：凸出牆面 2 cm、兩側各長出 2.5 cm、邊角倒圓
    const [x1, y1, x2, y2] = rectAlong(f.hor, s - SILL_EAR, e + SILL_EAR, k(DEPTH), ci + σ * SILL_OUT);
    const geo = new RoundedBoxGeometry((x2 - x1) / 100, SILL_T, (y2 - y1) / 100, 2, 0.004);
    const me = new THREE.Mesh(geo, mat.stoneWarm);
    me.position.set(X((x1 + x2) / 2), bot + 0.005 - SILL_T / 2, Z((y1 + y2) / 2));
    worldUV(geo, me.position);
    me.castShadow = me.receiveShadow = true;
    b.root.add(me);
  } else if (spec.sill === 'flush') {
    b.box(rectAlong(f.hor, s, e, k(DEPTH), ci), bot - 0.015, bot + 0.005, mat.stone);
  } else {
    // 衛浴：窗洞內側（側面、上方、窗台）都貼石材，與牆面石材平齊
    const t = ci + σ * 1, o = { cast: false };
    b.box(rectAlong(f.hor, s, e, k(DEPTH), t), bot - 0.015, bot + 0.005, mat.tileLight, o);
    b.box(rectAlong(f.hor, s + PAD, s + PAD + 0.5, k(DEPTH), t), bot, top, mat.tileLight, o);
    b.box(rectAlong(f.hor, e - PAD - 0.5, e - PAD, k(DEPTH), t), bot, top, mat.tileLight, o);
    b.box(rectAlong(f.hor, s, e, k(DEPTH), t), top - 0.005, top, mat.tileLight, o);
  }

  /* 窗簾盒：做滿整面牆的面板＋兩端封板＋紗簾與布簾兩條軌道，跟天花板同一組（俯瞰時隱藏） */
  if (spec.curtainBox) {
    const { from, to } = spec.curtainBox, D = CURTAIN_BOX.depth, hb = CURTAIN_BOX.h0;
    const R = (a0: number, a1: number, c0: number, c1: number) => rectAlong(f.hor, a0, a1, ci + σ * c0, ci + σ * c1);
    for (const me of [
      b.box(R(from, to, D - 2, D), hb, H, mat.ceil),
      b.box(R(from, from + 2, 0, D), hb, H, mat.ceil),
      b.box(R(to - 2, to, 0, D), hb, H, mat.ceil),
      b.box(R(from + 2, to - 2, CURTAIN_BOX.sheerTrack - 1, CURTAIN_BOX.sheerTrack + 1), 2.76, 2.78, mat.alu),
      b.box(R(from + 2, to - 2, CURTAIN_BOX.mainTrack - 1, CURTAIN_BOX.mainTrack + 1), 2.76, 2.78, mat.alu),
    ]) ceiling.add(me);

    // 洗簾燈：盒內前緣的燈條往下照布簾（Panasonic：燈具離牆 200–230 mm）。夜間才開，用面光源讓褶子有光影
    const W = CURTAIN_BOX.washLight;
    const led = b.box(R(from + 3, to - 3, W - 1, W + 1), 2.775, 2.785, mat.glow, { cast: false });
    b.glow.push(led);
    ceiling.add(led);
    const len = (to - from - 6) / 100;
    const light = new THREE.RectAreaLight(0xffb978, 0, len, 0.03);
    const [cx, cy] = f.hor ? [(from + to) / 2, ci + σ * W] : [ci + σ * W, (from + to) / 2];
    light.position.set(X(cx), 2.77, Z(cy));
    light.rotation.set(-Math.PI / 2, f.hor ? 0 : Math.PI / 2, 0, 'YXZ');
    b.root.add(light);
    b.areaLights.push({ light, intensity: 300 });
  }
}

export function buildWindows(b: Build, ceiling: THREE.Group): void {
  for (const spec of windowSpecs) windowUnit(b, spec, ceiling);
}
