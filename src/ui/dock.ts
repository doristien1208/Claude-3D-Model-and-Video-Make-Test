import type { Viewpoint } from '../data/layout';

export type Mode = 'orbit' | 'walk';

const HINT: Record<Mode, string> = {
  orbit: '左鍵旋轉、右鍵平移、滾輪縮放。點上方房間名稱可直接走進去。',
  walk: '拖曳畫面轉頭，WASD 或方向鍵移動，按住 Shift 走快一點。',
};

const $ = (id: string) => document.getElementById(id)!;

export interface DockHandlers {
  setMode(m: Mode): void;
  setNight(v: boolean): void;
  toggleCut(): void;
  jump(v: Viewpoint): void;
}

/** 底部操作列：房間跳轉、俯瞰／漫遊、日／夜、剖切 */
export function createDock(viewpoints: readonly Viewpoint[], h: DockHandlers) {
  const roomBar = $('rooms');
  for (const v of viewpoints) {
    const b = document.createElement('button');
    b.textContent = v.label;
    b.onclick = () => h.jump(v);
    roomBar.appendChild(b);
  }
  $('bOrbit').onclick = () => h.setMode('orbit');
  $('bWalk').onclick = () => h.setMode('walk');
  $('bDay').onclick = () => h.setNight(false);
  $('bNight').onclick = () => h.setNight(true);
  $('bCut').onclick = () => h.toggleCut();

  return {
    showMode(m: Mode): void {
      $('bOrbit').setAttribute('aria-pressed', String(m === 'orbit'));
      $('bWalk').setAttribute('aria-pressed', String(m === 'walk'));
      $('map').style.display = m === 'walk' ? 'block' : 'none';
      $('bCut').style.display = m === 'orbit' ? '' : 'none';
      $('hint').textContent = HINT[m];
    },
    showNight(night: boolean): void {
      $('bDay').setAttribute('aria-pressed', String(!night));
      $('bNight').setAttribute('aria-pressed', String(night));
    },
    showCut(cut: boolean): void {
      $('bCut').setAttribute('aria-pressed', String(cut));
    },
  };
}

export function showWebGLError(): void {
  $('err').style.display = 'flex';
}
