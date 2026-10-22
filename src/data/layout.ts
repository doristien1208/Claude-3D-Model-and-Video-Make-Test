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
  floor: [70, 118, 1095, 1280] as Rect,
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
  { id: 'ext-N-balcony', a: [835, 118], b: [1095, 118], t: 12, openings: [
    { id: 'rail-balcony-N', s: 845, e: 1085, bot: 1.05, top: CEILING_H, kind: 'rail' },
  ] },
  { id: 'ext-W', a: [70, 125], b: [70, 1280], t: 12, openings: [
    { id: 'win-mbed', s: 390, e: 520, bot: 0.9, top: 2.3, kind: 'window' },
    { id: 'win-study', s: 625, e: 825, bot: 1.1, top: 2.3, kind: 'window' },
    { id: 'win-guest', s: 1000, e: 1140, bot: 0.9, top: 2.3, kind: 'window' },
  ] },
  { id: 'ext-S', a: [70, 1280], b: [1095, 1280], t: 12 },
  { id: 'ext-E', a: [1095, 118], b: [1095, 1280], t: 12, openings: [
    { id: 'rail-balcony-E', s: 132, e: 250, bot: 1.05, top: CEILING_H, kind: 'rail' },
    // 客廳窗原為 305–485，與電視格柵牆（470 起）重疊 15 cm，2026-10 確認縮短為 305–470
    { id: 'win-living', s: 305, e: 470, bot: 0.45, top: 2.5, kind: 'window' },
    { id: 'door-main', s: 1185, e: 1275, bot: 0, top: 2.15, kind: 'door' },
  ] },
  // 內牆
  { id: 'kitchen-balcony', a: [835, 125], b: [835, 260], t: 10 },
  { id: 'balcony-S', a: [835, 260], b: [1095, 260], t: 8, openings: [
    { id: 'door-balcony', s: 850, e: 1090, bot: 0, top: 2.3, kind: 'door' },
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
  { id: 'bath-N', a: [630, 889], b: [805, 889], t: 9 },
  { id: 'x600', a: [630, 889], b: [630, 1280], t: 8, openings: [
    { id: 'door-bath', s: 940, e: 1015, bot: 0, top: 2.1, kind: 'door' },
    { id: 'door-storage', s: 1145, e: 1220, bot: 0, top: 2.1, kind: 'door' },
  ] },
  { id: 'x775', a: [805, 889], b: [805, 1280], t: 9 },
  { id: 'bath-storage', a: [630, 1135], b: [805, 1135], t: 9 },
];

/** 實牆量體（不可使用，滿高） */
export const solidBlocks: readonly Rect[] = [
  [937, 966, 1095, 1127.5],
  // 南面 x 980–1089 挖進 26.5 cm 給玄關鞋櫃內嵌（2026-10 確認可動用此量體）
  [937, 1127.5, 980, 1154],
];

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
  // 儲藏室外掛拉門：門片在走廊側（x 621–625），開啟時往北滑到 y 1067–1146
  { id: 'storage', label: '儲藏室', kind: 'slide', opening: 'door-storage', side: 'W', slideTo: 'start', leafT: 4, gap: 1, overlap: 2, travel: 76, open: 1 },
  // 陽台兩片落地拉門（陽台加寬後開口 850–1090）：固定片 x 852–972，活動片全開時 x 862–982
  { id: 'balcony', label: '陽台', kind: 'slideGlass', opening: 'door-balcony', wallY: 260, fixed: [852, 972], active: [862, 982], trackEnd: 1090, h: 2.3, open: 1 },
];

/* ---------- 窗 ---------- */

/**
 * 窗型（2026-10 確認，依台灣建築技術規則 §45：可開窗扇下緣 ≥ 1.2 m；尺寸參考 YKK AP YRB-A 型錄斷面）。
 * slideOverFixed：下固定＋上雙扇橫拉（splitH 為可開扇下緣）
 * slideFixedSlide：雙橫拉真固定（兩側橫拉扇、中間固定，中間寬約為兩側各扇的 2 倍）
 * awning：整扇推射窗
 * fixed：一整片固定玻璃（細框）
 * sill：stone 人造石窗台凸出牆面 2 cm、左右各長出 2.5 cm；flush 與牆面平齊（廚房，龍頭離牆只有 1 cm）；tile 衛浴石材收邊。
 * curtainBox：窗簾盒沿牆的起訖（px），做滿整面牆。
 */
export interface WindowSpec {
  opening: string;
  type: 'slideOverFixed' | 'slideFixedSlide' | 'awning' | 'fixed';
  splitH?: number;
  frosted?: boolean;
  sill: 'stone' | 'flush' | 'tile';
  curtainBox?: { from: number; to: number };
}

export const windowSpecs: readonly WindowSpec[] = [
  { opening: 'win-mbath', type: 'awning', frosted: true, sill: 'tile' },
  { opening: 'win-kitchen', type: 'slideFixedSlide', sill: 'flush' },
  // 主臥窗簾盒從床頭格柵牆面（307.5）到主臥／書房隔間牆（560）
  { opening: 'win-mbed', type: 'slideOverFixed', splitH: 1.2, sill: 'stone', curtainBox: { from: 307.5, to: 560 } },
  { opening: 'win-study', type: 'slideFixedSlide', sill: 'stone', curtainBox: { from: 570, to: 935 } },
  { opening: 'win-guest', type: 'slideOverFixed', splitH: 1.2, sill: 'stone', curtainBox: { from: 945, to: 1274 } },
  // 客廳窗簾盒從陽台牆面（264）到電視格柵牆（470）
  { opening: 'win-living', type: 'fixed', sill: 'stone', curtainBox: { from: 264, to: 470 } },
];

