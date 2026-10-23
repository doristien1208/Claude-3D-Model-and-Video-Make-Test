# -*- coding: utf-8 -*-
"""Poly Haven（CC0）布料貼圖 → 本專案的 <name>_base／_nrm／_orm.jpg。

原始色彩圖帶花紋或顏色（wool_boucle 是黑白粉黃格紋、rough_linen 是淺藍），這裡只留下紋理的明暗、轉成中性灰，
顏色交給材質的染色倍率（library.ts）。
  boucle      ← wool_boucle（31.5 × 39 cm）：色彩圖的明暗就是格紋，改用 AO（毛圈凹處）當明暗；粗糙度與法線原圖也帶格紋
                （格紋的紗粗細不同），同樣由 AO 推：AO 先去掉橫直條（destripe），再當毛圈高度算法線，斜率標準差對齊原法線圖
  roughLinen  ← rough_linen（27 × 27 cm）：色彩圖的亮度（粗麻的竹節、織紋）；粗糙度原圖調到亞麻的 0.85 左右
orm：R = AO、G = roughness、B = 0（與 process_textures.py 相同）。

用法（下載的原始檔放在 src）：python -I tools/process_polyhaven.py <src> public/textures
"""
import sys
import numpy as np
from PIL import Image

# 中性灰的線性平均：與 fabric_base 相近，染色倍率沿用同一套尺度
MEAN = 0.45


def lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255


def save(a, path, q):
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, quality=q, optimize=True)


def gray(detail, rel_std):
    """明暗細節（線性）→ 中性灰 basecolor：線性平均 MEAN、相對標準差 rel_std"""
    d = detail / detail.mean() - 1
    g = MEAN * (1 + d * (rel_std / d.std()))
    return np.repeat(srgb(np.clip(g, 0.05, 1))[..., None], 3, axis=2)


def destripe(a):
    """去掉格紋：格紋是橫條加直條，減掉每一列、每一行的平均（相對整體平均）；不規則排列的毛圈幾乎不受影響"""
    m = a.mean()
    return a - (a.mean(axis=0, keepdims=True) - m) - (a.mean(axis=1, keepdims=True) - m)


def normal_from_height(h, rel):
    """高度圖 → OpenGL 法線（綠色朝上；影像列往下，所以 y 取 +d/drow），可無縫拼接；斜率標準差 rel"""
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / 2
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / 2
    s = rel / np.sqrt((gx.std() ** 2 + gy.std() ** 2) / 2)
    n = np.stack([-s * gx, s * gy, np.ones_like(h)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def orm(ao, r):
    return np.stack([ao, np.clip(r, 0, 1), np.zeros_like(ao)], axis=2)


def main(src, out):
    # 羊毛 bouclé：毛圈陰影當明暗（相對 18%），凹處較粗糙 0.8–0.95
    arm = load(f'{src}/wool_boucle_arm_1k.jpg')
    ao = destripe(arm[..., 0])
    t = (ao - np.percentile(ao, 1)) / (np.percentile(ao, 99) - np.percentile(ao, 1))
    save(gray(lin(ao), 0.18), f'{out}/boucle_base.jpg', 88)
    orig = load(f'{src}/wool_boucle_nor_gl_1k.jpg') * 2 - 1
    save(normal_from_height(ao, (orig[..., 0].std() + orig[..., 1].std()) / 2), f'{out}/boucle_nrm.jpg', 92)
    save(orm(ao, 0.95 - 0.15 * np.clip(t, 0, 1)), f'{out}/boucle_orm.jpg', 88)

    # 粗麻：色彩圖亮度（相對 10%），粗糙度平均移到 0.85
    diff = lin(load(f'{src}/rough_linen_diff_1k.jpg'))
    lum = diff @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    arm = load(f'{src}/rough_linen_arm_1k.jpg')
    save(gray(lum, 0.10), f'{out}/roughLinen_base.jpg', 88)
    save(load(f'{src}/rough_linen_nor_gl_1k.jpg'), f'{out}/roughLinen_nrm.jpg', 92)
    g = arm[..., 1]
    save(orm(arm[..., 0], 0.85 + (g - g.mean()) * 0.7), f'{out}/roughLinen_orm.jpg', 88)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
