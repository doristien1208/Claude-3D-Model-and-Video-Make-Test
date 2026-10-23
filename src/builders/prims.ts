import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { X, Z } from '../core/units';
import type { Rect, Side } from '../data/layout';
import type { Materials } from '../materials/library';
import type { CurtainCtl } from './curtains';

/** 行走碰撞方塊（世界公尺）[minX, minZ, maxX, maxZ] */
export type Solid = [number, number, number, number];

/** 小地圖用的平面線段（px） */
export type PlanSeg =
  | { hor: boolean; c: number; a: number; b: number; t: number; kind: 'wall' | 'win' }
  | { block: Rect };

export interface BoxOpt {
  /** 是否投射陰影（預設 true） */
  cast?: boolean;
  /** 是否加入行走碰撞 */
  solid?: boolean;
}
export interface CylOpt extends BoxOpt {
  rTop?: number;
  seg?: number;
}

/**
 * 世界座標 UV：依面法線從世界座標投影（頂面 (x, −z)，側面 (z, y) 或 (x, y)，
 * 圓柱側面 (角度 × r, y)）。1 UV = 1 m，貼圖尺度與花紋可跨物件對齊。
 * aoMap 在新版 three.js 預設讀取同一組 uv（channel 0），不必再複製 uv2。
 */
export function worldUV(g: THREE.BufferGeometry, o: THREE.Vector3, r?: number): void {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + o.x, y = p.getY(i) + o.y, z = p.getZ(i) + o.z;
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    if (ny > 0.5) uv.setXY(i, x, -z);
    else if (r) uv.setXY(i, Math.atan2(p.getZ(i), p.getX(i)) * r, y);
    else if (nx > 0.5) uv.setXY(i, z, y);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
}

/** 有貼圖（顏色、法線或 bump）的材質才需要世界座標 UV */
export const needsUV = (m: THREE.Material): boolean => {
  const s = m as THREE.MeshStandardMaterial;
  return !!(s.map || s.normalMap || s.bumpMap);
};

/** 牆面設備朝向 → 本地 z 軸（離牆方向）在世界座標的旋轉角 */
export const FACING_YAW: Record<Side, number> = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

/** 在群組本地座標（公尺）放一個方塊；r > 0 為圓角 */
export function gbox(g: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, r = 0, cast = true): THREE.Mesh {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = cast;
  me.receiveShadow = true;
  g.add(me);
  return me;
}

/** 加一個 mesh（本地座標，公尺） */
export function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, cast = true): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = cast;
  me.receiveShadow = true;
  parent.add(me);
  return me;
}

