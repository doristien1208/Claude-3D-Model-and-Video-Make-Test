/**
 * 單一資料來源：牆體、開口、空間、家具擺位、燈位。
 *
 * 單位：平面以 SVG px 記錄（100 px = 1 m），高度以公尺記錄。
 * 世界座標換算見 src/core/units.ts：X = (x − 70) / 100、Z = (y − 125) / 100。
 *
 * 分工原則：平面圖上會標的數字（位置、外框、高度）放這裡；
 * 物件內部怎麼長（零件比例、倒角）放 src/builders/。
 * 目前數值全部取自 handoff/reference/house3d_current.html（V4 格局，已確認）。
 */

export type Rect = readonly [x1: number, y1: number, x2: number, y2: number];
export type Pt = readonly [x: number, y: number];
/** 高度範圍（m） */
export type HRange = readonly [h0: number, h1: number];
export type Side = 'N' | 'S' | 'E' | 'W';

/** 室內淨高（m） */
export const CEILING_H = 2.8;

export const site = {
  /** 樓板範圍（含陽台北牆外凸到 y 118） */
  floor: [70, 118, 1045, 1280] as Rect,
  /** 外牆厚度；天花板會向外多蓋半個牆厚 */
  extWallT: 12,
};

/* ---------- 牆體與開口 ---------- */

export type OpeningKind = 'window' | 'rail' | 'door';
export interface Opening {
  id: string;
  /** 沿牆方向的起訖（px） */
  s: number;
  e: number;
  /** 下緣、上緣（m） */
  bot: number;
  top: number;
  kind: OpeningKind;
}
export interface Wall {
  id: string;
  a: Pt;
  b: Pt;
  /** 厚度（px） */
  t: number;
  openings?: readonly Opening[];
}

export const walls: readonly Wall[] = [
  // 外牆（厚 12）
  { id: 'ext-N', a: [70, 125], b: [835, 125], t: 12, openings: [
    { id: 'win-mbath', s: 95, e: 235, bot: 1.5, top: 2.1, kind: 'window' },
    { id: 'win-kitchen', s: 548, e: 712, bot: 1.05, top: 2.1, kind: 'window' },
  ] },
  { id: 'ext-N-balcony', a: [835, 118], b: [1045, 118], t: 12, openings: [
    { id: 'rail-balcony-N', s: 845, e: 1035, bot: 1.05, top: CEILING_H, kind: 'rail' },
  ] },
  { id: 'ext-W', a: [70, 125], b: [70, 1280], t: 12, openings: [
    { id: 'win-mbed', s: 390, e: 520, bot: 0.9, top: 2.3, kind: 'window' },
    { id: 'win-study', s: 625, e: 825, bot: 1.1, top: 2.3, kind: 'window' },
    { id: 'win-guest', s: 1000, e: 1140, bot: 0.9, top: 2.3, kind: 'window' },
  ] },
  { id: 'ext-S', a: [70, 1280], b: [1045, 1280], t: 12 },
  { id: 'ext-E', a: [1045, 118], b: [1045, 1280], t: 12, openings: [
    { id: 'rail-balcony-E', s: 132, e: 250, bot: 1.05, top: CEILING_H, kind: 'rail' },
    { id: 'win-living', s: 305, e: 485, bot: 0.45, top: 2.5, kind: 'window' },
    { id: 'door-main', s: 1185, e: 1275, bot: 0, top: 2.15, kind: 'door' },
  ] },
  // 內牆
  { id: 'kitchen-balcony', a: [835, 125], b: [835, 260], t: 10 },
  { id: 'balcony-S', a: [835, 260], b: [1045, 260], t: 8, openings: [
    { id: 'door-balcony', s: 850, e: 1040, bot: 0, top: 2.3, kind: 'door' },
  ] },
  { id: 'x490', a: [490, 125], b: [490, 1280], t: 11, openings: [
    { id: 'door-mbed', s: 487, e: 558, bot: 0, top: 2.1, kind: 'door' },
    { id: 'door-study', s: 572, e: 652, bot: 0, top: 2.1, kind: 'door' },
    { id: 'door-guest', s: 947, e: 1027, bot: 0, top: 2.1, kind: 'door' },
  ] },
  { id: 'mbed-study', a: [70, 565], b: [490, 565], t: 10 },
  { id: 'study-guest', a: [70, 940], b: [490, 940], t: 10 },
  { id: 'mbath-mbed', a: [70, 300], b: [490, 300], t: 9, openings: [
    { id: 'door-mbath', s: 400, e: 480, bot: 0, top: 2.1, kind: 'door' },
  ] },
  { id: 'bath-N', a: [600, 889], b: [775, 889], t: 9 },
  { id: 'x600', a: [600, 889], b: [600, 1280], t: 8, openings: [
    { id: 'door-bath', s: 940, e: 1015, bot: 0, top: 2.1, kind: 'door' },
    { id: 'door-storage', s: 1145, e: 1220, bot: 0, top: 2.1, kind: 'door' },
  ] },
  { id: 'x775', a: [775, 889], b: [775, 1280], t: 9 },
  { id: 'bath-storage', a: [600, 1135], b: [775, 1135], t: 9 },
];