/** 窗簾盒：雙層蛇形簾需要 25 cm 深；紗簾軌道離牆 8 cm、布簾軌道 17 cm；盒內前緣有往下照布簾的洗簾燈（離牆 21 cm） */
export const CURTAIN_BOX = { depth: 25, h0: 2.6, sheerTrack: 8, mainTrack: 17, washLight: 21 };

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
  { id: 'balcony', name: '小陽台', rect: [835, 118, 1095, 260] },
  { id: 'living', name: '客廳', rect: [490, 420, 1095, 910] },
  { id: 'hall-guest', name: '客房前走廊', rect: [490, 889, 630, 1280] },
  { id: 'bath', name: '公用衛浴', rect: [630, 889, 805, 1135] },
  { id: 'storage', name: '儲藏室', rect: [630, 1135, 805, 1280] },
  { id: 'hall-short', name: '短走廊', rect: [805, 905, 937, 1160] },
  { id: 'entry', name: '玄關', rect: [805, 1160, 1095, 1280] },
];

/** 房間跳轉的漫遊視點（px；yaw／pitch 為弧度，pitch 省略時用 −0.08） */
export interface Viewpoint {
  label: string;
  at: Pt;
  yaw: number;
  pitch?: number;
}
export const viewpoints: readonly Viewpoint[] = [
  { label: '玄關', at: [965, 1250], yaw: 0.36 },
  { label: '客廳', at: [980, 455], yaw: 2.45, pitch: -0.12 },
  { label: '餐廚', at: [1010, 475], yaw: 0.9 },
  { label: '主臥', at: [425, 530], yaw: 0.95 },
  { label: '主衛浴', at: [455, 260], yaw: 1.5, pitch: -0.18 },
  { label: '書房', at: [440, 895], yaw: 0.9 },
  { label: '客房', at: [375, 1235], yaw: 0.68 },
  { label: '公用衛浴', at: [665, 990], yaw: -1.2 },
];
/** 進入漫遊時的起始位置 */
export const walkStart: Viewpoint = { label: '起點', at: [965, 1250], yaw: 0.36, pitch: -0.05 };

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
  { id: 'bath', rect: [634, 893, 801, 1131], material: 'tileDark', h: 0.006 },
  { id: 'balcony', rect: [839, 122, 1090, 256], material: 'tileLight', h: 0.006 },
  { id: 'entry', rect: [809, 1158, 937, 1275], material: 'tileDark', h: 0.006 },
  // 鞋櫃內嵌後，實牆量體前方直到牆面都是玄關地坪
  { id: 'entry-E', rect: [937, 1154, 1090, 1275], material: 'tileDark', h: 0.006 },
  { id: 'mbath-wet', rect: [77, 212, 257, 295], material: 'wetFloor', h: 0.012 },
  { id: 'bath-shower', rect: [635, 1034, 801, 1131], material: 'stone', h: 0.03 },
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
  { rect: [635, 893.5, 801, 894.5], h: [0, CEILING_H] },
  { rect: [800, 894, 801, 1131], h: [0, CEILING_H] },
  { rect: [634, 1130, 801, 1131], h: [0, CEILING_H] },
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
  // 雙層蛇形簾（紗簾＋布簾）掛在窗簾盒內；sides 為收在哪一側，bottom 為下緣高度（預設落地，離地 1 cm）
  // span 為窗簾實際使用的軌道範圍（預設為整個窗簾盒）
  | { id: string; type: 'curtains'; label: string; window: string; sides: 'both' | 'start' | 'end'; bottom?: number; span?: readonly [number, number] }
  // 嵌入式浴缸：rect 為缸體外緣，surround 為石材包覆（補到牆面），h 為缸緣高；foot 為腳端（排水、出水口）方向
  | { id: string; type: 'bathtub'; rect: Rect; surround: Rect; h: number; foot: Side }
  // 牆面設備：at 為牆面上的點，facing 為朝向，h 為中心高
  | { id: string; type: 'bathSpout'; at: Pt; facing: Side; h: number }
  // 恆溫面板；hand 為手持花灑掛座（同一面牆）
  | { id: string; type: 'showerValve'; at: Pt; facing: Side; h: number; hand: { at: Pt; h: number } }
  // 方形頂噴：壁掛橫臂從 from（牆面）到 head；size 為邊長（m），h 為頂噴下緣高
  | { id: string; type: 'showerHead'; head: Pt; from: Pt; size: number; h: number }
  // 線型排水溝：h 為地坪面高
  | { id: string; type: 'linearDrain'; rect: Rect; h: number }
  | { id: string; type: 'wallShelf'; rect: Rect; levels: readonly number[] }
  // 固定玻璃隔屏（10 mm）：牆側在 rect 的較小座標端，自由端在較大座標端；base 為玻璃下緣高
  | { id: string; type: 'glassScreen'; rect: Rect; h: number; base: number }
  // 壁掛馬桶：tank 為隱藏水箱半牆，bowl 為馬桶平面外框，facing 為馬桶朝向
  | { id: string; type: 'toilet'; tank: Rect; tankH: HRange; tankMaterial: 'walnut' | 'tile'; bowl: Rect; facing: Side }
  // 懸浮洗手台：櫃體 0.5 m 起、石材檯面 0.85 m；basin 為面盆外框；faucet 為檯面龍頭或入牆龍頭（h 為出水管中心高）
  | { id: string; type: 'vanity'; rect: Rect; front: Side; fronts: readonly Front[]; basin: Rect; basinType: 'vessel' | 'undermount';
      faucet: { at: Pt; mount: 'deck' } | { at: Pt; mount: 'wall'; h: number }; mirror: Rect; mirrorH: HRange }
  // 毛巾桿：at 為牆面上桿子中點，len 為長度（px）；towels 為掛在桿上的毛巾（同一位置先列的在內層）
  | { id: string; type: 'towelBar'; at: Pt; facing: Side; len: number; h: number; towels?: readonly TowelHang[] }
  // 捲起的毛巾（三捲疊成金字塔）：axis 為捲軸方向
  | { id: string; type: 'towelRolls'; at: Pt; h: number; kind: TowelKind; axis: 'x' | 'y'; color: TowelColor }
  | { id: string; type: 'paperHolder'; at: Pt; facing: Side; h: number }
  // 托盤與小物：at 為中心，h 為放置面高
  | { id: string; type: 'tray'; rect: Rect; h: number }
  | { id: string; type: 'bathAccessory'; kind: 'pumpBottle' | 'tumbler' | 'succulent' | 'candle'; at: Pt; h: number }
  | { id: string; type: 'desk'; rect: Rect }
  | { id: string; type: 'monitor'; rect: Rect }
  | { id: string; type: 'officeChair'; at: Pt }
  | { id: string; type: 'deskLamp'; at: Pt }
  // 一般櫃體；front 為櫃門面向，doors 為門片數（畫分割線）
  // 系統櫃：櫃體外框 rect、高度 h、正面朝向 front；fronts 描述正面的門片分割；plinth 為內縮踢腳高（m）；
  // underGlow 為懸空櫃底部的間接燈
  | { id: string; type: 'cabinet'; rect: Rect; h: HRange; front: Side; fronts: readonly Front[]; plinth?: number; underGlow?: boolean }
  // 一字型廚具：rect 為下櫃；檯面在下櫃外加出邊；hoodBox 為包住抽油煙機、做到天花的煙機櫃
  | { id: string; type: 'kitchenRun'; rect: Rect; fronts: readonly Front[]; sink: Rect; hob: Rect; hood: Rect; hoodH0: number;
      hoodBox: Rect; backsplash: readonly { rect: Rect; h: HRange }[] }
  | { id: string; type: 'island'; rect: Rect; fronts: readonly Front[] }
  // 獨立式冰箱（法式對開＋抽屜，參考 Mitsubishi MR-B46F：600 × 699 × 1821 mm）
  | { id: string; type: 'fridge'; rect: Rect; h: number }
  | { id: string; type: 'barStool'; at: Pt }
  | { id: string; type: 'pendant'; at: Pt }
  | { id: string; type: 'plant'; at: Pt; potR: number; potH: number; leafR: number; leafSY: number; leafY: number }
  | { id: string; type: 'sofaL'; rect: Rect }
  | { id: string; type: 'coffeeTable'; at: Pt; r: number }
  | { id: string; type: 'armchair'; at: Pt; faceTo: Pt }
  | { id: string; type: 'floorLamp'; at: Pt }
  | { id: string; type: 'tv'; rect: Rect; h: HRange }
  | { id: string; type: 'vase'; at: Pt; r: number; h: HRange }
  | { id: string; type: 'storageBox'; rect: Rect; h: number }
  // 走廊壁燈；at 為牆面上的位置（x 為牆面）
  | { id: string; type: 'sconce'; at: Pt; h: HRange }