/** 沿 z 軸（離牆方向）的圓柱 */
export const zcyl = (r: number, len: number, seg = 24, open = false) => new THREE.CylinderGeometry(r, r, len, seg, 1, open).rotateX(Math.PI / 2);
/** 沿 x 軸的圓柱 */
export const xcyl = (r: number, len: number, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
/** 旋轉體：profile 為 [半徑, 高] */
export const lathe = (profile: readonly [number, number][], seg = 32) =>
  new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/** 建構期間共用的狀態與幾何工具（輸入為 SVG px，高度為公尺） */
export class Build {
  readonly root = new THREE.Group();
  readonly solids: Solid[] = [];
  readonly planSegs: PlanSeg[] = [];
  /** 發光件（之後做選擇性 bloom 用） */
  readonly glow: THREE.Mesh[] = [];
  /** 可開合的窗簾（見 curtains.ts） */
  readonly curtains: CurtainCtl[] = [];
  /** 即時平面反射的鏡面（拍環境探針時要先藏起來） */
  readonly reflectors: THREE.Object3D[] = [];
  /** 夜間才開的面光源（洗簾燈等）與夜間強度 */
  readonly areaLights: { light: THREE.RectAreaLight; intensity: number }[] = [];
  /** 霧面玻璃與窗戶朝外的方向（世界座標），亮度依窗外 HDRI 設定 */
  readonly frosted: { mesh: THREE.Mesh; out: THREE.Vector3 }[] = [];
  readonly mat: Materials['mat'];
  readonly books: Materials['books'];

  constructor(materials: Materials) {
    this.mat = materials.mat;
    this.books = materials.books;
    this.root.name = 'house';
  }

  bx(x1: number, y1: number, x2: number, y2: number, h0: number, h1: number, m: THREE.Material, opt: BoxOpt = {}): THREE.Mesh {
    const a = Math.min(x1, x2), b = Math.max(x1, x2), c = Math.min(y1, y2), d = Math.max(y1, y2);
    const g = new THREE.BoxGeometry((b - a) / 100, h1 - h0, (d - c) / 100);
    const me = new THREE.Mesh(g, m);
    me.position.set(X((a + b) / 2), (h0 + h1) / 2, Z((c + d) / 2));
    if (needsUV(m)) worldUV(g, me.position);
    me.castShadow = opt.cast !== false;
    me.receiveShadow = true;
    this.root.add(me);
    if (opt.solid) this.solids.push([X(a), Z(c), X(b), Z(d)]);
    return me;
  }

  box(r: Rect, h0: number, h1: number, m: THREE.Material, opt?: BoxOpt): THREE.Mesh {
    return this.bx(r[0], r[1], r[2], r[3], h0, h1, m, opt);
  }

  cyl(cx: number, cy: number, r: number, h0: number, h1: number, m: THREE.Material, opt: CylOpt = {}): THREE.Mesh {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(opt.rTop ?? r, r, h1 - h0, opt.seg || 28), m);
    me.position.set(X(cx), (h0 + h1) / 2, Z(cy));
    if (needsUV(m)) worldUV(me.geometry, me.position, r);
    me.castShadow = opt.cast !== false;
    me.receiveShadow = true;
    this.root.add(me);
    if (opt.solid) this.solids.push([X(cx) - r, Z(cy) - r, X(cx) + r, Z(cy) + r]);
    return me;
  }

  /**
   * 燈條面光源（RectAreaLight，2700K）：中心 (x, y) px、高 h（m），長 len、寬 w（m），沿 x（alongX）或沿 y，往上或往下發光。
   * lmPerM 為每公尺流明；朗伯面光源 Φ = π·L·A，亮度 L = lmPerM ÷ (π·w)（nits）。夜間才開（見 lighting.ts）。
   */
  stripLight(x: number, y: number, h: number, len: number, w: number, alongX: boolean, facing: 'up' | 'down', lmPerM: number): THREE.RectAreaLight {
    const light = new THREE.RectAreaLight(0xffb978, 0, len, w);
    light.position.set(X(x), h, Z(y));
    light.rotation.set(facing === 'down' ? -Math.PI / 2 : Math.PI / 2, alongX ? 0 : Math.PI / 2, 0, 'YXZ');
    this.root.add(light);
    this.areaLights.push({ light, intensity: lmPerM / (Math.PI * w) });
    return light;
  }

  glowBox(x1: number, y1: number, x2: number, y2: number, h0: number, h1: number, m?: THREE.Material): THREE.Mesh {
    const g = this.bx(x1, y1, x2, y2, h0, h1, m || this.mat.glow, { cast: false });
    this.glow.push(g);
    return g;
  }

  /** 只加碰撞、不產生幾何（px） */
  solid(r: Rect): void {
    this.solids.push([X(Math.min(r[0], r[2])), Z(Math.min(r[1], r[3])), X(Math.max(r[0], r[2])), Z(Math.max(r[1], r[3]))]);
  }

  /** 朝下的圓形發光面（崁燈、吊燈燈口） */
  disc(px: number, py: number, h: number, r: number, seg: number, m: THREE.Material): THREE.Mesh {
    const d = new THREE.Mesh(new THREE.CircleGeometry(r, seg), m);
    d.rotation.x = Math.PI / 2;
    d.position.set(X(px), h, Z(py));
    this.root.add(d);
    return d;
  }
}

/** 以「沿牆 along、垂直牆 across」描述的範圍轉成平面外框（px）；hor 為牆沿 x 方向 */
export function rectAlong(hor: boolean, a0: number, a1: number, k0: number, k1: number): Rect {
  const [amin, amax] = [Math.min(a0, a1), Math.max(a0, a1)], [kmin, kmax] = [Math.min(k0, k1), Math.max(k0, k1)];
  return hor ? [amin, kmin, amax, kmax] : [kmin, amin, kmax, amax];
}

/** mulberry32：書櫃書本排列用的可重現亂數 */
export function rng(seed: number): () => number {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