/** 實牆量體（不可使用，滿高） */
export const solidBlocks: readonly Rect[] = [[887, 966, 1045, 1154]];

/* ---------- 門 ---------- */

/**
 * 門的開關狀態 open 為 0（關）～1（全開）。
 * 平開門的「全開」角度由建構時的碰撞檢查決定（門把碰到牆或家具前停住，等同裝門擋）。
 */
export type Door =
  // 平開門（隱框：2 cm 門樘＋5 mm 陰影縫）；hinge 為鉸鏈在開口的哪一端，swing 為往哪一側開；leafT 為門片厚（cm）
  | { id: string; label: string; kind: 'swing'; opening: string; hinge: 'start' | 'end'; swing: Side; leafT: number;
      material: 'walnut' | 'door'; open: number; threshold?: boolean }
  // 外掛拉門：side 為門片所在側，門片離牆 gap、左右各蓋過開口 overlap，開啟時往 slideTo 端滑 travel（皆 px）
  | { id: string; label: string; kind: 'slide'; opening: string; side: Side; slideTo: 'start' | 'end'; leafT: number;
      gap: number; overlap: number; travel: number; open: number }
  // 陽台落地拉門：固定片＋活動片；active 為活動片「全開」時的位置，關閉時滑到 trackEnd
  | { id: string; label: string; kind: 'slideGlass'; opening: string; wallY: number; fixed: readonly [number, number];
      active: readonly [number, number]; trackEnd: number; h: number; open: number };

export const doors: readonly Door[] = [
  // 主臥、書房、客房：鉸鏈在開口北端，往房內（西）開
  { id: 'mbed', label: '主臥', kind: 'swing', opening: 'door-mbed', hinge: 'start', swing: 'W', leafT: 4, material: 'walnut', open: 1 },
  { id: 'study', label: '書房', kind: 'swing', opening: 'door-study', hinge: 'start', swing: 'W', leafT: 4, material: 'walnut', open: 1 },
  { id: 'guest', label: '客房', kind: 'swing', opening: 'door-guest', hinge: 'start', swing: 'W', leafT: 4, material: 'walnut', open: 1 },
  // 主衛浴：鉸鏈在東端，往浴室內（北）開
  { id: 'mbath', label: '主衛浴', kind: 'swing', opening: 'door-mbath', hinge: 'end', swing: 'N', leafT: 4, material: 'walnut', open: 1, threshold: true },
  // 公衛：鉸鏈在北端，往浴室內（東）開
  { id: 'bath', label: '公用衛浴', kind: 'swing', opening: 'door-bath', hinge: 'start', swing: 'E', leafT: 4, material: 'walnut', open: 1, threshold: true },
  // 大門：鉸鏈在南端，往室內開（2026-10 確認）
  { id: 'main', label: '大門', kind: 'swing', opening: 'door-main', hinge: 'end', swing: 'W', leafT: 5, material: 'door', open: 0, threshold: true },
  // 儲藏室外掛拉門：門片在走廊側（x 591–595），開啟時往北滑到 y 1067–1146
  { id: 'storage', label: '儲藏室', kind: 'slide', opening: 'door-storage', side: 'W', slideTo: 'start', leafT: 4, gap: 1, overlap: 2, travel: 76, open: 1 },
  // 陽台兩片落地拉門：固定片 x 852–947，活動片全開時 x 862–957
  { id: 'balcony', label: '陽台', kind: 'slideGlass', opening: 'door-balcony', wallY: 260, fixed: [852, 947], active: [862, 957], trackEnd: 1040, h: 2.3, open: 1 },
];

