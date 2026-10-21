import { ORIGIN_Y, X, Z, toPxX, toPxY } from '../core/units';
import { site } from '../data/layout';
import type { PlanSeg } from '../builders/prims';
import type { WalkController } from '../cameras/walk';

const MW = 170;

/** 漫遊時右上角的小地圖；點地圖可直接移動過去 */
export class Minimap {
  private readonly g: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly mh: number;
  private readonly walk: WalkController;
  private readonly mx: (x: number) => number;
  private readonly my: (y: number) => number;

  constructor(canvas: HTMLCanvasElement, planSegs: readonly PlanSeg[], walk: WalkController) {
    this.walk = walk;
    const [fx1, fy1, fx2, fy2] = site.floor;
    const s = MW / (fx2 - fx1);
    const MH = (this.mh = Math.round((fy2 - fy1) * s));
    const mx = (this.mx = (x: number) => (x - fx1) * s);
    const my = (this.my = (y: number) => (y - fy1) * s);
    canvas.width = MW * 2;
    canvas.height = MH * 2;
    canvas.style.width = `${MW}px`;
    canvas.style.height = `${MH}px`;
    this.g = canvas.getContext('2d')!;
    this.g.scale(2, 2);

    // 靜態底圖：牆、窗、實牆量體
    const base = (this.base = document.createElement('canvas'));
    base.width = MW * 2;
    base.height = MH * 2;
    const bg = base.getContext('2d')!;
    bg.scale(2, 2);
    bg.fillStyle = 'rgba(239,230,218,.06)';
    bg.fillRect(0, my(ORIGIN_Y), MW, my(fy2) - my(ORIGIN_Y));
    for (const p of planSegs) {
      if ('block' in p) {
        const [a, b, c, d] = p.block;
        bg.fillStyle = 'rgba(239,230,218,.35)';
        bg.fillRect(mx(a), my(b), (c - a) * s, (d - b) * s);
        continue;
      }
      bg.strokeStyle = p.kind === 'win' ? 'rgba(150,190,205,.9)' : 'rgba(239,230,218,.85)';
      bg.lineWidth = Math.max(1.4, p.t * s);
      bg.beginPath();
      if (p.hor) { bg.moveTo(mx(p.a), my(p.c)); bg.lineTo(mx(p.b), my(p.c)); }
      else { bg.moveTo(mx(p.c), my(p.a)); bg.lineTo(mx(p.c), my(p.b)); }
      bg.stroke();
    }

    canvas.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect(), k = MW / r.width;
      const x = X((e.clientX - r.left) * k / s + fx1), z = Z((e.clientY - r.top) * k / s + fy1);
      if (!walk.blocked(x, z)) { walk.state.x = x; walk.state.z = z; }
    });
  }

  draw(): void {
    const g = this.g, w = this.walk.state;
    g.clearRect(0, 0, MW, this.mh);
    g.drawImage(this.base, 0, 0, MW, this.mh);
    const px = this.mx(toPxX(w.x)), py = this.my(toPxY(w.z)), a = Math.atan2(-Math.cos(w.yaw), -Math.sin(w.yaw));
    g.fillStyle = 'rgba(201,154,91,.35)';
    g.beginPath(); g.moveTo(px, py); g.arc(px, py, 26, a - 0.55, a + 0.55); g.closePath(); g.fill();
    g.fillStyle = '#c99a5b';
    g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill();
  }
}
