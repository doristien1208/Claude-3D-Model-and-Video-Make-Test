import * as THREE from 'three';
import { X, Z } from '../core/units';
import { lighting } from '../data/layout';
import type { Mat } from '../materials/library';

/** 日／夜預設（數值沿用參考版 r147 + physicallyCorrectLights，現行版 three.js 單位相同） */
export const PRESETS = {
  day: {
    hemi: { sky: 0xdfe6ea, ground: 0x6e6052, intensity: 1.15 },
    sun: true, nightLights: false,
    glow: 0.25, glowSoft: 0.08,
    background: 0xc9d2d6, outside: 0xa29d93, exposure: 1.0,
  },
  night: {
    hemi: { sky: 0x8090a8, ground: 0x2a2420, intensity: 0.12 },
    sun: false, nightLights: true,
    glow: 3, glowSoft: 1.2,
    background: 0x12151a, outside: 0x1a1b1d, exposure: 1.25,
  },
} as const;

export class Lighting {
  readonly hemi = new THREE.HemisphereLight(0xdfe6ea, 0x6e6052, 1);
  readonly sun = new THREE.DirectionalLight(0xfff1df, 3.2);
  readonly night: { light: THREE.PointLight; intensity: number }[] = [];
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly mat: Mat;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, mat: Mat) {
    this.scene = scene;
    this.renderer = renderer;
    this.mat = mat;
    scene.add(this.hemi);

    // 白天：從西南方照入
    const sun = this.sun;
    sun.position.set(4.875 - 9, 9, 5.8 + 4);
    sun.target.position.set(4.875, 0, 5.8);
    scene.add(sun, sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;

    // 夜晚：2700K 暖光點光源（沒有陰影，會穿牆）
    for (const n of lighting.night) {
      const l = new THREE.PointLight(0xffb978, n.intensity, n.distance, 2);
      l.position.set(X(n.at[0]), n.h, Z(n.at[1]));
      scene.add(l);
      this.night.push({ light: l, intensity: n.intensity });
    }
  }

  apply(isNight: boolean): void {
    const p = isNight ? PRESETS.night : PRESETS.day;
    this.hemi.intensity = p.hemi.intensity;
    this.hemi.color.set(p.hemi.sky);
    this.hemi.groundColor.set(p.hemi.ground);
    this.sun.visible = p.sun;
    for (const { light, intensity } of this.night) light.intensity = p.nightLights ? intensity : 0;
    this.mat.glow.emissiveIntensity = p.glow;
    this.mat.glowSoft.emissiveIntensity = p.glowSoft;
    this.scene.background = new THREE.Color(p.background);
    this.mat.outside.color.set(p.outside);
    this.renderer.toneMappingExposure = p.exposure;
  }
}
