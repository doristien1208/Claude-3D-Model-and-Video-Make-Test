import GUI from 'lil-gui';
import type { Doors } from '../builders/doors';

/** 參數面板（左側，標題卡下方）：目前只有門的開關 */
export function createPanel(doors: Doors): GUI {
  const gui = new GUI({ title: '參數' });
  gui.domElement.classList.add('panel');

  const f = gui.addFolder('門（0 關 ～ 1 全開）');
  for (const d of doors.list) {
    const name = d.maxDeg !== undefined && d.maxDeg < 90 ? `${d.label}（門擋 ${d.maxDeg}°）` : d.label;
    f.add(d, 'open', 0, 1, 0.01).name(name).onChange((v: number) => d.set(v)).listen();
  }
  const all = (t: number) => () => { for (const d of doors.list) d.set(t); };
  f.add({ 全部打開: all(1) }, '全部打開');
  f.add({ 全部關上: all(0) }, '全部關上');
  return gui;
}
