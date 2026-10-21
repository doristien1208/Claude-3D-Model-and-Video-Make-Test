# -*- coding: utf-8 -*-
# 依 3D 模型目前的幾何（SVG px，100 px = 1 m）重新產生平面配置圖 V4
FONT = "Noto Sans CJK TC, Noto Sans TC, sans-serif"
WALL = "#30373a"
out = []
def a(s): out.append(s)
def rect(x1, y1, x2, y2, fill, stroke="none", sw=1, rx=0, extra=""):
    x, y = min(x1, x2), min(y1, y2)
    a(f'<rect x="{x:g}" y="{y:g}" width="{abs(x2-x1):g}" height="{abs(y2-y1):g}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def line(x1, y1, x2, y2, stroke, sw=1, extra=""):
    a(f'<line x1="{x1:g}" y1="{y1:g}" x2="{x2:g}" y2="{y2:g}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def circ(cx, cy, r, fill, stroke="none", sw=1):
    a(f'<circle cx="{cx:g}" cy="{cy:g}" r="{r:g}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
def text(x, y, s, size=14, fill="#293236", weight=400, anchor="middle", extra=""):
    a(f'<text x="{x:g}" y="{y:g}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {extra}>{s}</text>')

W_IN, H_IN = 1110, 1545
a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W_IN+80}" height="{H_IN+50}" viewBox="0 0 {W_IN+80} {H_IN+50}">')
a(f'<rect x="0" y="0" width="{W_IN+80}" height="{H_IN+50}" fill="#fbfaf7"/>')
a('<g transform="translate(40,30)" id="layout-v4">')
a('''<defs>
<pattern id="woodgrain" width="42" height="42" patternUnits="userSpaceOnUse"><line x1="0" y1="15" x2="42" y2="15" stroke="#ddc7a8" stroke-width="1" opacity=".25"/><line x1="15" y1="0" x2="15" y2="42" stroke="#d4bda6" stroke-width=".6" opacity=".16"/></pattern>
<pattern id="structural" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#53605f"/><line x1="0" y1="0" x2="0" y2="14" stroke="#788280" stroke-width="3" opacity=".47"/></pattern>
<pattern id="tile" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="none" stroke="#cbd9d5" stroke-width="1"/></pattern>
<marker id="arw" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#69877a" stroke-width="1.6"/></marker>
</defs>''')

# ---------- 標題 ----------
text(70, 48, "嵐・悠・羊駝｜住處平面配置", 30, "#293236", 700, "start")
text(70, 80, "空間尺度草案 V4.0  ·  外廓 9.75 × 11.60 m  ·  約 34.2 坪  ·  依 3D 模型同步", 15, "#777b77", 400, "start")

# ---------- 地坪 ----------
rect(70, 125, 1045, 1280, "#eee7dc")
rect(70, 125, 490, 1280, "#e6e6df")
rect(490, 125, 1045, 910, "#f1e7da")
rect(70, 125, 1045, 1280, "url(#woodgrain)")
rect(70, 125, 490, 1280, "#e6e6df", extra='opacity=".55"')
rect(835, 118, 1045, 260, "#e2e9e0")                                  # 小陽台
rect(76, 131, 486, 296, "#dfe8e6"); rect(76, 131, 486, 296, "url(#tile)")   # 主衛浴
rect(76, 212, 258, 296, "#cfdedd")                                    # 淋浴區
rect(604, 893, 771, 1131, "#e6e7e3"); rect(604, 893, 771, 1131, "url(#tile)")
rect(604, 1139, 771, 1276, "#eae4d7")                                 # 儲藏室
rect(779, 905, 887, 1160, "#e8d9c8")                                  # 短走廊
rect(779, 1160, 1039, 1274, "#fff2bd")                                # 玄關
rect(496, 889, 596, 1274, "#ece2d4")                                  # 客房前走廊
# 客廳展示角（L 型）
a('<path d="M891 923 L1003 923 L1003 752 L1039 752 L1039 966 L891 966 Z" fill="#dbe9d9" stroke="#456747" stroke-width="1.5"/>')
# 實牆
rect(887, 966, 1045, 1154, "url(#structural)", WALL, 1)
text(966, 1052, "實牆", 20, "#f5f6f2", 700); text(966, 1077, "不可使用", 14, "#e1e5e0")

# ---------- 牆體與開口 ----------
walls = [
    (70, 125, 835, 125, 12, [(95, 235, 'win'), (548, 712, 'win')]),
    (835, 118, 1045, 118, 12, [(845, 1035, 'rail')]),
    (70, 125, 70, 1280, 12, [(390, 520, 'win'), (625, 825, 'win'), (1000, 1140, 'win')]),
    (70, 1280, 1045, 1280, 12, []),
    (1045, 118, 1045, 1280, 12, [(132, 250, 'rail'), (305, 485, 'win'), (1185, 1275, 'door')]),
    (835, 125, 835, 260, 10, []),
    (835, 260, 1045, 260, 8, [(850, 1040, 'door')]),
    (490, 125, 490, 1280, 11, [(487, 558, 'door'), (572, 652, 'door'), (947, 1027, 'door')]),
    (70, 565, 490, 565, 10, []),
    (70, 940, 490, 940, 10, []),
    (70, 300, 490, 300, 9, [(400, 480, 'door')]),
    (600, 889, 775, 889, 9, []),
    (600, 889, 600, 1280, 8, [(940, 1015, 'door'), (1145, 1220, 'door')]),
    (775, 889, 775, 1280, 9, []),
    (600, 1135, 775, 1135, 9, []),
]
wins = []
for x1, y1, x2, y2, t, ops in walls:
    hor = y1 == y2
    s0, e0 = (min(x1, x2), max(x1, x2)) if hor else (min(y1, y2), max(y1, y2))
    s0 -= t / 2; e0 += t / 2
    c = y1 if hor else x1
    cur = s0
    for s, e, kind in sorted(ops):
        if s > cur:
            line(cur, c, s, c, WALL, t, 'stroke-linecap="butt"') if hor else line(c, cur, c, s, WALL, t, 'stroke-linecap="butt"')
        if kind in ('win', 'rail'):
            wins.append((hor, c, s, e, t, kind))
        cur = e
    if e0 > cur:
        line(cur, c, e0, c, WALL, t) if hor else line(c, cur, c, e0, WALL, t)
for hor, c, s, e, t, kind in wins:
    if kind == 'win':
        if hor:
            rect(s, c - t/2, e, c + t/2, "#e4eff2", "#5f8d99", 1.2); line(s, c, e, c, "#5f8d99", 1)
        else:
            rect(c - t/2, s, c + t/2, e, "#e4eff2", "#5f8d99", 1.2); line(c, s, c, e, "#5f8d99", 1)
    else:  # 陽台欄杆開口
        if hor: rect(s, c - 3, e, c + 3, "#c9d4d2", "#6d7f7c", 1)
        else: rect(c - 3, s, c + 3, e, "#c9d4d2", "#6d7f7c", 1)

# ---------- 門 ----------
def swing(hx, hy, lx, ly, ex, ey, r, sweep):
    line(hx, hy, lx, ly, WALL, 3)
    a(f'<path d="M{lx:g} {ly:g} A{r:g} {r:g} 0 0 {sweep} {ex:g} {ey:g}" fill="none" stroke="#727b77" stroke-width="1.5"/>')
swing(490, 487, 419, 487, 490, 558, 71, 0)      # 主臥
swing(490, 572, 410, 572, 490, 652, 80, 0)      # 書房
swing(490, 947, 410, 947, 490, 1027, 80, 0)     # 客房
swing(480, 300, 480, 220, 400, 300, 80, 0)      # 主衛浴（往浴室內開）
swing(600, 940, 675, 940, 600, 1015, 75, 1)     # 公用衛浴
swing(1045, 1275, 955, 1275, 1045, 1185, 90, 1) # 大門
# 儲藏室拉門（外掛於走廊側，往北滑開）
rect(591, 1145, 595, 1220, "#a88466", "#76543c", 1)
rect(591, 1067, 595, 1146, "none", "#a88466", 1.2, extra='stroke-dasharray="4 3"')
line(586, 1205, 586, 1160, "#76543c", 1.4, 'marker-end="url(#arw)"')
text(560, 1188, "拉門", 12, "#76543c", 700, extra='transform="rotate(-90,560,1188)"')
# 陽台落地拉門
rect(852, 258, 947, 262, "#cfe3e8", "#5f8d99", 1); rect(862, 263, 957, 267, "#cfe3e8", "#5f8d99", 1)

# ---------- 主臥套房 ----------
rect(76, 304.5, 395, 309, "#5b4636")                                   # 床頭木格柵牆
def bed(x1, y1, x2, y2):
    rect(x1 - 6, y1, x2 + 6, y1 + 8, "#6f5a4b", rx=2)
    rect(x1, y1 + 8, x2, y2, "#d5c1af", "#796454", 1.3, 7)
    rect(x1 + 6, y1 + 13, x2 - 6, y2 - 6, "#f7f4ee", "#b29f93", 1, 5)
    w = (x2 - x1 - 26) / 2
    rect(x1 + 9, y1 + 16, x1 + 9 + w, y1 + 50, "#fffefa", "#d4cabf", 1, 8)
    rect(x2 - 9 - w, y1 + 16, x2 - 9, y1 + 50, "#fffefa", "#d4cabf", 1, 8)
    line(x1 + 5, y1 + 66, x2 - 5, y1 + 66, "#c9c3b5", 1)
    rect(x1 + 2, y2 - 46, x2 - 2, y2 - 4, "#8d7a6b", rx=3, extra='opacity=".55"')
def stand(x1, y1, x2, y2):
    rect(x1, y1, x2, y2, "#d0b49d", "#796454", 1, 4); circ((x1+x2)/2, (y1+y2)/2, 9, "#ebe2ce", "#70513e")
def shelf(x1, y1, x2, y2, vertical=True, n=4):
    rect(x1, y1, x2, y2, "#8c6a51", "#796454", 1, 2)
    if vertical:
        step = (y2 - y1) / n
        for i in range(1, n): line(x1 + 3, y1 + i*step, x2 - 3, y1 + i*step, "#c8ab89", 1)
    else:
        step = (x2 - x1) / n
        for i in range(1, n): line(x1 + i*step, y1 + 3, x1 + i*step, y2 - 3, "#c8ab89", 1)
bed(129.5, 309, 309.5, 509)
stand(80, 317, 124, 354); stand(315, 317, 359, 354)
shelf(435, 366, 472, 486, True, 3)
text(280, 545, "主臥套房", 25, "#293236", 700)
text(280, 525, "4.20 × 2.65 m（臥室區）", 12.5, "#6e6256")

# 主衛浴：濕區｜玻璃隔屏｜乾區
rect(80, 135, 250, 210, "#f7faf8", "#78908c", 1.3, 26)                # 浴缸
rect(91, 145, 239, 200, "#d4e5e7", "#a1bec2", 1, 22); circ(228, 172, 4, "#8d9a97")
circ(110, 256, 11, "none", "#779996", 1.5)                              # 頂噴
rect(77, 246, 82, 266, "#5b6461")                                       # 壁掛龍頭
circ(170, 282, 5, "none", "#779996", 1.2)                               # 落水頭
line(259.5, 131, 259.5, 226, "#5f8d99", 3)                              # 玻璃隔屏
rect(280, 131, 336, 149, "#c7b6a6", "#796454", 1, 2)                    # 隱藏水箱
rect(292, 149, 324, 203, "#fafaf6", "#8a9896", 1.2, 15)                 # 壁掛馬桶
rect(350, 131.5, 470, 180, "#a88466", "#76543c", 1.2, 3)                # 懸浮洗手台
a('<ellipse cx="410" cy="157" rx="22" ry="15" fill="#f9fbfa" stroke="#8a9c97" stroke-width="1"/>')
text(185, 236, "濕區", 14, "#345b5a", 700); text(185, 254, "浴缸＋淋浴", 11.5, "#456f6d")
text(372, 222, "乾區", 14, "#345b5a", 700)
text(335, 262, "主衛浴", 20, "#293236", 700); text(335, 282, "4.20 × 1.75 m", 12, "#456f6d")

# ---------- 書房 ----------
shelf(76, 625, 115, 825, True, 5)
text(130, 725, "矮書櫃", 11, "#695a4d", 400, "middle", 'transform="rotate(90,130,725)"')
rect(178, 678, 428, 772, "#be9470", "#796454", 1.3, 5)
rect(272, 628, 320, 672, "#81827d", "#5e5f5b", 1, 10)                   # 椅子
rect(270, 754, 334, 760, "#3a3f40")                                     # 螢幕
circ(400, 695, 8, "#efe4cc", "#70513e")                                 # 檯燈
shelf(178, 900, 428, 935, False, 6)
text(303, 890, "書桌對面等長書櫃 2.50 m", 12, "#695a4d")
text(303, 828, "書房", 25, "#293236", 700)

# ---------- 客房 ----------
bed(157.5, 948, 317.5, 1150)
stand(108, 952, 150, 990); stand(325, 952, 367, 990)
rect(425, 1035, 485, 1270, "#8c6a51", "#796454", 1.2, 2)
for y in (1093, 1152, 1211): line(427, y, 483, y, "#c8ab89", 1)
text(455, 1155, "衣櫃", 13, "#f3e7d6", 700, "middle", 'transform="rotate(90,455,1155)"')
text(270, 1225, "客房", 25, "#293236", 700)

# ---------- 廚房、中島 ----------
rect(528, 131, 793, 191, "#866149", "#796454", 1.2, 3)
rect(600, 141, 650, 180, "#e2ebe9", "#666", 1, 5)
rect(728, 141, 780, 184, "#2b2f2e", rx=3); circ(742, 162, 7, "#4c5250"); circ(766, 162, 7, "#4c5250")
rect(796, 131, 830, 193, "#785744", "#796454", 1, 3)
text(813, 210, "高櫃", 11, "#695a4d")
rect(580, 270, 840, 378, "#e6ddcf", "#796454", 1.3, 8)
for x in (650, 731, 811): circ(x, 396, 19, "#b79578", "#796454", 1)
text(710, 238, "廚房＋中島餐桌", 22, "#293236", 700)
text(710, 330, "中島 2.60 × 1.08 m", 12.5, "#6e6256")

# ---------- 小陽台 ----------
circ(980, 192, 22, "#8d9c74"); circ(988, 184, 9, "#b9c7a2")
text(912, 200, "小陽台", 19, "#293236", 700); text(912, 222, "2.10 × 1.36 m", 12, "#456747")

# ---------- 客廳 ----------
rect(578, 568, 936, 838, "#dbd4ca", rx=12)
rect(592, 589, 686, 822, "#c6ad98", "#796454", 1.3, 12)                 # 沙發長邊
rect(686, 753, 799, 822, "#c6ad98", "#796454", 1.3, 12)                 # 沙發短邊
for y1, y2 in ((610, 672), (674, 736), (738, 800)): rect(616, y1, 684, y2, "#f1e7de", "#d6c6b5", 1, 8)
for x1, x2 in ((688, 734), (736, 778)): rect(x1, 755, x2, 800, "#f1e7de", "#d6c6b5", 1, 8)
rect(617, 616, 632, 656, "#b98a55", rx=4)
circ(798, 676, 45, "#9e7957", "#70513e", 1.2); circ(798, 676, 30, "#ead9c3")
a('<g transform="translate(892,808.5) rotate(35.3)"><rect x="-35" y="-31" width="70" height="62" rx="12" fill="#b07a5a" stroke="#796454" stroke-width="1.2"/><rect x="-35" y="21" width="70" height="10" rx="4" fill="#8a5a40"/></g>')
circ(705, 597, 12, "#f4e4c8", "#a08060", 1.2)                           # 落地燈
circ(510, 455, 17, "#8d9c74"); circ(515, 450, 7, "#b9c7a2")
text(800, 560, "客廳", 28, "#293236", 700)
text(745, 856, "L 型沙發：距書房牆約 0.97 m", 12.5, "#6e6256")
# 電視牆
rect(987, 470, 1039, 745, "#edc2b9", "#a35d54", 1.3, 3)
rect(1027, 549, 1033, 692, "#283235", rx=2)
text(960, 462, "電視牆", 15, "#92534a", 700)
# 展示角
shelf(1003, 752, 1039, 966, True, 6)
shelf(891, 923, 1003, 966, False, 4)
text(940, 912, "書櫃／展示櫃（L 型）", 13, "#456747", 700)

# ---------- 公用衛浴、儲藏室 ----------
rect(609, 894.5, 670, 940, "#a88466", "#76543c", 1, 3); circ(640, 917, 11, "#f9fbfa", "#8a9c97")
rect(709, 894.5, 749, 900, "#c7b6a6"); rect(713, 900, 745, 950, "#f9f9f5", "#899c98", 1.2, 15)
rect(605, 1035, 771, 1131, "#cfe1e0", "#86a5a3", 1, 3)
line(605, 1034, 715, 1034, "#5f8d99", 3)
circ(725, 1110, 8, "none", "#779996", 1.3)
text(688, 1000, "公用衛浴", 20, "#293236", 700); text(688, 1019, "1.75 × 2.46 m", 12, "#456f6d")
text(660, 1090, "淋浴", 15, "#456f6d")
shelf(712, 1149, 758, 1266, True, 4)
rect(654, 1220, 702, 1246, "#cbb99f", rx=3); rect(656, 1250, 701, 1271, "#dfd2bc", rx=3)
text(657, 1180, "儲藏室", 19, "#293236", 700)

# ---------- 走廊、壁燈、玄關 ----------
for y in (1095, 1225):
    rect(496, y - 6, 501, y + 6, "#30373a"); circ(507, y, 6, "#ffd59a", "#c99a5b", 1.2)
text(552, 1060, "客房前走廊  淨寬約 1.00 m", 13, "#5b6361", 700, "middle", 'transform="rotate(-90,552,1060)"')
text(533, 1160, "壁燈", 11, "#9a7440", 700)
rect(930, 1158.5, 1039, 1185, "#c5e2ed", "#796454", 1, 2)
text(984, 1208, "玄關系統櫃", 13, "#326577", 700)
text(860, 1245, "玄關", 20, "#80631e", 700)
text(833, 1030, "短走廊", 16, "#5b6361", 700)
text(833, 1050, "淨寬約 1.07 m", 12, "#5b6361")
a('<path d="M1000 1238 L835 1238 L835 1090" fill="none" stroke="#69877a" stroke-width="2" stroke-dasharray="7 5"/>')
a('<path d="M835 1010 L835 930 L850 900" fill="none" stroke="#69877a" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#arw)"/>')

# ---------- 尺寸標註 ----------
dc = "#617d7a"
line(70, 104, 1045, 104, dc, 1.4); line(70, 97, 70, 111, dc, 1.4); line(1045, 97, 1045, 111, dc, 1.4)
rect(470, 92, 650, 114, "#fbfaf7")
text(560, 109, "9.75 m｜外廓寬度", 17, "#386961", 700)
yb = 1304
line(70, yb, 1045, yb, "#7f918a", 1.2)
for x in (70, 490, 1045): line(x, yb - 9, x, yb + 9, "#718581", 1.2)
text(280, yb + 18, "4.20 m", 13.5, "#5e7872", 700); text(767.5, yb + 18, "5.55 m（右半部 +0.25 m）", 13.5, "#5e7872", 700)
xl = 22
line(xl, 125, xl, 1280, dc, 1.4); line(xl - 7, 125, xl + 7, 125, dc, 1.4); line(xl - 7, 1280, xl + 7, 1280, dc, 1.4)
text(xl - 6, 702, "11.60 m｜外廓深度", 17, "#386961", 700, "middle", f'transform="rotate(-90,{xl-6},702)"')
xr = 50
line(xr, 125, xr, 1280, "#a8b5af", 1)
for y in (125, 565, 940, 1280): line(xr - 8, y, xr + 8, y, "#718581", 1.2)
for y, s in ((345, "4.42 m"), (752, "3.77 m"), (1110, "3.41 m")):
    text(xr - 5, y, s, 13, "#65776f", 700, "middle", f'transform="rotate(-90,{xr-5},{y})"')

# ---------- 圖例與備註 ----------
text(70, 1350, "右下角動線：入口 → 小玄關 → 短走廊 → 客廳", 17, "#293236", 700, "start")
lx = 70; ly = 1378
text(lx, ly + 15, "圖例：", 14, "#646a68", 400, "start")
items = [("#fff2bd", "#a7a9a3", "玄關"), ("#c5e2ed", "#a7a9a3", "小系統櫃"), ("url(#structural)", "#a7a9a3", "純實牆"),
         ("#dbe9d9", "#a7a9a3", "客廳展示角"), ("#edc2b9", "#a7a9a3", "電視牆"), ("#e4eff2", "#5f8d99", "窗（建模假設）"), ("#ffd59a", "#c99a5b", "壁燈")]
x = lx + 58
for f, st, lab in items:
    rect(x, ly, x + 20, ly + 20, f, st, 1, 2); text(x + 28, ly + 15, lab, 14, "#555f5b", 400, "start")
    x += 40 + 14.5 * len(lab)
text(70, 1432, "V4 修訂：右半部加寬 25 cm（外廓 9.75 m）、主衛浴併入左上角並改乾濕分離、書房加等長書櫃、儲藏室改拉門、", 13.5, "#7b817d", 400, "start")
text(70, 1452, "客房前走廊與短走廊重新分配寬度、陽台加寬、中島左移讓出陽台門、客廳展示角貼牆、沙發遠離書房門、走廊加壁燈。", 13.5, "#7b817d", 400, "start")
text(70, 1474, "室內門 80 cm（主臥約 70 cm）、大門 90 cm、淨高 2.8 m；窗戶位置為建模時的假設，非原圖指定。冰箱位置待定。", 13.5, "#7b817d", 400, "start")
rect(70, 1494, 1045, 1536, "#edf2ed", "#c6d2c8", 1, 9)
text(557.5, 1521, "外廓 9.75 × 11.60 m：113.1㎡／約 34.2 坪（含陽台、牆體）  ·  創作場景配置草案，非施工圖", 16, "#405e56", 500)

a('</g></svg>')
open('嵐與悠_住宅尺寸配置_v4.svg', 'w', encoding='utf8').write("<?xml version='1.0' encoding='UTF-8'?>\n" + "\n".join(out))
print("written")
