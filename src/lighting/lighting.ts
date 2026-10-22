import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { X, Z } from '../core/units';
import { CEILING_H, DOWNLIGHT, DOWNLIGHT_RECESS, items, lighting, probeZones, type DownlightKind, type Rect } from '../data/layout';
import type { Mat } from '../materials/library';

/** 2700K 暖光（相機白平衡偏暖時的顏色） */
const WARM = 0xffb978;
const DEG = Math.PI / 180;

/**
 * 夜間曝光依相機 EV（ISO 100）：場景平均亮度 L = 2^(EV−3) cd/m² 落在 18% 灰；
 * three.js ACES（out = RRT(L·E / 0.6)）解出 E ≈ 1.26 · 2^−EV。
 */
const exposureForEV = (ev: number) => 1.26 * 2 ** -ev;

type Dim = Record<DownlightKind | 'lamp' | 'strip', number>;

/** 日／夜預設。白天沿用參考版數值；夜間改用真實光度（燈 cd、燈條 nits、發光面 cd/m²） */
export const PRESETS = {
  day: {
    hemi: { sky: 0xdfe6ea, ground: 0x6e6052, intensity: 1.15 },
    sun: true,
    glow: 0.25, glowSoft: 0.08,
    dim: { general: 0, accent: 0, wet: 0, lamp: 0, strip: 0 } as Dim,
    background: 0xc9d2d6, outside: 0xa29d93, exposure: 1.0,
  },
  night: {
    hemi: { sky: 0x8090a8, ground: 0x2a2420, intensity: 0.12 },
    sun: false,
    // 燈具出光面、燈條（數千 cd/m²，曝光後接近白）；燈罩、壁燈面板約數百 cd/m²
    glow: 4000, glowSoft: 300,
    // 樣品屋夜景：一般崁燈調到 35%，重點燈、燈具、燈條全開
    dim: { general: 0.35, accent: 1, wet: 0.35, lamp: 1, strip: 1 } as Dim,
    background: 0x12151a, outside: 0x1a1b1d, exposure: exposureForEV(5),
  },
} as const;

/** 一盞燈：cd 為 100% 時的光強，kind 決定調光比例 */
interface Fixture {
  light: THREE.PointLight | THREE.SpotLight;
  cd: number;
  kind: keyof Dim;
}

/** 聚光燈的光強分布：penumbra = 1 時 smoothstep 中點落在光束角一半（半強度），總光通量 ≈ π·I·(1 − cos angle) */
const coneAngle = (beamDeg: number) => Math.acos(2 * Math.cos((beamDeg / 2) * DEG) - 1);