;

/**
 * 櫃門分割：沿櫃體正面 from–to 等分 n 欄、h 範圍內等分 rows 列（預設 1）。
 * kind：門、抽屜、開放格（shelves 片層板，led 為格內頂部燈條）或固定封板。
 * handle（參考 100室內設計 取手整理）：push 按壓、chamfer 開啟邊 45° 斜切、gola 上緣鋁擠取手溝、grip 從開放格伸手（門緣多 2 cm）。
 * 門縫 3 mm、門片 18 mm（系統櫃規格）。
 */
export interface Front {
  from: number;
  to: number;
  h: HRange;
  n: number;
  rows?: number;
  kind: 'door' | 'drawer' | 'open' | 'panel';
  handle?: 'push' | 'chamfer' | 'gola' | 'grip';
  shelves?: number;
  led?: boolean;
}

/**
 * 毛巾（尺寸依調查：MUJI、Costco 飯店浴巾 700 × 1400、毛巾 340 × 800）：
 * 浴巾縱向三折後對折掛（寬 233、垂 700），毛巾縱向對折後對折掛（寬 170、垂 400）；at 為沿桿子離中點的位置（px）。
 */
export type TowelKind = 'bath' | 'hand';
export type TowelColor = 'white' | 'oat';
export interface TowelHang {
  kind: TowelKind;
  at: number;
  color: TowelColor;
}

export type ItemType = Item['type'];

