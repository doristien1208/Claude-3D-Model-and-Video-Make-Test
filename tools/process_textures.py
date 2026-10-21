# -*- coding: utf-8 -*-
"""把 Gemini 產生的 basecolor 整理成可無縫拼接的 PBR 貼圖組。
輸出：<name>_base.jpg（sRGB）、<name>_nrm.jpg（OpenGL 法線）、<name>_orm.jpg（R=AO, G=roughness）
"""
import numpy as np, json, io, base64
from PIL import Image
from scipy.ndimage import gaussian_filter

UP = 'textures/source/'        # 請在 handoff 目錄下執行
OUT = 'textures/processed/'
rng = np.random.default_rng(7)

def load(f):
    return np.asarray(Image.open(UP + f).convert('RGB')).astype(np.float32) / 255.0
def to_lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def to_srgb(c):
    c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
def lum(a): return a[..., 0] * .2126 + a[..., 1] * .7152 + a[..., 2] * .0722
def blur(a, s): return gaussian_filter(a, s, mode='wrap')

def delight(img, strength, frac=6):
    """去除低頻明暗（光影漸層、大片雲斑），strength 0~1。"""
    lin = to_lin(img); L = lum(lin) + 1e-4
    low = blur(L, img.shape[0] / frac)
    gain = (low.mean() / low) ** strength
    return to_srgb(lin * gain[..., None])

def smooth(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
def tileable(img, bx, by):
    """把影像捲動半張後，在邊緣帶狀區域做保變異數混合，消除拼接縫。bx/by 為帶寬（像素，0=不處理）。"""
    H, W = img.shape[:2]
    wx = np.ones(W); wy = np.ones(H)
    if bx: x = np.arange(W); d = np.minimum(x, W - 1 - x); wx = smooth(d / bx)
    if by: y = np.arange(H); d = np.minimum(y, H - 1 - y); wy = smooth(d / by)
    m = (wy[:, None] * wx[None, :])[..., None] if img.ndim == 3 else wy[:, None] * wx[None, :]
    rolled = np.roll(img, (H // 2 if by else 0, W // 2 if bx else 0), axis=(0, 1))
    mu = img.mean(axis=(0, 1))
    out = mu + (m * (img - mu) + (1 - m) * (rolled - mu)) / np.sqrt(m ** 2 + (1 - m) ** 2)
    return np.clip(out, 0, 1)

def resize(a, n, mode=Image.LANCZOS):
    if a.ndim == 2:
        return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 65535).astype(np.uint16)).resize((n, n), mode)).astype(np.float32) / 65535 if False else \
            np.asarray(Image.fromarray(np.clip(a, 0, 1).astype(np.float32), mode='F').resize((n, n), mode))
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8)).resize((n, n), mode)).astype(np.float32) / 255

def highpass(L, s): return L - blur(L, s)
def norm01(h):
    s = h.std() + 1e-6; return h / (3 * s)

def normal_map(h, strength):
    """h：高度（任意尺度），回傳 OpenGL 慣例的法線貼圖（綠色朝上）。"""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * .5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * .5
    nx, ny, nz = -dx * strength, dy * strength, np.ones_like(h)
    l = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    return np.stack([nx / l, ny / l, nz / l], -1) * .5 + .5

def save(a, name, q=86):
    im = Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8))
    im.save(OUT + name + '.jpg', quality=q, subsampling=0 if q >= 90 else 2, optimize=True)

def grout(base, h, rough, ao, px, color):
    """在貼圖四周畫出磁磚溝縫（各邊 px 像素，拼接後為 2px）。"""
    n = base.shape[0]; idx = np.arange(n); d = np.minimum(idx, n - 1 - idx).astype(np.float32)
    dist = np.minimum(d[:, None], d[None, :])
    g = 1 - smooth((dist - px + .5) / 1.5)          # 1=溝縫
    bevel = smooth(dist / (px * 3))                 # 磚邊微倒角
    base = base * (1 - g[..., None]) + np.array(color)[None, None] * g[..., None]
    h = h * bevel - g * 1.2 - (1 - bevel) * .35
    rough = rough * (1 - g) + .95 * g
    ao = ao * (1 - .45 * g) * (1 - .15 * (1 - bevel))
    return base, h, rough, ao

meta = {}
def finish(name, base, h, rough, ao, nstr, nb, nn, no, covers):
    save(resize(base, nb), name + '_base', 86)
    save(normal_map(resize(h, nn), nstr * nn / 512), name + '_nrm', 90)
    orm = np.stack([resize(ao, no), resize(rough, no), np.zeros((no, no), np.float32)], -1)
    save(orm, name + '_orm', 90)
    meta[name] = {'covers': covers, 'meanLin': [float(v) for v in to_lin(base).reshape(-1, 3).mean(0)]}

# ---------- 1. 煙燻橡木地板：10 片 × 18 cm = 1.8 m ----------
a = load('M01_floor_oak.jpg')
a[-1] = a[-2]                                     # 底邊殘留的半條暗線
a = delight(a, .6)
a = tileable(a, 0, 110)                           # 左右本來就無縫，只修上下
L = lum(a)
seam = smooth((0.25 - L) / 0.09)                  # 板縫與節點（暗線）
seam = np.maximum(seam, gaussian_filter(seam, 1.2, mode='wrap') * .9)
grain = norm01(highpass(L, 4))
h = grain * .12 - seam * 1.0
rough = np.clip(.56 + grain * .05 + seam * .3, 0, 1)
ao = 1 - .55 * gaussian_filter(seam, 1.5, mode='wrap')
finish('floor', a, h, rough, ao, 3.2, 1024, 1024, 512, 1.8)

