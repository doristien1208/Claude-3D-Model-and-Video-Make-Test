import * as THREE from 'three';
import { X, Z } from '../core/units';
import { CURTAIN_BOX } from '../data/layout';
import type { ItemOf } from '../data/query';
import { rng, type Build } from './prims';
import { windowSpec, winFrame } from './windows';

/*
 * 蛇形布簾（2026-10-25 依使用者決定拿掉紗簾，只留布簾）。參考：
 *  - 滑車間距 60 mm（一個波 120 mm），倍數 2.3（Silent Gliss 60/120；台灣蛇形簾 2.3–2.5 倍）
 *  - 斷面是圓弧的環而不是正弦：每段布長 s = 倍數 × 滑車間距、跨過弦長 c，φ / sin φ = s / c，R = c / (2 sin φ)，
 *    略超過半圓（Ω 形）；拉上時前後總深約 10 cm
 *  - 收起時滑車擠在一起，環變成窄而深的 U 形（不會捲成圓管）、往一側斜靠約 20°；收簾寬約為該片軌道長的 0.24
 *  - 上緣 7.5 cm 由蛇形帶固定，往下約 40 cm 後每個褶子各自飄移（約 ±0.2 個滑車間距）、深淺不一、略扭轉（±4°）；
 *    收起時下襬略外張（約 1.15 倍、外緣是斜直線），拉上時下面 45 cm 約外張 2%
 *  - 下襬雙折 10 cm、離地 10 mm（日本窗簾尺寸慣例：布簾 1–2 cm）
 */
const PITCH = 6;              // 滑車間距（px）
const SEG = 12;               // 每段環的格數
const TOP = 2.755;            // 掛在軌道下緣（m）
const HEADING = 0.075;        // 上緣蛇形帶（m）
const HEM = 0.1;              // 下襬雙折（m）
const DEG = Math.PI / 180;

export interface CurtainSpec {
  track: number;              // 離牆距離（px）
  fullness: number;           // 倍數（布長 ÷ 軌道長）
  rhoMin: number;             // 收起時 U 形折彎的最小半徑（px）
  stackK: number;             // 收簾寬度 ÷ 該片軌道長
  ao: readonly [number, number]; // 褶子凹處變暗的程度：拉上時、收起時
  /** 往下時滑車處的橫向飄移（滑車間距的倍數）、收起時下襬外張（倍率） */
  drift: number;
  flare: number;
}
const DRAPE: CurtainSpec = { track: CURTAIN_BOX.track, fullness: 2.3, rhoMin: 1.2, stackK: 0.24, ao: [0.35, 0.6], drift: 0.17, flare: 0.15 };

/** 由下往上的列高（m）：下襬、上緣蛇形帶附近加密 */
function rowHeights(H: number): number[] {
  const ys = [0, 0.004, 0.012, 0.025, 0.045, 0.07, HEM - 0.002, HEM];
  for (let y = HEM + 0.06; y < H - 0.4; y += 0.08) ys.push(y);
  for (let y = H - 0.4; y < H - HEADING - 0.01; y += 0.04) ys.push(y);
  ys.push(H - HEADING - 0.002, H - HEADING, H - 0.05, H - 0.025, H);
  return ys;
}

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/**
 * 一段環：布長 s 跨過弦長 c（滑車在 (0, 0)、(c, 0)），往 +off 鼓出；回傳依布長等分的 n + 1 點 [沿軌道, 離軌道]。
 * 布不會捲成快要閉合的圓：圓弧解超過 PHI_MAX（約 120°，拉上時的 Ω 形）之後，改成兩段直線接一段半徑
 * max(rho, c / (2 sin PHI_MAX)) 的圓弧（窄而深的 U 形），在 PHI_MAX 處兩種形狀剛好接上。
 */