export const items: readonly Item[] = [
  /* 主臥 */
  { id: 'mbed-slat', type: 'slatWall', rect: [76, 304.5, 395, 307.5], led: { rect: [82, 307.5, 390, 309], h: [1.18, 1.2] } },
  { id: 'mbed-bed', type: 'bed', rect: [129.5, 308, 309.5, 509] },
  { id: 'mbed-ns-W', type: 'nightstand', rect: [80, 317, 124, 354] },
  { id: 'mbed-ns-E', type: 'nightstand', rect: [315, 317, 359, 354] },
  { id: 'mbed-lamp-W', type: 'wallLamp', rect: [96, 307.5, 108, 310], h: [1.3, 1.45] },
  { id: 'mbed-lamp-E', type: 'wallLamp', rect: [331, 307.5, 343, 310], h: [1.3, 1.45] },
  // 主臥衣櫃（2026-10 確認）：取代原本的開放書櫃，121 × 60，做到天花；3 扇門＋上方棉被櫃
  { id: 'mbed-wardrobe', type: 'cabinet', rect: [424.5, 366, 484.5, 487], h: [0, 2.8], front: 'W', plinth: 0.08, fronts: [
    { from: 366, to: 487, h: [0.08, 2.4], n: 3, kind: 'door', handle: 'chamfer' },
    { from: 366, to: 487, h: [2.4, 2.8], n: 3, kind: 'door', handle: 'push' },
  ] },
  { id: 'mbed-rug', type: 'rug', rect: [110, 370, 345, 556], material: 'rug2' },
  { id: 'mbed-curtains', type: 'curtains', label: '主臥', window: 'win-mbed', sides: 'both' },

  /* 主衛浴：西側濕區（浴缸＋淋浴）｜玻璃隔屏｜東側乾區（馬桶、洗手台）。設備依調查（2026-10 確認） */
  // 嵌入式壓克力浴缸 1700 × 750（缸體參考 Duravit Starck 嵌入式），石材包覆到牆面；靠背在東、腳端在西；不放水
  { id: 'mbath-tub', type: 'bathtub', rect: [80, 135, 250, 210], surround: [76, 131, 252, 212], h: 0.56, foot: 'W' },
  // 入牆出水口（hansgrohe Tecturis E，出水 210）
  { id: 'mbath-spout', type: 'bathSpout', at: [77, 172.5], facing: 'E', h: 0.7 },
  // 入牆恆溫面板（hansgrohe ShowerSelect Comfort E，155 × 155）＋手持花灑掛座
  { id: 'mbath-valve', type: 'showerValve', at: [77, 256], facing: 'E', h: 1.1, hand: { at: [77, 232], h: 1.22 } },
  // 方形頂噴（hansgrohe Pulsify E 260），壁掛橫臂，下緣 2.2 m（Ronal 建議 2.1–2.2 m）
  { id: 'mbath-head', type: 'showerHead', head: [110, 256], from: [77, 256], size: 0.26, h: 2.2 },
  // 線型排水溝（Geberit CleanLine20，可見寬 43 mm）
  { id: 'mbath-drain', type: 'linearDrain', rect: [78, 216, 82.3, 291], h: 0.012 },
  { id: 'mbath-towel-shelf', type: 'wallShelf', rect: [77, 280, 92, 294], levels: [1.25, 0.9] },
  { id: 'mbath-shampoo', type: 'bathAccessory', kind: 'pumpBottle', at: [84.5, 287], h: 1.27 },
  { id: 'mbath-bodywash', type: 'bathAccessory', kind: 'pumpBottle', at: [84.5, 287], h: 0.92 },
  { id: 'mbath-candle', type: 'bathAccessory', kind: 'candle', at: [236, 139], h: 0.56 },
  // 10 mm 超白玻璃：上框＋外側立框 20 mm、牆側 15 × 15 U 槽，不做下框
  { id: 'mbath-screen', type: 'glassScreen', rect: [259, 131, 260, 225], h: 2.1, base: 0.006 },
  // 壁掛無邊圈馬桶（TOTO CW822REATW：380 × 540 × 335）、胡桃木水箱半牆、霧黑沖水板
  { id: 'mbath-wc', type: 'toilet', tank: [280, 131, 336, 149], tankH: [0, 1.1], tankMaterial: 'walnut', bowl: [289, 149, 327, 203], facing: 'S' },
  { id: 'mbath-rolls', type: 'towelRolls', at: [308, 140], h: 1.1, kind: 'hand', axis: 'y', color: 'white' },
  // 馬桶兩側沒有牆：衛生紙架裝在洗手台西側板（高 0.66 m）
  { id: 'mbath-paper', type: 'paperHolder', at: [350, 172], facing: 'W', h: 0.66 },
  // 桌上型薄邊方盆 550 × 380 × 100（參考 TOTO LW1735、凱撒 LF5342）＋檯面高腳龍頭（hansgrohe Talis E 240）
  { id: 'mbath-vanity', type: 'vanity', rect: [350, 131.5, 470, 180], front: 'S',
    fronts: [{ from: 350, to: 470, h: [0.5, 0.83], n: 2, kind: 'drawer', handle: 'push' }],
    basin: [382.5, 140.5, 437.5, 178.5], basinType: 'vessel', faucet: { at: [410, 136.5], mount: 'deck' },
    mirror: [350, 131.5, 470, 133], mirrorH: [1.05, 1.95] },
  { id: 'mbath-tray', type: 'tray', rect: [449, 143, 462, 171], h: 0.85 },
  { id: 'mbath-soap', type: 'bathAccessory', kind: 'pumpBottle', at: [455.5, 149], h: 0.865 },
  { id: 'mbath-cup', type: 'bathAccessory', kind: 'tumbler', at: [455.5, 158.5], h: 0.865 },
  { id: 'mbath-succulent', type: 'bathAccessory', kind: 'succulent', at: [455.5, 166.5], h: 0.865 },
  // 60 cm 毛巾桿 1.2 m：兩條白浴巾＋兩條燕麥色毛巾疊掛。原本在東牆（y 190–250），正好在門片開啟的位置
  // （門只能開到 80.75° 且會擋住毛巾），移到南牆淋浴出口旁
  { id: 'mbath-towel-bar', type: 'towelBar', at: [305, 294.5], facing: 'N', len: 60, h: 1.2, towels: [
    { kind: 'bath', at: -12, color: 'white' }, { kind: 'bath', at: 12, color: 'white' },
    { kind: 'hand', at: -12, color: 'oat' }, { kind: 'hand', at: 12, color: 'oat' },
  ] },

  /* 書房 */
  { id: 'study-low-shelf', type: 'shelf', rect: [76, 625, 115, 825], h: 1.0, shelves: 2, back: 'W', seed: 31 },
  { id: 'study-shelf', type: 'shelf', rect: [178, 900, 428, 935], h: 2.2, shelves: 6, back: 'S', seed: 61 },
  // 窗下有 1.0 m 高的低書櫃：短簾，下緣停在書櫃上方 1.5 cm
  { id: 'study-curtains', type: 'curtains', label: '書房', window: 'win-study', sides: 'both', bottom: 1.015 },
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
  // 客房衣櫃：5 扇門（約 47 cm，系統櫃常見寬度）＋上方 40 cm 棉被櫃做到天花，門縫對齊
  { id: 'guest-wardrobe', type: 'cabinet', rect: [425, 1035, 485, 1270], h: [0, 2.8], front: 'W', plinth: 0.08, fronts: [
    { from: 1035, to: 1270, h: [0.08, 2.4], n: 5, kind: 'door', handle: 'chamfer' },
    { from: 1035, to: 1270, h: [2.4, 2.8], n: 5, kind: 'door', handle: 'push' },
  ] },
  { id: 'guest-rug', type: 'rug', rect: [140, 1080, 340, 1240], material: 'rug2' },
  { id: 'guest-curtains', type: 'curtains', label: '客房', window: 'win-guest', sides: 'both' },

  /* 廚房與中島 */
  // 冰箱放牆面西端（2026-10 確認）：會遮住廚房窗西側約 8.5 cm
  { id: 'fridge', type: 'fridge', rect: [496.5, 131, 556.5, 200.9], h: 1.821 },
  // 一字型檯面縮短為 x 559–793（水槽、爐台尺寸維持）；抽油煙機收進到天花的煙機櫃；鋁擠取手溝
  { id: 'kitchen-run', type: 'kitchenRun', rect: [559, 131, 793, 191], fronts: [
    { from: 559, to: 715, h: [0.1, 0.86], n: 4, kind: 'door', handle: 'gola' },
    { from: 715, to: 793, h: [0.1, 0.86], n: 1, rows: 3, kind: 'drawer', handle: 'gola' },
  ], sink: [600, 140, 650, 180], hob: [728, 140, 780, 184], hood: [724, 131, 786, 175], hoodH0: 2.05,
  hoodBox: [714, 131, 796, 175],
  backsplash: [{ rect: [559, 131, 712, 132], h: [0.9, 1.035] }, { rect: [712, 131, 796, 132], h: [0.9, 2.05] }] },
  // 東端高櫃往中島方向加深（2026-10 確認）：134 × 34，門朝西開向工作走道；靠檯面那段在檯面上方做開放格
  { id: 'kitchen-tall', type: 'cabinet', rect: [796, 131, 830, 265], h: [0, 2.8], front: 'W', plinth: 0.08, fronts: [
    { from: 131, to: 193, h: [0, 0.92], n: 1, kind: 'panel' },
    { from: 131, to: 193, h: [0.92, 2.05], n: 1, kind: 'open', shelves: 2, led: true },
    { from: 131, to: 193, h: [2.05, 2.8], n: 1, kind: 'door', handle: 'push' },
    { from: 193, to: 265, h: [0.08, 2.4], n: 2, kind: 'door', handle: 'push' },
    { from: 193, to: 265, h: [2.4, 2.8], n: 2, kind: 'door', handle: 'push' },
  ] },
  { id: 'island', type: 'island', rect: [580, 270, 840, 378], fronts: [
    { from: 587, to: 833, h: [0.1, 0.86], n: 6, kind: 'door', handle: 'gola' },
  ] },
  { id: 'stool-1', type: 'barStool', at: [650, 394] },
  { id: 'stool-2', type: 'barStool', at: [731, 394] },
  { id: 'stool-3', type: 'barStool', at: [811, 394] },
  { id: 'pendant-1', type: 'pendant', at: [645, 324] },
  { id: 'pendant-2', type: 'pendant', at: [710, 324] },
  { id: 'pendant-3', type: 'pendant', at: [775, 324] },

  /* 小陽台 */
  { id: 'balcony-plant', type: 'plant', at: [1005, 192], potR: 0.22, potH: 0.45, leafR: 0.42, leafSY: 1.25, leafY: 0.95 },

  /* 客廳 */
  { id: 'living-rug', type: 'rug', rect: [618, 568, 976, 838], material: 'rug', inner: [624, 576, 970, 830] },
  // L 型沙發：長邊 x 622–716（椅背朝西），短邊 x 716–829、y 753–822（椅背朝南）；房子加寬後往東移 30 cm，
  // 椅背到書房門那面牆的走道 126.5 cm
  { id: 'sofa', type: 'sofaL', rect: [622, 589, 829, 822] },
  { id: 'coffee-table', type: 'coffeeTable', at: [838, 676], r: 0.45 },
  { id: 'armchair', type: 'armchair', at: [942, 808.5], faceTo: [838, 676] },
  { id: 'floor-lamp', type: 'floorLamp', at: [735, 597] },
  { id: 'tv-slat', type: 'slatWall', rect: [1081, 470, 1089, 745] },
  // 客廳窗南端緊貼電視牆，窗簾只能往北收；布簾收起時會擋住約 20 cm 的玻璃（已確認）
  // 軌道從 y 268 起，避開陽台拉門的門框（到 y 267）
  { id: 'living-curtains', type: 'curtains', label: '客廳', window: 'win-living', sides: 'start', span: [268, 468] },
  // 懸浮電視櫃：按壓開門、底部間接光
  { id: 'tv-cabinet', type: 'cabinet', rect: [1037, 520, 1081, 710], h: [0.18, 0.5], front: 'W', underGlow: true, fronts: [
    { from: 520, to: 710, h: [0.18, 0.5], n: 4, kind: 'door', handle: 'push' },
  ] },
  { id: 'tv', type: 'tv', rect: [1077, 549, 1080.5, 692], h: [0.95, 1.76] },
  // 展示角：高書櫃貼東牆，矮櫃貼實牆，接成 L 型
  { id: 'display-shelf', type: 'shelf', rect: [1053, 752, 1089, 966], h: 2.2, shelves: 6, back: 'E', seed: 41 },
  { id: 'display-low', type: 'cabinet', rect: [941, 923, 1053, 966], h: [0, 0.75], front: 'N', plinth: 0.04, fronts: [
    { from: 941, to: 1053, h: [0.04, 0.75], n: 4, kind: 'door', handle: 'push' },
  ] },
  { id: 'display-vase', type: 'vase', at: [980, 945], r: 0.06, h: [0.75, 0.95] },
  { id: 'mbed-door-plant', type: 'plant', at: [510, 455], potR: 0.17, potH: 0.42, leafR: 0.3, leafSY: 1.6, leafY: 0.9 },

  /* 公用衛浴與儲藏室 */
  // 61 cm 洗手台檯面太淺放不下檯面龍頭：下嵌盆 460 × 390（凱撒 L5115）＋入牆龍頭（hansgrohe Talis E 壁式，出水 225）
  { id: 'bath-vanity', type: 'vanity', rect: [639, 894.5, 700, 940], front: 'S',
    fronts: [{ from: 639, to: 700, h: [0.5, 0.83], n: 1, kind: 'door', handle: 'push' }],
    basin: [646.5, 897.5, 692.5, 936.5], basinType: 'undermount', faucet: { at: [669.5, 894.5], mount: 'wall', h: 0.99 },
    mirror: [640, 894.5, 700, 896], mirrorH: [1.05, 1.9] },
  { id: 'bath-soap', type: 'bathAccessory', kind: 'pumpBottle', at: [695, 905], h: 0.85 },
  // 洗手台旁西牆只有 46 cm 又被門切斷，毛巾桿改裝在鏡子與水箱半牆之間的北牆（30 cm）
  { id: 'bath-towel-bar', type: 'towelBar', at: [719.5, 894.5], facing: 'S', len: 30, h: 1.2, towels: [{ kind: 'hand', at: 0, color: 'oat' }] },
  // 隱藏水箱半牆：薄型框架（Geberit Duofix 8 cm 水箱）＋磁磚共 11 cm，馬桶南移 4.5 cm（2026-10 確認）
  { id: 'bath-wc', type: 'toilet', tank: [739, 894.5, 779, 904.5], tankH: [0, 1.1], tankMaterial: 'tile', bowl: [740, 904.5, 778, 958.5], facing: 'S' },
  { id: 'bath-paper', type: 'paperHolder', at: [800, 980], facing: 'W', h: 0.66 },
  { id: 'bath-screen', type: 'glassScreen', rect: [635, 1034, 745, 1035], h: 2.0, base: 0.03 },
  { id: 'bath-valve', type: 'showerValve', at: [755, 1130], facing: 'N', h: 1.1, hand: { at: [778, 1130], h: 1.22 } },
  { id: 'bath-head', type: 'showerHead', head: [755, 1110], from: [755, 1130], size: 0.26, h: 2.2 },
  { id: 'bath-drain', type: 'linearDrain', rect: [673, 1124.5, 763, 1128.8], h: 0.03 },
  { id: 'storage-shelf', type: 'shelf', rect: [742, 1149, 788, 1266], h: 2.2, shelves: 5, back: 'E', seed: 51 },
  { id: 'storage-box-1', type: 'storageBox', rect: [684, 1220, 732, 1246], h: 0.3 },
  { id: 'storage-box-2', type: 'storageBox', rect: [686, 1250, 731, 1271], h: 0.25 },
  // 客房前走廊壁燈：裝在客房側牆面，上下洗牆
  { id: 'hall-sconce-1', type: 'sconce', at: [495.5, 1095], h: [1.6, 2.0] },
  { id: 'hall-sconce-2', type: 'sconce', at: [495.5, 1225], h: [1.6, 2.0] },

  /* 玄關 */
  // 玄關鞋櫃：嵌進實牆量體、正面與牆面齊平（2026-10 確認）；懸空 15 cm＋底部間接光；中段開放層格放鑰匙，
  // 上下櫃門從層格伸手開（深 26.5 cm 只放得下斜放鞋架）；上櫃做到天花
  { id: 'shoe-cabinet', type: 'cabinet', rect: [980, 1127.5, 1089, 1154], h: [0.15, 2.8], front: 'S', underGlow: true, fronts: [
    { from: 980, to: 1089, h: [0.15, 0.95], n: 3, kind: 'door', handle: 'grip' },
    { from: 980, to: 1089, h: [0.95, 1.2], n: 1, kind: 'open', led: true },
    { from: 980, to: 1089, h: [1.2, 2.8], n: 3, kind: 'door', handle: 'grip' },
  ] },
];

