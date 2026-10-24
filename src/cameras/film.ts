import * as THREE from 'three';
import { X, Z } from '../core/units';
import { END_CARD, SHOTS, type CamPose, type Shot } from '../data/shots';

/** 全片幅 36 mm 寬、裁成 16:9（高 20.25 mm）時的垂直視角（度） */
export const fovFor = (focal: number): number => (2 * Math.atan((36 * 9) / 16 / 2 / focal) * 180) / Math.PI;

/**
 * 鏡頭內的進度：預設等速（剪接點前後速度一致，鏡頭內不忽快忽慢）；
 * in = 開頭 r 內加速到等速（片頭），out = 結尾 r 內減速停住（片尾）
 */
export function ease(t: number, mode?: 'in' | 'out', r = 0.35): number {
  t = Math.max(0, Math.min(1, t));
  const vm = 1 / (1 - r / 2);
  if (mode === 'in') return t < r ? (vm * t * t) / (2 * r) : vm * (t - r / 2);
  if (mode === 'out') return t > 1 - r ? 1 - (vm * (1 - t) * (1 - t)) / (2 * r) : vm * t;
  return t;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export interface FilmHooks {
  isNight(): boolean;
  setNight(v: boolean): void;
}

/** 目前的畫面狀態（給字卡與控制列用） */
export interface FilmFrame {
  /** 鏡頭序號；等於 SHOTS.length 時是片尾字卡 */
  index: number;
  shot?: Shot;
  local: number;
  /** 黑畫面不透明度（淡入淡出、片尾） */
  black: number;
  /** 空間名稱字卡的不透明度 */
  caption: number;
  endCard: number;
}

/** 分鏡播放：依時間設定相機（位置、注視點、焦距、移軸）與日夜，鏡頭之間直接切 */
export class FilmPlayer {
  t = 0;
  playing = false;
  readonly starts: number[] = [];
  readonly total: number;
  private readonly look = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly hooks: FilmHooks) {
    let acc = 0;
    for (const s of SHOTS) { this.starts.push(acc); acc += s.dur; }
    this.starts.push(acc);
    this.total = acc + END_CARD.dur;
  }

  /** 時間 t 落在第幾個鏡頭、鏡頭內第幾秒 */
  locate(t: number): { index: number; local: number } {
    let i = 0;
    while (i < SHOTS.length && t >= this.starts[i + 1]) i++;
    return { index: i, local: t - this.starts[i] };
  }

  seek(t: number): FilmFrame {
    this.t = Math.max(0, Math.min(this.total, t));
    return this.apply();
  }

  update(dt: number): FilmFrame {
    if (this.playing) {
      this.t += dt;
      if (this.t >= this.total) { this.t = this.total; this.playing = false; }
    }
    return this.apply();
  }

  private apply(): FilmFrame {
    const { index, local } = this.locate(this.t);
    const shot = SHOTS[index];
    if (!shot) {
      const k = local / END_CARD.dur;
      return { index, local, black: 1, caption: 0, endCard: Math.min(1, k / 0.15, (1 - k) / 0.15) };
    }
    const k = ease(local / shot.dur, shot.ease);
    this.pose(shot.from, shot.to, k);
    this.camera.fov = fovFor(shot.focal);
    this.camera.updateProjectionMatrix();
    // 移軸：投影矩陣的 y 偏移（正值把畫面往上移），相機本身保持水平
    if (shot.shift) {
      this.camera.projectionMatrix.elements[9] = 2 * shot.shift;
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    }
    const night = shot.light === 'night' || (shot.toNight !== undefined && local >= shot.toNight);
    if (night !== this.hooks.isNight()) this.hooks.setNight(night);
    const fin = shot.fadeIn ? Math.max(0, 1 - local / shot.fadeIn) : 0;
    const fout = shot.fadeOut ? Math.max(0, 1 - (shot.dur - local) / shot.fadeOut) : 0;
    // 字卡：鏡頭開始 0.4 秒後淡入、結束前 0.6 秒淡出
    const caption = shot.caption ? Math.max(0, Math.min(1, (local - 0.4) / 0.5, (shot.dur - 0.6 - local) / 0.4)) : 0;
    return { index, shot, local, black: Math.max(fin, fout), caption, endCard: 0 };
  }

  private pose(a: CamPose, b: CamPose, k: number): void {
    const h = lerp(a.h, b.h, k);
    this.camera.position.set(X(lerp(a.at[0], b.at[0], k)), h, Z(lerp(a.at[1], b.at[1], k)));
    this.look.set(X(lerp(a.look[0], b.look[0], k)), lerp(a.lookH ?? a.h, b.lookH ?? b.h, k), Z(lerp(a.look[1], b.look[1], k)));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.look);
  }
}
