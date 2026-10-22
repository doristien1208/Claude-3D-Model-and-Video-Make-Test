// 下載窗外景觀照片（Wikimedia Commons，曾成訓攝，CC BY 2.0）到 public/backplates/；已存在就略過。
// 2013-12-25 在台中西區同一棟高樓上拍的白天、夜晚多個方向，各 7360 × 4912、約 3–4 MB，不納入版本控制。
// 影片使用時需註明：Photo: 曾成訓, CC BY 2.0, via Wikimedia Commons
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../public/backplates');
const files = [
  'Taichung_old_city_center_Skyline_2013.jpg',
  'Cityscape_in_West_District_of_Taichung.jpg',
  'Taichung_night_skyline_2013.jpg',
  'Night_cityscape_in_West_District_of_Taichung_02.jpg',
];

/** Commons 原始檔網址：/wikipedia/commons/<md5 第 1 碼>/<md5 前 2 碼>/<檔名> */
const commonsUrl = (name) => {
  const h = createHash('md5').update(name).digest('hex');
  return `https://upload.wikimedia.org/wikipedia/commons/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(name)}`;
};

mkdirSync(out, { recursive: true });
for (const name of files) {
  const dest = resolve(out, name);
  if (existsSync(dest)) { console.log(`已存在：${dest}`); continue; }
  const url = commonsUrl(name);
  // Wikimedia 要求說明用途的 User-Agent
  const res = await fetch(url, { headers: { 'User-Agent': 'house3d-model/1.0 (https://github.com/doristien1208/Claude-3D-Model-and-Video-Make-Test)' } });
  if (!res.ok || !res.body) throw new Error(`下載失敗 ${res.status}：${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  console.log(`已下載：${dest}`);
}