/* ---------- 收邊 ---------- */

export const finishes = {
  /** 踢腳板：高 h（m）、厚 t（px）；衛浴（牆面已貼石材）與陽台不做 */
  baseboard: { h: 0.06, t: 1, excludeSpaces: ['mbath', 'bath', 'balcony'] as readonly string[] },
};

/* ---------- 空間 ---------- */

export interface Space {
  id: string;
  name: string;
  rect: Rect;
}
/** HANDOFF 5.2；標「約」的邊界以近似值記錄 */
export const spaces: readonly Space[] = [
  { id: 'mbath', name: '主衛浴', rect: [70, 125, 490, 300] },
  { id: 'mbed', name: '主臥', rect: [70, 300, 490, 565] },
  { id: 'study', name: '書房', rect: [70, 565, 490, 940] },
  { id: 'guest', name: '客房', rect: [70, 940, 490, 1280] },
  { id: 'kitchen', name: '廚房＋中島', rect: [490, 125, 835, 420] },
  { id: 'balcony', name: '小陽台', rect: [835, 118, 1045, 260] },
  { id: 'living', name: '客廳', rect: [490, 420, 1045, 910] },
  { id: 'hall-guest', name: '客房前走廊', rect: [490, 889, 600, 1280] },
  { id: 'bath', name: '公用衛浴', rect: [600, 889, 775, 1135] },
  { id: 'storage', name: '儲藏室', rect: [600, 1135, 775, 1280] },
  { id: 'hall-short', name: '短走廊', rect: [775, 905, 887, 1160] },
  { id: 'entry', name: '玄關', rect: [775, 1160, 1045, 1280] },
];

/** 房間跳轉的漫遊視點（px；yaw／pitch 為弧度，pitch 省略時用 −0.08） */
export interface Viewpoint {
  label: string;
  at: Pt;
  yaw: number;
  pitch?: number;
}
export const viewpoints: readonly Viewpoint[] = [
  { label: '玄關', at: [915, 1250], yaw: 0.36 },
  { label: '客廳', at: [930, 455], yaw: 2.45, pitch: -0.12 },
  { label: '餐廚', at: [960, 475], yaw: 0.9 },
  { label: '主臥', at: [425, 530], yaw: 0.95 },
  { label: '主衛浴', at: [455, 260], yaw: 1.5, pitch: -0.18 },
  { label: '書房', at: [440, 895], yaw: 0.9 },
  { label: '客房', at: [375, 1235], yaw: 0.68 },
  { label: '公用衛浴', at: [635, 990], yaw: -1.2 },
];
/** 進入漫遊時的起始位置 */
export const walkStart: Viewpoint = { label: '起點', at: [915, 1250], yaw: 0.36, pitch: -0.05 };

/* ---------- 地坪與牆面石材 ---------- */

export type FloorMaterial = 'tileDark' | 'tileLight' | 'wetFloor' | 'stone';
export interface FloorZone {
  id: string;
  rect: Rect;
  material: FloorMaterial;
  /** 鋪面厚度（m） */
  h: number;
}
export const floorZones: readonly FloorZone[] = [
  { id: 'mbath', rect: [76, 131, 486, 296], material: 'tileDark', h: 0.006 },
  { id: 'bath', rect: [604, 893, 771, 1131], material: 'tileDark', h: 0.006 },
  { id: 'balcony', rect: [839, 122, 1040, 256], material: 'tileLight', h: 0.006 },
  { id: 'entry', rect: [779, 1158, 1040, 1275], material: 'tileDark', h: 0.006 },
  { id: 'mbath-wet', rect: [77, 212, 257, 295], material: 'wetFloor', h: 0.012 },
  { id: 'bath-shower', rect: [605, 1034, 771, 1131], material: 'stone', h: 0.03 },
];

