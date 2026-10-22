// 下載窗外景觀用的 HDRI（Poly Haven，CC0）到 public/hdri/；已存在就略過。
// 檔案約 25 MB，不納入版本控制。
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../public/hdri');
const files = [
  // 白天：陰天、高樓陽台看城市（https://polyhaven.com/a/hotel_rooftop_balcony）
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/hotel_rooftop_balcony_4k.hdr',
  // 夜晚：亞洲高樓天際線（https://polyhaven.com/a/shanghai_bund）
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/shanghai_bund_4k.hdr',
];

mkdirSync(out, { recursive: true });
for (const url of files) {
  const dest = resolve(out, url.split('/').pop());
  if (existsSync(dest)) { console.log(`已存在：${dest}`); continue; }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`下載失敗 ${res.status}：${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  console.log(`已下載：${dest}`);
}
