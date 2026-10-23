import * as THREE from 'three';
import { X, Z } from '../core/units';
import { CURTAIN_BOX } from '../data/layout';
import type { ItemOf } from '../data/query';
import { rng, type Build } from './prims';
import { windowSpec, winFrame } from './windows';

/*
 * 雙層蛇形簾（布前紗後）。參考：
 *  - 滑車間距 60 mm → 一個波 120 mm；拉上時褶深 ±35（紗）／±40（布）mm（Ludvig Svensson、Silent Gliss）
 *  - 收起時前後最深約 160 mm（Silent Gliss 80/160）；收簾寬度約為該片軌道長的 0.20（紗）／0.30（布）（Kirsch 收簾表）
 *  - 波形是圓弧狀的瓣而不是正弦；下緣離地 10 mm，紗簾比布簾短 15 mm
 */
const PERIOD = 12;            // px
const SEG_PER_WAVE = 14;
const ROWS = 6;
const TOP = 2.755;            // 掛在軌道下緣（m）

export interface CurtainLayerSpec {
  track: number;              // 離牆距離（px）
  ampClosed: number;          // 拉上時半褶深（px）
  ampStacked: number;         // 收起時半褶深（px）
  stackK: number;             // 收簾寬度 ÷ 該片軌道長
  lobe: number;               // 波瓣的圓度（0 = 正弦，>0.5 = 超過半圓）
  drop: number;               // 比布簾短多少（m）
  ao: readonly [number, number]; // 褶子凹處變暗的程度：拉上時、收起時
}
const LAYERS: Record<'sheer' | 'main', CurtainLayerSpec> = {
  sheer: { track: CURTAIN_BOX.sheerTrack, ampClosed: 3.0, ampStacked: 6.5, stackK: 0.2, lobe: 0.42, drop: 0.015, ao: [0.2, 0.35] },
  main: { track: CURTAIN_BOX.mainTrack, ampClosed: 4.0, ampStacked: 7.5, stackK: 0.3, lobe: 0.45, drop: 0, ao: [0.35, 0.6] },
};

