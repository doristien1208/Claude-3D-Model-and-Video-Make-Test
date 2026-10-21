import * as THREE from 'three';
import { X, Z } from '../core/units';
import { site, type Viewpoint } from '../data/layout';
import type { Solid } from '../builders/prims';

export const WALK_FOV = 72;
const EYE = 1.6;
/** 碰撞半徑（m） */
const R = 0.2;

export interface WalkState {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** 漫遊：拖曳轉頭，WASD／方向鍵移動，Shift 加速 */
export class WalkController {
  readonly state: WalkState;
  enabled = false;
  private readonly keys: Record<string, boolean> = {};
  private drag: { id: number; x: number; y: number } | null = null;
  private readonly bounds: [number, number, number, number];
  private readonly camera: THREE.PerspectiveCamera;
  private readonly solids: readonly Solid[];

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement, solids: readonly Solid[], start: Viewpoint) {
    this.camera = camera;
    this.solids = solids;
    const [x1, y1, x2, y2] = site.floor;
    this.bounds = [X(x1), Z(y1), X(x2), Z(y2)];
    this.state = { x: X(start.at[0]), z: Z(start.at[1]), yaw: start.yaw, pitch: start.pitch ?? -0.08 };

    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      this.keys[e.key.toLowerCase()] = true;
    });
    addEventListener('keyup', (e) => (this.keys[e.key.toLowerCase()] = false));
    addEventListener('blur', () => {
      for (const k in this.keys) this.keys[k] = false;
    });

    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const k = 0.0045, s = this.state;
      s.yaw -= (e.clientX - d.x) * k;
      s.pitch = Math.max(-1.2, Math.min(1.2, s.pitch - (e.clientY - d.y) * k));
      d.x = e.clientX;
      d.y = e.clientY;
    });
    for (const t of ['pointerup', 'pointercancel'] as const)
      dom.addEventListener(t, (e) => {
        if (this.drag && this.drag.id === e.pointerId) this.drag = null;
      });
  }

  jumpTo(v: Viewpoint): void {
    const s = this.state;
    s.x = X(v.at[0]);
    s.z = Z(v.at[1]);
    s.yaw = v.yaw;
    s.pitch = v.pitch ?? -0.08;
  }

  /** 世界座標 (x, z) 是否被牆或家具擋住 */
  blocked(x: number, z: number): boolean {
    const [bx0, bz0, bx1, bz1] = this.bounds;
    if (x < bx0 + R || z < bz0 + R || x > bx1 - R || z > bz1 - R) return true;
    for (const s of this.solids) if (x > s[0] - R && x < s[2] + R && z > s[1] - R && z < s[3] + R) return true;
    return false;
  }

  update(dt: number): void {
    const k = this.keys, s = this.state;
    let f = 0, side = 0;
    if (k['w'] || k['arrowup']) f += 1;
    if (k['s'] || k['arrowdown']) f -= 1;
    if (k['a']) side -= 1;
    if (k['d']) side += 1;
    if (k['arrowleft']) s.yaw += 1.8 * dt;
    if (k['arrowright']) s.yaw -= 1.8 * dt;
    const sp = (k['shift'] ? 3.4 : 1.9) * dt, l = Math.hypot(f, side);
    if (l > 1) { f /= l; side /= l; }
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
    const dx = (fx * f + rx * side) * sp, dz = (fz * f + rz * side) * sp;
    if (!this.blocked(s.x + dx, s.z)) s.x += dx;
    if (!this.blocked(s.x, s.z + dz)) s.z += dz;
    this.camera.position.set(s.x, EYE, s.z);
    this.camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
  }
}
