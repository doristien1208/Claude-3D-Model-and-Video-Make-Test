import type { FilmFrame, FilmPlayer } from '../cameras/film';
import { END_CARD, SHOTS } from '../data/shots';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  return e;
};

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/** 影片分鏡的畫面疊加（16:9 畫框內的空間名稱、淡入淡出黑畫面、片尾字卡）與底部控制列 */
export function createFilmUI(player: FilmPlayer, onExit: () => void) {
  const frame = el('div', 'film-frame'), caption = el('div', 'film-caption'), black = el('div', 'film-black'), end = el('div', 'film-end');
  for (const line of END_CARD.lines) end.appendChild(el('p', '', line));
  frame.append(black, caption, end);

  const bar = el('div', 'bar film-bar');
  const prev = el('button', '', '⏮'), play = el('button', '', '▶'), next = el('button', '', '⏭'), exit = el('button', '', '返回');
  const range = el('input', 'film-range'), label = el('span', 'film-label');
  prev.title = '上一個鏡頭';
  next.title = '下一個鏡頭';
  range.type = 'range';
  range.min = '0';
  range.max = String(player.total);
  range.step = '0.05';
  bar.append(prev, play, next, range, label, exit);
  document.body.append(frame, bar);

  const jump = (d: number) => {
    const { index } = player.locate(player.t);
    const i = Math.max(0, Math.min(SHOTS.length, index + d));
    player.seek(player.starts[i]);
  };
  const toggle = () => {
    if (!player.playing && player.t >= player.total) player.seek(0);
    player.playing = !player.playing;
  };
  prev.onclick = () => jump(-1);
  next.onclick = () => jump(1);
  play.onclick = toggle;
  exit.onclick = onExit;
  range.oninput = () => { player.playing = false; player.seek(Number(range.value)); };
  let active = false;
  addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.key === ' ') { toggle(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') jump(-1);
    else if (e.key === 'ArrowRight') jump(1);
    else if (e.key === 'Escape') onExit();
  });

  return {
    show(on: boolean): void {
      active = on;
      document.body.classList.toggle('film', on);
    },
    /** 畫框（畫布在視窗中的位置） */
    layout(left: number, top: number, w: number, h: number): void {
      Object.assign(frame.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
      frame.style.setProperty('--fh', `${h}px`);
    },
    update(f: FilmFrame): void {
      caption.textContent = f.shot?.caption ?? caption.textContent;
      caption.style.opacity = String(f.caption);
      black.style.opacity = String(f.black);
      end.style.opacity = String(f.endCard);
      play.textContent = player.playing ? '❚❚' : '▶';
      if (document.activeElement !== range) range.value = String(player.t);
      const n = Math.min(f.index + 1, SHOTS.length);
      label.textContent = `${String(n).padStart(2, '0')}／${SHOTS.length}　${f.shot ? f.shot.id : '片尾'}　${clock(player.t)}／${clock(player.total)}`;
    },
  };
}