/** 一片蛇形簾：固定端在 anchor（牆側），往 dir 方向拉，全拉時到 reach */
class WavePanel {
  readonly mesh: THREE.Mesh;
  private readonly waves: number;
  private readonly cols: number;
  /** 每個波各自的深度倍率與上下擺動相位：布不會完全規則 */
  private readonly jitter: { amp: number; phase: number }[] = [];
  constructor(
    private readonly hor: boolean,
    private readonly across: number,      // 軌道的 across 座標（px）
    private readonly σ: 1 | -1,           // 往室內的方向
    private readonly anchor: number,
    private readonly dir: 1 | -1,
    private readonly reach: number,       // 全拉上時的長度（px）
    private readonly layer: CurtainLayerSpec,
    private readonly bottom: number,
    material: THREE.Material,
  ) {
    this.waves = Math.max(3, Math.round(reach / PERIOD) | 1); // 奇數個波，兩端都回到軌道線
    this.cols = this.waves * SEG_PER_WAVE;
    const r = rng(Math.round(anchor * 7 + across * 13));
    for (let i = 0; i <= this.waves; i++) this.jitter.push({ amp: 0.82 + 0.36 * r(), phase: r() * Math.PI * 2 });
    const geo = new THREE.BufferGeometry();
    const n = (this.cols + 1) * (ROWS + 1);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx: number[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < this.cols; c++) {
      const a = r * (this.cols + 1) + c, b2 = a + 1, d = a + this.cols + 1, e = d + 1;
      idx.push(a, d, b2, b2, d, e);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = material.transparent !== true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** t：0 = 收起、1 = 拉上 */
  set(t: number): void {
    const L = this.layer;
    const stack = L.stackK * this.reach;
    const len = stack + (this.reach - stack) * t;
    const p = len / this.waves, pc = this.reach / this.waves, ps = stack / this.waves;
    const squeeze = (pc - p) / (pc - ps); // 0 = 拉上、1 = 收起
    const amp = L.ampClosed + (L.ampStacked - L.ampClosed) * Math.max(0, Math.min(1, squeeze));
    const lobe = L.lobe + 0.15 * Math.max(0, Math.min(1, squeeze));
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const uv = this.mesh.geometry.attributes.uv as THREE.BufferAttribute;
    const col = this.mesh.geometry.attributes.color as THREE.BufferAttribute;
    // 褶子凹處的遮蔽：半球光從上方照，垂直布面受光都一樣，靠這個讓褶子讀得出來；收得越緊越暗
    const sq = Math.max(0, Math.min(1, squeeze)), aoStrength = L.ao[0] + (L.ao[1] - L.ao[0]) * sq;
    const h0 = this.bottom + L.drop, h1 = TOP;
    let arc = 0, prevA = 0, prevK = 0;
    for (let c = 0; c <= this.cols; c++) {
      const θ = (c / SEG_PER_WAVE) * Math.PI * 2;
      // 沿軌道的位置：在波峰處放慢，讓波瓣呈圓弧（θ + lobe·sin2θ）
      const along = this.anchor + this.dir * (p / (Math.PI * 2)) * (θ + lobe * Math.sin(2 * θ));
      // 相鄰兩個波的深度倍率平滑過渡
      const wi = c / SEG_PER_WAVE, w0 = Math.floor(wi), wt = wi - w0;
      const j0 = this.jitter[w0], j1 = this.jitter[Math.min(w0 + 1, this.waves)];
      const ampJ = amp * (j0.amp + (j1.amp - j0.amp) * wt), ph = j0.phase + (j1.phase - j0.phase) * wt;
      const off = ampJ * Math.sin(θ);
      const k = this.across + this.σ * off;
      if (c > 0) arc += Math.hypot(along - prevA, k - prevK) / 100;
      prevA = along; prevK = k;
      const [x, y] = this.hor ? [along, k] : [k, along];
      const facing = (1 + Math.sin(θ)) / 2; // 1 = 波峰朝室內、0 = 凹進去靠牆
      const ao = 1 - aoStrength * Math.pow(1 - facing, 1.5);
      for (let r = 0; r <= ROWS; r++) {
        const v = r / ROWS, i = r * (this.cols + 1) + c;
        col.setXYZ(i, ao, ao, ao);
        // 下襬略收（越往下褶深略小），並隨高度輕微擺動
        const sc = 0.9 + 0.1 * v + 0.05 * Math.sin(v * 4.2 + ph) * (1 - v);
        const sway = 0.35 * Math.sin(v * 3.1 + ph) * (1 - v) * this.dir;
        const xs = this.hor ? x + sway : this.across + (x - this.across) * sc;
        const ys = this.hor ? this.across + (y - this.across) * sc : y + sway;
        pos.setXYZ(i, X(xs), h0 + (h1 - h0) * v, Z(ys));
        uv.setXY(i, arc, h0 + (h1 - h0) * v);
      }
    }
    pos.needsUpdate = uv.needsUpdate = col.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
  }
}

export interface CurtainCtl {
  id: string;
  label: string;
  /** 0 = 收起、1 = 拉上 */
  sheer: number;
  main: number;
  set(layer: 'sheer' | 'main', t: number): void;
}

/** 雙層蛇形簾：依窗簾盒與窗戶位置建紗簾與布簾，收在 sides 指定的一側或兩側 */
export function curtains(b: Build, it: ItemOf<'curtains'>): void {
  const f = winFrame(it.window);
  const box = windowSpec(it.window)?.curtainBox;
  if (!box) throw new Error(`curtains：${it.window} 沒有窗簾盒`);
  const [from, to] = it.span ?? [box.from + 2, box.to - 2];
  const mid = (f.s + f.e) / 2;
  const bottom = it.bottom ?? 0.01;
  const panels: Record<'sheer' | 'main', WavePanel[]> = { sheer: [], main: [] };
  for (const name of ['sheer', 'main'] as const) {
    const L = LAYERS[name], across = f.ci + f.σ * L.track, m = name === 'sheer' ? b.mat.sheer : b.mat.drape;
    const add = (anchor: number, dir: 1 | -1, reach: number) => {
      const p = new WavePanel(f.hor, across, f.σ, anchor, dir, reach, L, bottom, m);
      p.mesh.userData.dynamic = true;
      b.root.add(p.mesh);
      panels[name].push(p);
    };
    if (it.sides === 'both') { add(from, 1, mid - from); add(to, -1, to - mid); }
    else if (it.sides === 'start') add(from, 1, to - from);
    else add(to, -1, to - from);
  }
  const ctl: CurtainCtl = {
    id: it.id, label: it.label, sheer: 0, main: 0,
    set(layer, t) {
      ctl[layer] = Math.max(0, Math.min(1, t));
      for (const p of panels[layer]) p.set(ctl[layer]);
    },
  };
  ctl.set('sheer', 0);
  ctl.set('main', 0);
  b.curtains.push(ctl);
}

/** 展示狀態（參考樣品屋攝影）：白天布簾收起、紗簾拉一半；夜晚紗簾全拉、布簾拉 ⅓ */
export const CURTAIN_PRESETS = {
  day: { sheer: 0.5, main: 0 },
  night: { sheer: 1, main: 0.33 },
} as const;
