import type { Pt } from './layout';

/*
 * 影片分鏡（約 75 秒、16:9、白天為主、最後客廳窗景轉夜景；畫面上只放空間名稱，片尾放法規示意與照片授權）。
 * 位置用平面 px（同 layout.ts），高度用公尺。運鏡依室內建築動畫與房地產影片的慣例（見 docs/storyboard.md）：
 *  - 遠景 20–28 mm、相機高 1.2–1.4 m、保持水平（look 的高度 = 相機高度），要上下構圖用固定的移軸（shift），不仰俯
 *  - 推軌 0.05–0.15 m/s、橫移 0.1–0.2 m/s，一個鏡頭移動 0.3–1 m；鏡頭內等速，只有片頭加速、片尾減速
 *  - 細節 35–50 mm、高 0.6–1.0 m、2–3 秒，可以略微俯仰
 *  - 同一空間內直接切，換空間或換時間用溶接（dissolve）
 */

/** 鏡頭位置：at 為相機平面位置、h 為高度；look 為注視點、lookH 省略時等於 h（水平） */
export interface CamPose {
  at: Pt;
  h: number;
  look: Pt;
  lookH?: number;
}

export interface Shot {
  id: string;
  /** 畫面上的空間名稱；同一空間接續的鏡頭省略 */
  caption?: string;
  /** 秒 */
  dur: number;
  light: 'day' | 'night';
  /** 焦距 mm（全片幅 36 mm 寬、16:9 畫面） */
  focal: number;
  from: CamPose;
  to: CamPose;
  /** 垂直移軸（畫面高的比例，正值往上看到更多天花板） */
  shift?: number;
  /** 從黑畫面淡入／淡出到黑（秒） */
  fadeIn?: number;
  fadeOut?: number;
  /** 鏡頭開始後幾秒轉成夜景 */
  toNight?: number;
  /** 速度：預設等速；in = 開頭加速（片頭）、out = 結尾減速停住（片尾） */
  ease?: 'in' | 'out';
  /** 從上一個鏡頭溶接進來（秒）；省略為直接切 */
  dissolve?: number;
  /** 分鏡表說明 */
  note: string;
}

