// 產生 tools/verify/ref.html：參考版的副本，多匯出 window.__ref 供比對頁讀取場景、碰撞與小地圖資料。
// 參考版原檔（handoff/reference/house3d_current.html）不會被修改。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../handoff/reference/house3d_current.html');
const out = resolve(here, 'ref.html');

const html = readFileSync(src, 'utf8');
const anchor = 'window.__dbg={';
if (!html.includes(anchor)) throw new Error('參考版中找不到 window.__dbg，無法插入匯出程式');
const inject =
  'window.__ref={THREE,scene,renderer,camera,orbit,solids,planSegs,mat,books,hemi,sun,ceiling,' +
  'nightLights:nightLights.map(([l])=>l),TEX:window.TEX};\n';
writeFileSync(out, html.replace(anchor, inject + anchor));
console.log(`已寫入 ${out}`);