export class Lighting {
  readonly hemi = new THREE.HemisphereLight(0xdfe6ea, 0x6e6052, 1);
  readonly sun = new THREE.DirectionalLight(0xfff1df, 3.2);
  /** 所有夜間燈具（崁燈、吊燈、落地燈、壁燈、檯燈），放在同一群組，順序固定 */
  readonly fixtures: Fixture[] = [];
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly mat: Mat;
  private readonly areaLights: readonly { light: THREE.RectAreaLight; intensity: number }[];

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, mat: Mat, areaLights: readonly { light: THREE.RectAreaLight; intensity: number }[] = []) {
    RectAreaLightUniformsLib.init();
    this.areaLights = areaLights;
    this.scene = scene;
    this.renderer = renderer;
    this.mat = mat;
    scene.add(this.hemi);

    // 白天：從西南方照入
    const sun = this.sun;
    sun.position.set(5.125 - 9, 9, 5.8 + 4);
    sun.target.position.set(5.125, 0, 5.8);
    scene.add(sun, sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;

    // 夜晚：沒有陰影；穿牆問題由 render/lightMask.ts 依房間遮掉
    const group = new THREE.Group();
    group.name = 'night-lights';
    scene.add(group);
    const spot = (x: number, y: number, z: number, tx: number, ty: number, tz: number, angle: number, cd: number, kind: keyof Dim) => {
      const l = new THREE.SpotLight(WARM, 0, 0, angle, 1, 2);
      l.position.set(x, y, z);
      l.target.position.set(tx, ty, tz);
      group.add(l, l.target);
      this.fixtures.push({ light: l, cd, kind });
    };
    const point = (x: number, y: number, z: number, lm: number) => {
      const l = new THREE.PointLight(WARM, 0, 0, 2);
      l.position.set(x, y, z);
      group.add(l);
      this.fixtures.push({ light: l, cd: lm / (4 * Math.PI), kind: 'lamp' });
    };

    // 崁燈：光源在深杯裡，正下方光強 = 流明 × cd/lm；重點燈打向 aim
    for (const d of lighting.downlights) {
      const s = DOWNLIGHT[d.kind], x = X(d.at[0]), z = Z(d.at[1]);
      const [tx, ty, tz] = d.aim ? [X(d.aim[0]), d.aim[2], Z(d.aim[1])] : [x, 0, z];
      spot(x, CEILING_H + DOWNLIGHT_RECESS - 0.005, z, tx, ty, tz, coneAngle(s.beam), s.lm * s.cdPerLm, d.kind);
    }

    // 燈具（流明見 layout.ts lighting.lamps）
    const L = lighting.lamps;
    for (const it of items) {
      switch (it.type) {
        case 'pendant': {
          // 金屬燈罩往下開口：燈泡在罩口上方，約 150° 往下照
          const a = 75 * DEG;
          spot(X(it.at[0]), 1.86, Z(it.at[1]), X(it.at[0]), 0, Z(it.at[1]), a, L.pendant / (Math.PI * (1 - Math.cos(a))), 'lamp');
          break;
        }
        case 'floorLamp':
          point(X(it.at[0]), 1.54, Z(it.at[1]), L.floorLamp);
          break;
        case 'wallLamp': {
          // 床頭壁燈：面板前 8 cm，朝房間中央那一側
          const c = rectCenter(it.rect), out = towardRoom(it.rect);
          point(X(c[0] + out[0] * 8), (it.h[0] + it.h[1]) / 2, Z(c[1] + out[1] * 8), L.wallLamp);
          break;
        }
        case 'deskLamp': {
          // 檯燈燈頭在底座前方 11 cm、高 1.12 m，往下照桌面
          const a = 55 * DEG, x = X(it.at[0]), z = Z(it.at[1] + 11);
          spot(x, 1.12, z, x, 0, z, a, L.deskLamp / (Math.PI * (1 - Math.cos(a))), 'lamp');
          break;
        }
        case 'sconce':
          // 走廊壁燈裝在西側牆面、朝東，上下洗牆
          point(X(it.at[0] + 5), (it.h[0] + it.h[1]) / 2, Z(it.at[1]), L.sconce);
          break;
      }
    }
  }

  apply(isNight: boolean): void {
    const p = isNight ? PRESETS.night : PRESETS.day;
    this.hemi.intensity = p.hemi.intensity;
    this.hemi.color.set(p.hemi.sky);
    this.hemi.groundColor.set(p.hemi.ground);
    this.sun.visible = p.sun;
    for (const f of this.fixtures) f.light.intensity = f.cd * p.dim[f.kind];
    for (const { light, intensity } of this.areaLights) light.intensity = intensity * p.dim.strip;
    this.mat.glow.emissiveIntensity = p.glow;
    this.mat.glowSoft.emissiveIntensity = p.glowSoft;
    this.scene.background = new THREE.Color(p.background);
    this.mat.outside.color.set(p.outside);
    this.renderer.toneMappingExposure = p.exposure;
  }
}

const rectCenter = (r: Rect): [number, number] => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];

/** 貼牆小物件朝房間中央的方向（沿它的薄邊）：回傳單位向量（px） */
function towardRoom(r: Rect): [number, number] {
  const [cx, cy] = rectCenter(r);
  const zone = probeZones.find((z) => cx >= z.rect[0] && cx <= z.rect[2] && cy >= z.rect[1] && cy <= z.rect[3]);
  const [zx, zy] = zone ? rectCenter(zone.rect) : [cx, cy];
  return r[2] - r[0] < r[3] - r[1] ? [Math.sign(zx - cx) || 1, 0] : [0, Math.sign(zy - cy) || 1];
}