const PHI_MAX = 2.1;
function loop(c: number, s: number, rho: number, n: number): [number, number][] {
  // 圓弧解：φ / sin φ = s / c
  let lo = 1e-4, hi = Math.PI - 1e-4;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (m / Math.sin(m) < s / c) lo = m;
    else hi = m;
  }
  const phi = (lo + hi) / 2, R = c / (2 * Math.sin(phi));
  let rr = phi <= PHI_MAX ? R : Math.min(R, Math.max(rho, c / (2 * Math.sin(PHI_MAX)))), hc: number, T: number, span: number;
  if (rr >= R - 1e-6) {
    rr = R;
    hc = -R * Math.cos(phi);
    T = 0;
    span = 2 * phi;
  } else {
    // 圓心高 hc：兩條切線 + 繞過頂端的圓弧總長 = s
    const len = (h: number) => {
      const d = Math.hypot(c / 2, h), t = Math.sqrt(Math.max(0, d * d - rr * rr));
      const sp = 2 * Math.PI - 2 * Math.atan2(c / 2, h) - 2 * Math.acos(Math.min(1, rr / d));
      return { t, sp, L: 2 * t + rr * sp };
    };
    let a = Math.sqrt(Math.max(0, rr * rr - (c * c) / 4)), b = s;
    for (let i = 0; i < 50; i++) {
      const m = (a + b) / 2;
      if (len(m).L < s) a = m;
      else b = m;
    }
    hc = (a + b) / 2;
    const r = len(hc);
    T = r.t;
    span = r.sp;
  }
  const a1 = Math.PI / 2 + span / 2, ta: [number, number] = [c / 2 + rr * Math.cos(a1), hc + rr * Math.sin(a1)];
  const L = 2 * T + rr * span, pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const l = (i / n) * L;
    if (T > 0 && l <= T) pts.push([ta[0] * (l / T), ta[1] * (l / T)]);
    else if (T > 0 && l >= T + rr * span) {
      const k = (L - l) / T;
      pts.push([c - ta[0] * k, ta[1] * k]);
    } else {
      const a = a1 - (l - T) / rr;
      pts.push([c / 2 + rr * Math.cos(a), hc + rr * Math.sin(a)]);
    }
  }
  return pts;
}