/* ---------- 燈位 ---------- */

export type DownlightKind = 'general' | 'accent' | 'wet';
/** 崁燈：at 為位置；aim 為重點燈的投射點 [x, y, 高度]（省略則垂直往下） */
export interface Downlight {
  at: Pt;
  kind: DownlightKind;
  aim?: readonly [number, number, number];
}

/**
 * 崁燈規格（2700K、Ra 90、白色深杯，遮光角約 30°）；lm 為額定流明，cdPerLm 為正下方光強／流明，beam 為光束角（半強度，度），
 * cutout 為開孔（m）：
 *  general：φ100 擴散型約 700 lm，0.51 cd/lm、光束角約 100°（DAIKO 實測；舞光 波爾 100°；KOIZUMI AD7251W27 735 lm 2700K）
 *  accent：36° 窄光束 810 lm，1.6 cd/lm（舞光 波士 9.5 cm；Philips 36° 實測 1.65 cd/lm）
 *  wet：浴室與陽台用 IP44，950 lm、40°（Panasonic NNP73185031；cd/lm 依 36°、60° 實測內插）
 */
export const DOWNLIGHT = {
  general: { lm: 700, cdPerLm: 0.51, beam: 100, cutout: 0.1 },
  accent: { lm: 810, cdPerLm: 1.6, beam: 36, cutout: 0.095 },
  wet: { lm: 950, cdPerLm: 1.4, beam: 40, cutout: 0.065 },
} as const;
/** 深杯深度（m）：發光面在天花板上方 3.5 cm */
export const DOWNLIGHT_RECESS = 0.035;