/** 衛浴牆面石材（貼在牆面上的薄片，已扣掉窗與門） */
export const wallTiles: readonly { rect: Rect; h: HRange }[] = [
  // 主衛浴
  { rect: [76, 131, 95, 132], h: [0, CEILING_H] },
  { rect: [95, 131, 235, 132], h: [0, 1.5] },
  { rect: [95, 131, 235, 132], h: [2.1, CEILING_H] },
  { rect: [235, 131, 486, 132], h: [0, CEILING_H] },
  { rect: [76, 131, 77, 295], h: [0, CEILING_H] },
  { rect: [484, 131, 485, 295], h: [0, CEILING_H] },
  { rect: [77, 294.5, 400, 295.5], h: [0, CEILING_H] },
  { rect: [400, 294.5, 480, 295.5], h: [2.1, CEILING_H] },
  { rect: [480, 294.5, 484, 295.5], h: [0, CEILING_H] },
  // 公用衛浴
  { rect: [605, 893.5, 771, 894.5], h: [0, CEILING_H] },
  { rect: [770, 894, 771, 1131], h: [0, CEILING_H] },
  { rect: [604, 1130, 771, 1131], h: [0, CEILING_H] },
];

/* ---------- 家具與設備 ---------- */

export type RugMaterial = 'rug' | 'rug2';

export type Item =
  // 木格柵牆（滿高）；led 為格柵上的間接燈條
  | { id: string; type: 'slatWall'; rect: Rect; led?: { rect: Rect; h: HRange } }
  | { id: string; type: 'bed'; rect: Rect }
  | { id: string; type: 'headboardPanel'; rect: Rect; h: HRange }
  | { id: string; type: 'nightstand'; rect: Rect }
  | { id: string; type: 'wallLamp'; rect: Rect; h: HRange }
  // 開放書櫃；back 為背板所在側，seed 決定書本排列
  | { id: string; type: 'shelf'; rect: Rect; h: number; shelves: number; back: Side; seed: number }
  | { id: string; type: 'rug'; rect: Rect; material: RugMaterial; inner?: Rect }
  | { id: string; type: 'curtains'; window: string }
  | { id: string; type: 'bathtub'; rect: Rect }
  | { id: string; type: 'showerValve'; at: Pt }
  | { id: string; type: 'showerHead'; head: Pt; from: Pt; r: number }
  | { id: string; type: 'wallShelf'; rect: Rect; levels: readonly number[] }
  | { id: string; type: 'glassScreen'; rect: Rect; h: number; frame: 'full' | 'top' }
  | { id: string; type: 'toilet'; tank: Rect; tankH: HRange; bowl: Rect }
  | { id: string; type: 'vanity'; rect: Rect; basin: Rect; faucet: Rect; faucetTop: number; mirror: Rect; mirrorH: HRange }
  | { id: string; type: 'towelBar'; rect: Rect; h: HRange }
  | { id: string; type: 'desk'; rect: Rect }
  | { id: string; type: 'monitor'; rect: Rect }
  | { id: string; type: 'officeChair'; at: Pt }
  | { id: string; type: 'deskLamp'; at: Pt }
  // 一般櫃體；front 為櫃門面向，doors 為門片數（畫分割線）
  | { id: string; type: 'cabinet'; rect: Rect; h: HRange; front?: Side; doors?: number; seamH?: HRange; seamIn?: number }
  | { id: string; type: 'kitchenRun'; rect: Rect; doors: number; sink: Rect; hob: Rect; hood: Rect; hoodH0: number }
  | { id: string; type: 'island'; rect: Rect }
  | { id: string; type: 'barStool'; at: Pt }
  | { id: string; type: 'pendant'; at: Pt }
  | { id: string; type: 'plant'; at: Pt; potR: number; potH: number; leafR: number; leafSY: number; leafY: number }
  | { id: string; type: 'sofaL'; rect: Rect }
  | { id: string; type: 'coffeeTable'; at: Pt; r: number }
  | { id: string; type: 'armchair'; at: Pt; faceTo: Pt }
  | { id: string; type: 'floorLamp'; at: Pt }
  | { id: string; type: 'tvCabinet'; rect: Rect; h: HRange }
  | { id: string; type: 'tv'; rect: Rect; h: HRange }
  | { id: string; type: 'vase'; at: Pt; r: number; h: HRange }
  | { id: string; type: 'storageBox'; rect: Rect; h: number }
  // 走廊壁燈；at 為牆面上的位置（x 為牆面）
  | { id: string; type: 'sconce'; at: Pt; h: HRange }
  | { id: string; type: 'shoeCabinet'; rect: Rect; niche: HRange; top: number };

