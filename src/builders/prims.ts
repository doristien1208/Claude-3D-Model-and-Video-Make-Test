import * as THREE from 'three';
import { X, Z } from '../core/units';
import type { Rect } from '../data/layout';
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
    if ((m as THREE.MeshStandardMaterial).map) worldUV(g, me.position);
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
    if ((m as THREE.MeshStandardMaterial).map) worldUV(me.geometry, me.position, r);
    me.castShadow = opt.cast !== false;
    me.receiveShadow = true;
    this.root.add(me);
    if (opt.solid) this.solids.push([X(cx) - r, Z(cy) - r, X(cx) + r, Z(cy) + r]);
    return me;
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