export const lighting = {
  /**
   * 天花板崁燈（2026-10 依調查調整）：不放在沙發、床鋪、坐著的人頭頂正上方；廚房在檯面前緣上方照工作面；
   * 書房在書桌前緣；靠牆的離牆 30–40 cm 洗牆；展示書櫃前 30 cm 兩盞重點燈打向櫃面
   */
  downlights: [
    // 廚房檯面、客廳
    { at: [610, 190], kind: 'accent' }, { at: [750, 190], kind: 'accent' },
    { at: [670, 560], kind: 'general' }, { at: [872, 560], kind: 'general' }, { at: [770, 855], kind: 'general' }, { at: [902, 820], kind: 'general' },
    { at: [1023, 805], kind: 'accent', aim: [1053, 805, 1.2] }, { at: [1023, 913], kind: 'accent', aim: [1053, 913, 1.2] },
    // 短走廊、玄關
    { at: [873, 1000], kind: 'general' }, { at: [873, 1100], kind: 'general' }, { at: [965, 1225], kind: 'general' },
    // 主臥、主衛浴
    { at: [220, 535], kind: 'general' }, { at: [370, 470], kind: 'general' }, { at: [170, 250], kind: 'wet' }, { at: [380, 230], kind: 'wet' },
    // 書房、客房
    { at: [230, 715], kind: 'general' }, { at: [375, 715], kind: 'general' }, { at: [200, 860], kind: 'general' }, { at: [380, 860], kind: 'general' },
    { at: [230, 1210], kind: 'general' }, { at: [390, 1200], kind: 'general' },
    // 公衛、儲藏室、陽台
    { at: [715, 960], kind: 'wet' }, { at: [715, 1080], kind: 'wet' }, { at: [695, 1200], kind: 'general' }, { at: [970, 190], kind: 'wet' },
  ] as readonly Downlight[],
  /** 燈具流明（2700K）：吊燈 Flos IC S1 用 E14 LED、落地燈 IKEA 建議燈泡、Artemide Tolomeo Micro 壁燈與檯燈、走廊壁燈 KOIZUMI AB52233 */
  lamps: { pendant: 700, floorLamp: 470, wallLamp: 620, deskLamp: 620, sconce: 505 },
  /** 燈條每公尺流明：燈溝 COB 1020（Norlux 2700K 10 W/m）、洗簾約 1000（估計）、櫃下與鏡燈 450（4.8 W/m） */
  strips: { cove: 1020, curtain: 1000, under: 450, mirror: 450 },
};

