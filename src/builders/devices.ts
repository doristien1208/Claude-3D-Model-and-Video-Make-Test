import * as THREE from 'three';
import { X, Z } from '../core/units';
import { wallDevices, type WallDevice } from '../data/layout';
import { FACING_YAW, gbox, type Build } from './prims';

/*
 * 開關插座面板，參考 Panasonic RISNA（WTRF6891HS）：橫式 120 × 70 × 9 mm、圓角；
 * 開關鍵在 92 × 43 mm 的開口內等分；台灣接地插座為兩條平行插槽＋D 形接地孔（CNS 690）；
 * 防水蓋 126 × 80 × 48 mm（WNF8973B）；地板插座 120 × 120 mm 方蓋；對講機室內機約 180 × 120 × 20 mm。
 * 以下尺寸單位為公尺（面板本地座標：x 沿牆、y 向上、z 離牆）。
 */
const PLATE = { w: 0.12, h: 0.07, t: 0.009 };
const OPEN = { w: 0.092, h: 0.043 };

const box = (g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, r = 0) =>
  gbox(g, w, h, d, x, y, z, m, r, false);

/** 一個接地插座（兩條插槽＋接地孔），中心在 (cx, cy)，面在 z */
function outlet(g: THREE.Group, cx: number, cy: number, z: number, m: THREE.Material): void {
  box(g, 0.0022, 0.0075, 0.002, cx - 0.0063, cy + 0.003, z, m);
  box(g, 0.0022, 0.0075, 0.002, cx + 0.0063, cy + 0.003, z, m);
  box(g, 0.0048, 0.0042, 0.002, cx, cy - 0.0085, z, m);
}

function device(b: Build, d: WallDevice): void {
  const { mat } = b;
  const g = new THREE.Group();
  g.position.set(X(d.at[0]), d.h, Z(d.at[1]));
  g.rotation.y = FACING_YAW[d.facing];
  b.root.add(g);
  const plate = d.finish === 'white' ? mat.plateWhite : mat.plateDark, face = PLATE.t;

  if (d.kind === 'floorSocket') {
    // 地板插座：方形金屬蓋，幾乎與地板齊平
    g.rotation.set(0, 0, 0);
    g.position.y = 0;
    box(g, 0.12, 0.004, 0.12, 0, 0.002, 0, mat.plateDark, 0.0015);
    box(g, 0.05, 0.0012, 0.004, 0, 0.0042, 0.035, mat.gap);
    return;
  }
  if (d.kind === 'intercom') {
    // 對講機：白色外殼＋黑色螢幕＋按鍵列
    box(g, 0.18, 0.12, 0.02, 0, 0, 0.01, plate, 0.004);
    box(g, 0.105, 0.065, 0.002, -0.022, 0.012, 0.021, mat.tv);
    for (let i = 0; i < 4; i++) box(g, 0.014, 0.008, 0.003, 0.055, 0.035 - i * 0.022, 0.021, mat.gap, 0.001);
    return;
  }

  box(g, PLATE.w, PLATE.h, PLATE.t, 0, 0, PLATE.t / 2, plate, 0.003);
  if (d.kind === 'switch') {
    // 開關鍵：在開口內等分，中間留 1 mm 縫；鍵面略凸出面板
    const n = d.gangs ?? 1, gap = 0.001, kw = (OPEN.w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const x = -OPEN.w / 2 + kw / 2 + i * (kw + gap);
      box(g, kw, OPEN.h, 0.004, x, 0, face + 0.0015, plate, 0.0015);
      box(g, 0.006, 0.0012, 0.0005, x, -OPEN.h / 2 + 0.006, face + 0.0037, mat.gap); // 指示燈小窗
    }
    return;
  }
  // 插座：雙聯接地插座，插座面略凹
  box(g, OPEN.w, OPEN.h, 0.002, 0, 0, face - 0.0005, plate);
  outlet(g, -0.024, 0, face + 0.0006, mat.gap);
  outlet(g, 0.024, 0, face + 0.0006, mat.gap);
  if (d.kind === 'socketUsb') {
    // 中間兩個 USB-A 孔
    box(g, 0.0125, 0.0047, 0.002, 0, 0.007, face + 0.0006, mat.gap);
    box(g, 0.0125, 0.0047, 0.002, 0, -0.007, face + 0.0006, mat.gap);
  }
  if (d.kind === 'socketWet') {
    // 防水掀蓋（半透明）
    box(g, 0.126, 0.08, 0.048, 0, 0, face + 0.024, mat.coverClear, 0.004);
  }
}

export function buildDevices(b: Build): void {
  for (const d of wallDevices) device(b, d);
}