export type ItemType = Item['type'];

export const items: readonly Item[] = [
  /* 主臥 */
  { id: 'mbed-slat', type: 'slatWall', rect: [76, 304.5, 395, 307.5], led: { rect: [82, 307.5, 390, 309], h: [1.18, 1.2] } },
  { id: 'mbed-bed', type: 'bed', rect: [129.5, 308, 309.5, 509] },
  { id: 'mbed-ns-W', type: 'nightstand', rect: [80, 317, 124, 354] },
  { id: 'mbed-ns-E', type: 'nightstand', rect: [315, 317, 359, 354] },
  { id: 'mbed-lamp-W', type: 'wallLamp', rect: [96, 307.5, 108, 310], h: [1.3, 1.45] },
  { id: 'mbed-lamp-E', type: 'wallLamp', rect: [331, 307.5, 343, 310], h: [1.3, 1.45] },
  { id: 'mbed-shelf', type: 'shelf', rect: [435, 366, 472, 486], h: 2.0, shelves: 5, back: 'E', seed: 21 },
  { id: 'mbed-rug', type: 'rug', rect: [110, 370, 345, 556], material: 'rug2' },
  { id: 'mbed-curtains', type: 'curtains', window: 'win-mbed' },

  /* 主衛浴：西側濕區（浴缸＋淋浴）｜玻璃隔屏｜東側乾區（馬桶、洗手台） */
  { id: 'mbath-tub', type: 'bathtub', rect: [80, 135, 250, 210] },
  { id: 'mbath-valve', type: 'showerValve', at: [77, 256] },
  { id: 'mbath-head', type: 'showerHead', head: [110, 256], from: [77, 256], r: 0.12 },
  { id: 'mbath-towel-shelf', type: 'wallShelf', rect: [77, 280, 92, 294], levels: [1.25, 0.9] },
  { id: 'mbath-screen', type: 'glassScreen', rect: [258, 131, 261, 225], h: 2.1, frame: 'full' },
  { id: 'mbath-wc', type: 'toilet', tank: [280, 131, 336, 149], tankH: [0, 1.1], bowl: [292, 149, 324, 203] },
  { id: 'mbath-vanity', type: 'vanity', rect: [350, 131.5, 470, 180], basin: [390, 140, 430, 172], faucet: [406, 132, 414, 140],
    faucetTop: 1.12, mirror: [350, 131.5, 470, 133], mirrorH: [1.05, 1.95] },
  { id: 'mbath-towel-bar', type: 'towelBar', rect: [482, 190, 485, 250], h: [1.0, 1.03] },

  /* 書房 */
  { id: 'study-low-shelf', type: 'shelf', rect: [76, 625, 115, 825], h: 1.0, shelves: 2, back: 'W', seed: 31 },
  { id: 'study-shelf', type: 'shelf', rect: [178, 900, 428, 935], h: 2.2, shelves: 6, back: 'S', seed: 61 },
  { id: 'study-curtains', type: 'curtains', window: 'win-study' },
  { id: 'study-desk', type: 'desk', rect: [178, 678, 428, 772] },
  { id: 'study-monitor', type: 'monitor', rect: [270, 756, 334, 759] },
  { id: 'study-chair', type: 'officeChair', at: [296, 650] },
  { id: 'study-lamp', type: 'deskLamp', at: [400, 695] },
  { id: 'study-rug', type: 'rug', rect: [150, 640, 410, 820], material: 'rug' },

  /* 客房 */
  { id: 'guest-headboard', type: 'headboardPanel', rect: [150, 945, 326, 947.5], h: [0, 1.1] },
  { id: 'guest-bed', type: 'bed', rect: [157.5, 948, 317.5, 1150] },
  { id: 'guest-ns-W', type: 'nightstand', rect: [108, 952, 150, 990] },
  { id: 'guest-ns-E', type: 'nightstand', rect: [325, 952, 367, 990] },
  { id: 'guest-lamp-W', type: 'wallLamp', rect: [118, 947.5, 128, 950], h: [1.25, 1.4] },
  { id: 'guest-lamp-E', type: 'wallLamp', rect: [340, 947.5, 350, 950], h: [1.25, 1.4] },
  { id: 'guest-wardrobe', type: 'cabinet', rect: [425, 1035, 485, 1270], h: [0, 2.4], front: 'W', doors: 4, seamH: [0, 2.4], seamIn: 0 },
  { id: 'guest-rug', type: 'rug', rect: [140, 1080, 340, 1240], material: 'rug2' },
  { id: 'guest-curtains', type: 'curtains', window: 'win-guest' },

  /* 廚房與中島 */
  { id: 'kitchen-run', type: 'kitchenRun', rect: [528, 131, 793, 191], doors: 4,
    sink: [600, 140, 650, 180], hob: [728, 140, 780, 184], hood: [724, 131, 786, 175], hoodH0: 2.05 },
  // 高櫃：冰箱位置待決，目前只是占位
  { id: 'kitchen-tall', type: 'cabinet', rect: [796, 131, 830, 193], h: [0, 2.4] },
  { id: 'island', type: 'island', rect: [580, 270, 840, 378] },
  { id: 'stool-1', type: 'barStool', at: [650, 394] },
  { id: 'stool-2', type: 'barStool', at: [731, 394] },
  { id: 'stool-3', type: 'barStool', at: [811, 394] },
  { id: 'pendant-1', type: 'pendant', at: [645, 324] },
  { id: 'pendant-2', type: 'pendant', at: [710, 324] },
  { id: 'pendant-3', type: 'pendant', at: [775, 324] },

  /* 小陽台 */
  { id: 'balcony-plant', type: 'plant', at: [980, 192], potR: 0.22, potH: 0.45, leafR: 0.42, leafSY: 1.25, leafY: 0.95 },

  /* 客廳 */
  { id: 'living-rug', type: 'rug', rect: [578, 568, 936, 838], material: 'rug', inner: [584, 576, 930, 830] },
  // L 型沙發：長邊 x 592–686（椅背朝西），短邊 x 686–799、y 753–822（椅背朝南）
  { id: 'sofa', type: 'sofaL', rect: [592, 589, 799, 822] },
  { id: 'coffee-table', type: 'coffeeTable', at: [798, 676], r: 0.45 },
  { id: 'armchair', type: 'armchair', at: [892, 808.5], faceTo: [798, 676] },
  { id: 'floor-lamp', type: 'floorLamp', at: [705, 597] },
  { id: 'tv-slat', type: 'slatWall', rect: [1031, 470, 1039, 745] },
  { id: 'tv-cabinet', type: 'tvCabinet', rect: [987, 520, 1031, 710], h: [0.18, 0.5] },
  { id: 'tv', type: 'tv', rect: [1027, 549, 1030.5, 692], h: [0.95, 1.76] },
  // 展示角：高書櫃貼東牆，矮櫃貼實牆，接成 L 型
  { id: 'display-shelf', type: 'shelf', rect: [1003, 752, 1039, 966], h: 2.2, shelves: 6, back: 'E', seed: 41 },
  { id: 'display-low', type: 'cabinet', rect: [891, 923, 1003, 966], h: [0, 0.75], front: 'N', doors: 4, seamH: [0.04, 0.73], seamIn: 0 },
  { id: 'display-vase', type: 'vase', at: [930, 945], r: 0.06, h: [0.75, 0.95] },
  { id: 'mbed-door-plant', type: 'plant', at: [510, 455], potR: 0.17, potH: 0.42, leafR: 0.3, leafSY: 1.6, leafY: 0.9 },

  /* 公用衛浴與儲藏室 */
  { id: 'bath-vanity', type: 'vanity', rect: [609, 894.5, 670, 940], basin: [620, 900, 660, 934], faucet: [637, 895, 643, 902],
    faucetTop: 1.1, mirror: [610, 894.5, 670, 896], mirrorH: [1.05, 1.9] },
  { id: 'bath-wc', type: 'toilet', tank: [709, 894.5, 749, 900], tankH: [0.15, 1.1], bowl: [713, 900, 745, 950] },
  { id: 'bath-screen', type: 'glassScreen', rect: [605, 1033, 715, 1035], h: 2.0, frame: 'top' },
  { id: 'bath-head', type: 'showerHead', head: [725, 1110], from: [725, 1131], r: 0.1 },
  { id: 'storage-shelf', type: 'shelf', rect: [712, 1149, 758, 1266], h: 2.2, shelves: 5, back: 'E', seed: 51 },
  { id: 'storage-box-1', type: 'storageBox', rect: [654, 1220, 702, 1246], h: 0.3 },
  { id: 'storage-box-2', type: 'storageBox', rect: [656, 1250, 701, 1271], h: 0.25 },
  // 客房前走廊壁燈：裝在客房側牆面，上下洗牆
  { id: 'hall-sconce-1', type: 'sconce', at: [495.5, 1095], h: [1.6, 2.0] },
  { id: 'hall-sconce-2', type: 'sconce', at: [495.5, 1225], h: [1.6, 2.0] },

  /* 玄關 */
  { id: 'shoe-cabinet', type: 'shoeCabinet', rect: [930, 1158.5, 1039, 1185], niche: [0.95, 1.2], top: 2.35 },
];