/** 一片蛇形簾：固定端在 anchor（牆側），往 dir 方向拉，全拉時到 reach */
class WavePanel {
  readonly mesh: THREE.Mesh;
  private readonly loops: number;
  private readonly cols: number;
  private readonly ys: number[];
  /** 每個滑車處往下飄移的大小、相位與頻率，每段環的扭轉相位：布不會完全規則 */
  private readonly carriers: { amp: number; ph: number; k: number }[] = [];
  private readonly twist: { ph: number; k: number }[] = [];
  constructor(
    private readonly hor: boolean,
    private readonly across: number,      // 軌道的 across 座標（px）
    private readonly σ: 1 | -1,           // 往室內的方向
    private readonly anchor: number,
    private readonly dir: 1 | -1,
    private readonly reach: number,       // 全拉上時的長度（px）
    private readonly layer: CurtainSpec,
    private readonly bottom: number,
    material: THREE.Material,
  ) {
    // 奇數個波（偶數段環），兩端都回到軌道線
    this.loops = 2 * Math.max(3, Math.round(reach / (2 * PITCH)) | 1);
    this.cols = this.loops * SEG;
    this.ys = rowHeights(TOP - bottom);
    const r = rng(Math.round(anchor * 7 + across * 13));
    for (let i = 0; i <= this.loops; i++) this.carriers.push({ amp: 0.5 + r(), ph: r() * Math.PI * 2, k: 1.5 + 2 * r() });
    for (let i = 0; i < this.loops; i++) this.twist.push({ ph: r() * Math.PI * 2, k: 1 + 2 * r() });
    const rows = this.ys.length - 1;
    const geo = new THREE.BufferGeometry();
    const n = (this.cols + 1) * (rows + 1);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx: number[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < this.cols; c++) {
      const a = r * (this.cols + 1) + c, b2 = a + 1, d = a + this.cols + 1, e = d + 1;
      idx.push(a, d, b2, b2, d, e);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** t：0 = 收起、1 = 拉上 */
  set(t: number): void {
    const L = this.layer, ys = this.ys, H = ys[ys.length - 1], N = this.loops;
    const c0 = this.reach / N, s = L.fullness * c0;
    const c = (this.reach * (L.stackK + (1 - L.stackK) * t)) / N;
    const sq = smooth((c0 - c) / (c0 - L.stackK * c0)); // 0 = 拉上、1 = 收起
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const uv = this.mesh.geometry.attributes.uv as THREE.BufferAttribute;
    const col = this.mesh.geometry.attributes.color as THREE.BufferAttribute;
    // 褶子凹處的遮蔽：半球光從上方照，垂直布面受光都一樣，靠這個讓褶子讀得出來；收得越緊越暗
    const aoStrength = L.ao[0] + (L.ao[1] - L.ao[0]) * sq;
    const h0 = this.bottom;
    const xs = new Float64Array(N + 1);
    ys.forEach((y, r) => {
      const down = H - y, d = down / H;
      // 上緣由滑車固定；往下約 40 cm 後各自飄移，越往下越明顯
      const free = smooth((down - HEADING) / 0.4);
      // 下襬外張：收起時從上緣下 50 cm 起直線往下張開（下襬約 1.15 倍寬，靠牆那端不動），拉上時下面 45 cm 約 2%。
      // 用直線而不是二次曲線，整疊的外緣才是一條斜直線，不會看起來像整疊彎掉
      const flare = 1 + L.flare * sq * Math.max(0, down - 0.5) / (H - 0.5) + 0.02 * (1 - sq) * smooth((0.45 - y) / 0.45);
      for (let j = 0; j <= N; j++) {
        const cj = this.carriers[j];
        xs[j] = j * c * flare + (j > 0 ? L.drift * c * free * d * cj.amp * Math.sin(y * cj.k + cj.ph) : 0);
      }
      // 收起時環往同一側斜靠（約 20°），越往下折彎越圓
      const lean = Math.tan(20 * sq * DEG);
      const rho = L.rhoMin * (1 + 0.3 * d);
      // 上緣滑車之間被拉出的細小張力紋（約 2 mm），往下 12 cm 內消失
      const tension = 0.2 * Math.exp(-Math.max(0, down - HEADING) / 0.12) * (1 - sq * 0.5);
      for (let k = 0; k < N; k++) {
        const side = k % 2 === 0 ? 1 : -1, tw = this.twist[k], ck = Math.max(xs[k + 1] - xs[k], 0.05);
        const pts = loop(ck, s, rho, SEG);
        // 環的軸略為扭轉（±4°），以弦中點為軸
        const rot = 4 * DEG * free * Math.sin(y * tw.k + tw.ph), cr = Math.cos(rot), sr = Math.sin(rot);
        for (let i = k === 0 ? 0 : 1; i <= SEG; i++) {
          const [pa, po] = pts[i], f = i / SEG, ox = pa - ck / 2, oy = side * po;
          let along = xs[k] + ck / 2 + ox * cr - oy * sr, off = ox * sr + oy * cr;
          along += off * lean;
          off += tension * Math.sin(3 * Math.PI * f) * side;
          const kk = this.across + this.σ * off, a = this.anchor + this.dir * along;
          const [x, z] = this.hor ? [a, kk] : [kk, a];
          const facing = side > 0 ? (1 + Math.sin(Math.PI * f)) / 2 : (1 - Math.sin(Math.PI * f)) / 2; // 1 = 環的頂端朝室內
          const ao = 1 - aoStrength * Math.pow(1 - facing, 1.5);
          const vi = r * (this.cols + 1) + k * SEG + i;
          col.setXYZ(vi, ao, ao, ao);
          pos.setXYZ(vi, X(x), h0 + y, Z(z));
          // 布寬（uv）：布不會伸長，每一列都是同樣的布長
          uv.setXY(vi, ((k + f) * s) / 100, h0 + y);
        }
      }
    });
    pos.needsUpdate = uv.needsUpdate = col.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
  }
}

export interface CurtainCtl {
  id: string;
  label: string;
  /** 0 = 收起、1 = 拉上 */
  t: number;
  set(t: number): void;
}

/** 蛇形布簾：依窗簾盒與窗戶位置建布簾，收在 sides 指定的一側或兩側 */
export function curtains(b: Build, it: ItemOf<'curtains'>): void {
  const f = winFrame(it.window);
  const box = windowSpec(it.window)?.curtainBox;
  if (!box) throw new Error(`curtains：${it.window} 沒有窗簾盒`);
  const [from, to] = it.span ?? [box.from + 2, box.to - 2];
  const mid = (f.s + f.e) / 2;
  const bottom = it.bottom ?? 0.01;
  const panels: WavePanel[] = [], across = f.ci + f.σ * DRAPE.track;
  const add = (anchor: number, dir: 1 | -1, reach: number) => {
    const p = new WavePanel(f.hor, across, f.σ, anchor, dir, reach, DRAPE, bottom, b.mat.drape);
    p.mesh.userData.dynamic = true;
    b.root.add(p.mesh);
    panels.push(p);
  };
  if (it.sides === 'both') { add(from, 1, mid - from); add(to, -1, to - mid); }
  else if (it.sides === 'start') add(from, 1, to - from);
  else add(to, -1, to - from);
  const ctl: CurtainCtl = {
    id: it.id, label: it.label, t: 0,
    set(t) {
      ctl.t = Math.max(0, Math.min(1, t));
      for (const p of panels) p.set(ctl.t);
    },
  };
  ctl.set(0);
  b.curtains.push(ctl);
}

/** 展示狀態（參考樣品屋攝影）：白天收起；夜晚拉 ⅓（窗外夜景仍看得到） */
export const CURTAIN_PRESETS = { day: 0, night: 0.33 } as const;