/* ---------- 天花板：局部降板與間接燈（2026-10 確認：中央維持 2.80 m，降板下緣 2.60 m 與窗簾盒對齊） ---------- */

/** 降板下緣高度（m） */
export const BULKHEAD_H = 2.6;

/**
 * 牆面以 face（牆面座標，px）＋ hor（牆沿 x 方向）＋ into（往室內的方向）描述，沿牆範圍 from–to。
 * trough：跌級燈溝，降板寬 width，內緣擋光板比板面高 3 cm，燈溝開口約 15 cm；cap 為需要封板的自由端。
 * washSlot：洗牆燈溝，降板總深 depth（與窗簾盒前緣對齊），貼牆留 slot 寬的縫，燈光沿 litFace（被照的面）往下打。
 */
export type Cove =
  | { id: string; kind: 'trough'; face: number; hor: boolean; into: 1 | -1; from: number; to: number; width: number; cap?: 'from' | 'to' }
  | { id: string; kind: 'washSlot'; face: number; hor: boolean; into: 1 | -1; from: number; to: number; depth: number; slot: number;
      litFace: number; cap?: 'from' | 'to' };

export const coves: readonly Cove[] = [
  // 客廳沙發側（x490 牆東面），到公衛北牆為止；北端是自由端
  { id: 'living-sofa', kind: 'trough', face: 495.5, hor: false, into: 1, from: 540, to: 884.5, width: 30, cap: 'from' },
  // 電視木格柵牆：從客廳窗簾盒接過來，到展示書櫃為止；格柵面在 x 1081
  { id: 'tv-wall', kind: 'washSlot', face: 1089, hor: false, into: -1, from: 470, to: 752, depth: 25, slot: 10, litFace: 1081, cap: 'to' },
];

/* ---------- 環境反射探針 ---------- */

/**
 * 每區在中央 1.4 m 高從模型本身拍一張 360° 反射圖（PMREM），區內的物件用它當環境反射，
 * 並以區域外框做箱型投影修正。開放式客餐廚合成一區；外框以室內牆面為界（px）。
 * probe 可指定拍攝位置：箱型投影假設環境都在外框牆面上，探針太靠近物件時，物件會被投影成一大塊（例如玻璃隔屏上映出馬桶的暗影）。
 */
export const probeZones: readonly { id: string; rect: Rect; probe?: Pt }[] = [
  { id: 'great', rect: [495.5, 131, 1089, 884.5] },
  { id: 'balcony', rect: [839, 124, 1089, 256] },
  // 區域中心離馬桶只有 10 cm，改到乾區中央
  { id: 'mbath', rect: [76, 131, 484.5, 295.5], probe: [420, 240] },
  { id: 'mbed', rect: [76, 304.5, 484.5, 560] },
  { id: 'study', rect: [76, 570, 484.5, 935] },
  { id: 'guest', rect: [76, 945, 484.5, 1274] },
  { id: 'hall-guest', rect: [495.5, 889, 626, 1274] },
  { id: 'bath', rect: [634, 893.5, 800.5, 1130.5] },
  { id: 'storage', rect: [634, 1139.5, 800.5, 1274] },
  { id: 'entry', rect: [809.5, 905, 1089, 1274] },
];

/* ---------- 開關插座與牆面設備 ---------- */