/* ---------- 燈位 ---------- */

export interface NightLight {
  at: Pt;
  /** 安裝高度（m） */
  h: number;
  /** 光強（cd） */
  intensity: number;
  /** 截止距離（m） */
  distance: number;
}

export const lighting = {
  /** 天花板崁燈 */
  downlights: [
    [600, 230], [760, 230], [640, 560], [832, 560], [640, 790], [852, 820], [833, 1000], [833, 1100], [915, 1225],
    [230, 470], [370, 470], [170, 250], [380, 230], [200, 640], [380, 640], [200, 860], [380, 860], [230, 1210],
    [390, 1200], [685, 960], [685, 1080], [665, 1200], [945, 190],
  ] as readonly Pt[],
  /** 夜間 2700K 暖光點光源（目前沒有陰影） */
  night: [
    { at: [740, 570], h: 2.3, intensity: 22, distance: 5 },
    { at: [925, 650], h: 2.45, intensity: 12, distance: 3.5 },
    { at: [705, 597], h: 1.55, intensity: 7, distance: 3.5 },
    { at: [710, 324], h: 1.75, intensity: 10, distance: 3.5 },
    { at: [650, 200], h: 2.3, intensity: 9, distance: 3.5 },
    { at: [230, 430], h: 2.2, intensity: 11, distance: 3.5 },
    { at: [170, 230], h: 2.4, intensity: 6, distance: 2.4 },
    { at: [380, 220], h: 2.4, intensity: 6, distance: 2.4 },
    { at: [290, 720], h: 2.2, intensity: 11, distance: 3.5 },
    { at: [240, 1080], h: 2.2, intensity: 10, distance: 3.5 },
    { at: [685, 990], h: 2.4, intensity: 6, distance: 2.2 },
    { at: [833, 1050], h: 2.4, intensity: 6, distance: 3 },
    { at: [925, 1220], h: 2.4, intensity: 7, distance: 2.6 },
    { at: [945, 190], h: 2.4, intensity: 3, distance: 2.5 },
    { at: [705, 1210], h: 2.3, intensity: 3, distance: 1.6 },
    { at: [517, 1095], h: 1.85, intensity: 5, distance: 2.4 },
    { at: [517, 1225], h: 1.85, intensity: 5, distance: 2.4 },
  ] as readonly NightLight[],
  /** 天花板間接光（發光線條） */
  coves: [
    { id: 'living-sofa-side', rect: [500, 560, 506, 840] as Rect, h: [2.74, 2.76] as HRange },
    { id: 'tv-wall-wash', rect: [1023, 472, 1028, 743] as Rect, h: [2.74, 2.76] as HRange },
  ],
};