# ---------- 2. 胡桃木皮：0.6 m ----------
w = load('M02_walnut.png')
w = delight(w, .6)
w = tileable(w, 70, 90)
Lw = lum(w)
gw = norm01(highpass(Lw, 3))
pores = smooth((-gw - .6) / .8)
h = gw * .35 - pores * .25
rough = np.clip(.5 + pores * .12 - gw * .02, 0, 1)
ao = 1 - .15 * pores
finish('walnut', w, h, rough, ao, 1.2, 1024, 512, 256, 0.6)

# ---------- 2b. 木格柵（由胡桃木衍生）：0.6 m 內 10 支，45 mm 木條＋15 mm 溝 ----------
n = w.shape[0]; x = np.arange(n) / n * 10; f = x - np.floor(x)
gap_w = .25; edge = .035
inslat = smooth((f - gap_w / 2) / edge) * smooth((1 - gap_w / 2 - f) / edge)
tone = 1 + (rng.random(10) - .5) * .16
tones = tone[np.floor(x).astype(int) % 10]
sb = w * (tones[None, :, None]) * inslat[None, :, None] + np.array([.05, .035, .025]) * (1 - inslat[None, :, None])
sb = np.broadcast_to(sb, w.shape)
hs = np.broadcast_to(inslat[None, :], Lw.shape) * 1.0 + gw * .25 * inslat[None, :]
rs = np.clip(.5 + .4 * (1 - inslat[None, :]) + 0 * Lw, 0, 1)
aos = np.broadcast_to(.3 + .7 * inslat[None, :], Lw.shape)
finish('slat', sb, hs, rs, aos, 3.0, 1024, 512, 512, 0.6)

# ---------- 3/4. 石材：60 cm 一塊，產生「磁磚（含溝縫）」與「整片檯面」兩種 ----------
for src, name, gcol, s_del in (('M03_stone_dark.jpg', 'stoneDark', (.13, .125, .12), .45),
                               ('M04_stone_light.jpg', 'stoneLight', (.62, .57, .50), .45)):
    s = load(src)
    s = delight(s, s_del)
    s = tileable(s, 120, 120)
    s = resize(s, 1024)
    Ls = lum(s); gs = norm01(highpass(Ls, 2.5))
    pits = smooth((-gs - 1.0) / .8)
    h = gs * .2 - pits * .5
    rough = np.clip((.42 if name == 'stoneDark' else .48) + pits * .2 + gs * .02, 0, 1)
    ao = 1 - .2 * pits
    finish(name + 'Slab', s, h, rough, ao, 1.0, 1024, 512, 512, 0.6)
    b2, h2, r2, a2 = grout(s.copy(), h.copy(), rough.copy(), ao.copy(), 2.5, gcol)
    finish(name + 'Tile', b2, h2, r2, a2, 1.6, 1024, 512, 512, 0.6)

# ---------- 5. 礦物塗料：1 m ----------
p = load('M05_plaster.jpg')
p = delight(p, .5)
p = tileable(p, 140, 140)
Lp = lum(p)
h = norm01(highpass(Lp, 14)) * .6 + norm01(highpass(Lp, 2)) * .15
rough = np.clip(.9 + norm01(highpass(Lp, 14)) * .03, 0, 1)
ao = np.ones_like(Lp)
finish('plaster', p, h, rough, ao, .9, 1024, 512, 256, 1.0)

# ---------- 6. 亞麻布：0.12 m（中性色，材質端再染色） ----------
fb = load('M06_fabric_linen.jpg')
fb = delight(fb, .7)
fb = tileable(fb, 90, 90)
fb = resize(fb, 1024)
Lf = lum(fb); gf = norm01(highpass(Lf, 1.5))
h = gf * .8 + norm01(highpass(Lf, 6)) * .3
rough = np.clip(.93 + gf * .02, 0, 1)
ao = np.clip(1 - .3 * smooth((-gf - .3) / 1.2), 0, 1)
finish('fabric', fb, h, rough, ao, 3.2, 512, 512, 256, 0.12)

# ---------- 7. 羊毛地毯：0.3 m ----------
r = load('M07_rug_wool.png')
r = delight(r, .7)
r = tileable(r, 80, 80)
Lr = lum(r); gr = norm01(highpass(Lr, 2.5))
h = gr * 1.0
rough = np.clip(.97 + gr * .01, 0, 1)
ao = np.clip(1 - .45 * smooth((-gr - .2) / 1.2), 0, 1)
finish('rug', r, h, rough, ao, 1.6, 512, 512, 256, 0.3)

# ---------- 8. 皮革：0.2 m ----------
lt = load('M08_leather.png')
lt = delight(lt, .7)
lt = tileable(lt, 80, 80)
Ll = lum(lt); gl = norm01(highpass(Ll, 2.5))
crease = smooth((-gl - .4) / 1.0)
h = gl * .6 - crease * .3
rough = np.clip(.46 + crease * .18 - gl * .03, 0, 1)
ao = 1 - .2 * crease
finish('leather', lt, h, rough, ao, 1.1, 512, 512, 256, 0.2)

json.dump(meta, open(OUT + 'meta.json', 'w'), indent=1)
print(json.dumps({k: v['covers'] for k, v in meta.items()}))