/**
 * 參考 Panasonic RISNA（橫式 120 × 70 × 9 mm）；高度依屋內線路裝置規則與設計師慣例：
 * 門邊開關 1.2 m、離門框 15–20 cm、在門把側；一般插座 0.3 m；床頭 0.6 m；廚房檯面 1.1 m（離水槽、爐台 ≥ 30 cm）；
 * 浴室吹風機插座 1.15 m、離龍頭 ≥ 60 cm、加防水蓋；對講機 1.45 m。
 * at 為裝在牆面上的位置（px），facing 為面板朝向；finish：灰泥牆用霧白、木作與櫃體上用深灰。
 */
export interface WallDevice {
  id: string;
  kind: 'switch' | 'socket' | 'socketUsb' | 'socketWet' | 'floorSocket' | 'intercom';
  gangs?: number;
  at: Pt;
  facing: Side;
  h: number;
  finish: 'white' | 'dark';
}

export const wallDevices: readonly WallDevice[] = [
  // 主臥：門把側到轉角只有 2 cm，開關改在南牆、離轉角 18 cm
  { id: 'mbed-sw', kind: 'switch', gangs: 2, at: [466.5, 560], facing: 'N', h: 1.2, finish: 'white' },
  { id: 'mbed-bed-W', kind: 'socketUsb', at: [102, 307.5], facing: 'S', h: 0.6, finish: 'dark' },
  { id: 'mbed-bed-E', kind: 'socketUsb', at: [337, 307.5], facing: 'S', h: 0.6, finish: 'dark' },
  { id: 'mbed-low', kind: 'socket', at: [420, 560], facing: 'N', h: 0.3, finish: 'white' },
  // 主衛浴：臥室側門把旁只剩 5 cm，開關（燈、暖風機、排風）裝在床頭格柵牆上、離門洞 15 cm
  { id: 'mbath-sw', kind: 'switch', gangs: 3, at: [385, 307.5], facing: 'S', h: 1.2, finish: 'dark' },
  { id: 'mbath-dryer', kind: 'socketWet', at: [484, 165], facing: 'W', h: 1.15, finish: 'white' },
  { id: 'mbath-bidet', kind: 'socket', at: [362, 132], facing: 'S', h: 0.3, finish: 'white' },
  // 書房：書桌不靠牆，用地板插座
  { id: 'study-sw', kind: 'switch', gangs: 2, at: [484.5, 667], facing: 'W', h: 1.2, finish: 'white' },
  { id: 'study-floor', kind: 'floorSocket', at: [300, 745], facing: 'N', h: 0, finish: 'dark' },
  { id: 'study-low', kind: 'socket', at: [484.5, 720], facing: 'W', h: 0.3, finish: 'white' },
  // 客房：門把側只有 8 cm 就碰到衣櫃、鉸鏈側會被門片擋住，開關裝在衣櫃靠門的側板上
  { id: 'guest-sw', kind: 'switch', gangs: 2, at: [455, 1035], facing: 'N', h: 1.2, finish: 'dark' },
  { id: 'guest-bed-W', kind: 'socketUsb', at: [129, 945], facing: 'S', h: 0.6, finish: 'white' },
  { id: 'guest-bed-E', kind: 'socketUsb', at: [346, 945], facing: 'S', h: 0.6, finish: 'white' },
  { id: 'guest-low', kind: 'socket', at: [220, 1274], facing: 'N', h: 0.3, finish: 'white' },
  // 玄關：大門門把側整面是鞋櫃（正面是櫃門），開關（玄關、客廳、餐廳、間接燈）與對講機改裝在鞋櫃旁露出的實牆量體南面
  // （x 937–980），離大門約 1.2 m
  { id: 'entry-sw-1', kind: 'switch', gangs: 3, at: [952, 1154], facing: 'S', h: 1.2, finish: 'white' },
  { id: 'entry-sw-2', kind: 'switch', gangs: 3, at: [966, 1154], facing: 'S', h: 1.2, finish: 'white' },
  { id: 'entry-intercom', kind: 'intercom', at: [959, 1154], facing: 'S', h: 1.45, finish: 'white' },
  { id: 'entry-low', kind: 'socket', at: [893, 1274], facing: 'N', h: 0.3, finish: 'white' },
  // 客廳：落地燈插座
  { id: 'living-low', kind: 'socket', at: [495.5, 700], facing: 'E', h: 0.3, finish: 'white' },
  // 廚房、餐廳：開關（吊燈、廚房燈、陽台燈）在主臥門北側牆上；檯面插座避開窗與水槽、爐台
  { id: 'kitchen-sw', kind: 'switch', gangs: 3, at: [495.5, 420], facing: 'E', h: 1.2, finish: 'white' },
  // 冰箱移到西端後，檯面左側插座被冰箱擋住，只留窗下擋水牆這一個（裝在石材擋水板上）
  { id: 'kitchen-splash', kind: 'socket', at: [690, 132], facing: 'S', h: 0.97, finish: 'white' },
  { id: 'island', kind: 'socket', at: [833, 324], facing: 'E', h: 0.6, finish: 'dark' },
  // 客房前走廊、公衛、儲藏室
  { id: 'hall-sw', kind: 'switch', gangs: 1, at: [626, 905], facing: 'W', h: 1.2, finish: 'white' },
  { id: 'bath-sw', kind: 'switch', gangs: 2, at: [626, 1030], facing: 'W', h: 1.2, finish: 'white' },
  { id: 'bath-dryer', kind: 'socketWet', at: [800, 915], facing: 'W', h: 1.15, finish: 'white' },
  { id: 'bath-bidet', kind: 'socket', at: [800, 935], facing: 'W', h: 0.3, finish: 'white' },
  { id: 'storage-sw', kind: 'switch', gangs: 1, at: [626, 1240], facing: 'W', h: 1.2, finish: 'white' },
];