export const SHOTS: readonly Shot[] = [
  { id: 'entry', caption: '玄關', dur: 5, light: 'day', focal: 24, fadeIn: 1, ease: 'in',
    from: { at: [870, 1150], h: 1.3, look: [900, 700] }, to: { at: [870, 1075], h: 1.3, look: [900, 690] },
    note: '揭示：從玄關進短走廊往北推進 0.75 m，兩側牆面滑出畫面，客廳、餐廚與陽台迎面打開' },
  { id: 'living-wide', caption: '客廳', dur: 7, light: 'day', focal: 24, dissolve: 0.6,
    from: { at: [690, 868], h: 1.3, look: [1040, 470] }, to: { at: [770, 868], h: 1.3, look: [1060, 500] },
    note: '遠景橫移 0.8 m：從沙發背後往東，沙發、茶几、電視牆、大窗一次帶到' },
  { id: 'living-detail', dur: 3, light: 'day', focal: 50,
    from: { at: [930, 700], h: 0.75, look: [700, 650], lookH: 0.62 }, to: { at: [930, 664], h: 0.75, look: [700, 640], lookH: 0.62 },
    note: '細節：低機位橫移，抱枕、bouclé 布紋與洞石茶几' },
  { id: 'living-reverse', dur: 5, light: 'day', focal: 24,
    from: { at: [620, 440], h: 1.3, look: [960, 820] }, to: { at: [690, 440], h: 1.3, look: [975, 815] },
    note: '反拍：從中島旁往東南橫移 0.7 m，沙發正面、單椅、展示櫃與掛畫' },
  { id: 'kitchen', caption: '餐廚', dur: 6, light: 'day', focal: 28, dissolve: 0.6,
    from: { at: [600, 540], h: 1.4, look: [680, 280] }, to: { at: [690, 540], h: 1.4, look: [750, 280] },
    note: '中景橫移 0.9 m：中島、三盞吊燈與吧台椅成一列，後方廚具與窗' },
  { id: 'kitchen-detail', dur: 3, light: 'day', focal: 50,
    from: { at: [745, 470], h: 1.45, look: [700, 324], lookH: 1.6 }, to: { at: [725, 470], h: 1.45, look: [690, 324], lookH: 1.6 },
    note: '細節：吊燈與窗光' },
  { id: 'mbed', caption: '主臥', dur: 7, light: 'day', focal: 24, dissolve: 0.6,
    from: { at: [400, 553], h: 1.3, look: [210, 345] }, to: { at: [375, 535], h: 1.3, look: [205, 350] },
    note: '從房門側緩推：床、睡枕、格柵牆與 Tolomeo 壁燈、窗' },
  { id: 'mbed-detail', dur: 3, light: 'day', focal: 35,
    from: { at: [415, 470], h: 1.0, look: [335, 320], lookH: 0.95 }, to: { at: [405, 468], h: 1.0, look: [333, 320], lookH: 0.95 },
    note: '細節：懸浮床頭櫃、壁燈與疊放的睡枕' },
  { id: 'mbath', caption: '主衛浴', dur: 5, light: 'day', focal: 24, dissolve: 0.6,
    from: { at: [445, 285], h: 1.4, look: [180, 175] }, to: { at: [420, 285], h: 1.4, look: [170, 170] },
    note: '從門口看向浴缸、淋浴隔屏與窗，乾濕分離' },
  { id: 'study', caption: '書房', dur: 5, light: 'day', focal: 24, dissolve: 0.6,
    from: { at: [470, 600], h: 1.3, look: [290, 760] }, to: { at: [450, 615], h: 1.3, look: [290, 770] },
    note: '從房門推進：書桌、Studio Display 與整面書牆' },
  { id: 'study-detail', dur: 3, light: 'day', focal: 35,
    from: { at: [365, 668], h: 1.05, look: [302, 742], lookH: 0.88 }, to: { at: [350, 672], h: 1.05, look: [302, 742], lookH: 0.88 },
    note: '細節：螢幕、鍵盤與滑鼠' },
  { id: 'guest', caption: '客房', dur: 5, light: 'day', focal: 24, dissolve: 0.6,
    from: { at: [405, 1235], h: 1.3, look: [235, 1000] }, to: { at: [390, 1215], h: 1.3, look: [230, 995] },
    note: '從房間角落看向床與床頭壁燈' },
  { id: 'balcony', caption: '陽台', dur: 5, light: 'day', focal: 28, dissolve: 0.6,
    from: { at: [860, 345], h: 1.4, look: [990, 160] }, to: { at: [885, 310], h: 1.4, look: [995, 150] },
    note: '從廚房往陽台拉門推進 0.43 m，橄欖樹與白天的城市景觀（接著收尾轉夜景）' },
  { id: 'night', caption: '客廳', dur: 10, light: 'day', focal: 24, toNight: 3.5, fadeOut: 1.5, ease: 'out', dissolve: 0.8,
    from: { at: [870, 690], h: 1.3, look: [1090, 400] }, to: { at: [885, 672], h: 1.3, look: [1092, 398] },
    note: '收尾：幾乎靜止的客廳遠景，燈一盞盞亮起、窗外轉為城市夜景' },
];

/**
 * 片尾字卡（黑底，秒）：台灣不動產廣告慣用的示意聲明（公平交易委員會不動產廣告處理原則；預售屋、成屋買賣契約
 * 不得約定「廣告僅供參考」，所以不只寫僅供參考），加上窗外照片的 CC BY 授權標示
 */
export const END_CARD = {
  dur: 6,
  lines: [
    '※本影片為 3D 電腦合成模擬示意畫面。',
    '※影片中之傢俱、家電、燈飾、窗簾、植栽及裝飾品等為空間情境示意，不在買賣範圍內；交屋標準以建材設備表及買賣契約為準。',
    '※窗外景觀為模擬，實際景觀依現場為準。',
    '窗外照片：曾成訓，CC BY 2.0，via Wikimedia Commons',
  ],
};
