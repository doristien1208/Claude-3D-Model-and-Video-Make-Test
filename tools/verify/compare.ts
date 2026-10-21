/**
 * 參考版 ↔ 新版同步對照：最後被操作的一邊為主，另一邊每格複製它的狀態。
 * 兩邊都提供相同的 window.__dbg（setMode／setNight／setCut／walk／camera／orbit），
 * 目前的模式、日夜、剖切則從按鈕的 aria-pressed 讀取。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
type Key = 'ref' | 'new';

const $ = (id: string) => document.getElementById(id)!;
const iframes: Record<Key, HTMLIFrameElement> = { ref: $('fRef') as HTMLIFrameElement, new: $('fNew') as HTMLIFrameElement };
const panes: Record<Key, HTMLElement> = { ref: $('pRef'), new: $('pNew') };
const tags: Record<Key, HTMLElement> = { ref: $('tRef'), new: $('tNew') };
const other = (k: Key): Key => (k === 'ref' ? 'new' : 'ref');

let lead: Key = 'new';
let ab = false;

function setLead(k: Key): void {
  lead = k;
  tags.ref.classList.toggle('lead', k === 'ref');
  tags.new.classList.toggle('lead', k === 'new');
}

function setAB(on: boolean): void {
  ab = on;
  $('stage').classList.toggle('ab', on);
  $('bSide').setAttribute('aria-pressed', String(!on));
  $('bAB').setAttribute('aria-pressed', String(on));
  $('hint').textContent = on
    ? '按 X 在參考版與新版之間切換；目前顯示的那一邊即為操作中。'
    : '在任一邊操作，另一邊會跟著同步鏡頭、視角模式、日夜與剖切。';
  showAB();
}

function showAB(): void {
  panes.ref.classList.toggle('off', ab && lead !== 'ref');
  panes.new.classList.toggle('off', ab && lead !== 'new');
}

function flip(): void {
  if (!ab) return;
  setLead(other(lead));
  showAB();
}

function hook(k: Key): void {
  const doc = iframes[k].contentDocument;
  if (!doc) return;
  for (const t of ['pointerdown', 'wheel', 'keydown'] as const)
    doc.addEventListener(t, (e) => {
      if (t === 'keydown' && (e as KeyboardEvent).key.toLowerCase() === 'x') { flip(); return; }
      if (!ab) setLead(k);
    }, { capture: true });
}

function state(win: Any) {
  const d = win.document, pressed = (id: string) => d.getElementById(id)?.getAttribute('aria-pressed') === 'true';
  return { mode: pressed('bWalk') ? 'walk' : 'orbit', night: pressed('bNight'), cut: pressed('bCut') };
}

function sync(): void {
  const L = iframes[lead].contentWindow as Any, F = iframes[other(lead)].contentWindow as Any;
  if (L?.__dbg && F?.__dbg) {
    const a = state(L), b = state(F);
    if (a.mode !== b.mode) F.__dbg.setMode(a.mode);
    if (a.night !== b.night) F.__dbg.setNight(a.night);
    if (a.cut !== b.cut) F.__dbg.setCut(a.cut);
    if (a.mode === 'orbit') {
      F.__dbg.camera.position.copy(L.__dbg.camera.position);
      F.__dbg.orbit.target.copy(L.__dbg.orbit.target);
    } else {
      const w = L.__dbg.walk;
      Object.assign(F.__dbg.walk, { x: w.x, z: w.z, yaw: w.yaw, pitch: w.pitch });
    }
  }
  requestAnimationFrame(sync);
}

for (const k of ['ref', 'new'] as const) {
  iframes[k].addEventListener('load', () => hook(k));
  hook(k);
}
$('bSide').onclick = () => setAB(false);
$('bAB').onclick = () => setAB(true);
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'x') flip(); });
setLead('new');
requestAnimationFrame(sync);

export {};
