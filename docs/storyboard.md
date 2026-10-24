# 影片分鏡（草稿 v1，2026-10-25）

售屋導覽短片：約 75 秒、16:9、白天為主、最後客廳轉夜景；畫面上只放空間名稱（使用者決定），片頭從黑畫面淡入，片尾放示意聲明與照片授權。

- 鏡頭資料：`src/data/shots.ts`（位置用平面 px、高度 m；改這裡就會改影片）
- 預覽：模型頁面下方「影片分鏡」，空白鍵播放／暫停、← → 切換鏡頭、Esc 返回。預覽是即時畫面，鏡頭之間先直接切；
  白天亮度、景深、動態模糊、溶接、日夜漸變在之後的輸出階段處理

## 分鏡表

| # | 時間 | 字卡 | 鏡頭 | 焦距／高 | 運鏡 | 轉場 |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:05 | 玄關 | 揭示：從玄關進短走廊往北，兩側牆面滑出畫面，客廳、餐廚與陽台迎面打開 | 24 mm／1.3 m | 推 0.75 m（片頭加速） | 黑畫面淡入 1 秒 |
| 2 | 0:05–0:12 | 客廳 | 遠景：從沙發背後往東，沙發、茶几、電視牆、大窗 | 24／1.3 | 橫移 0.8 m | 溶接 |
| 3 | 0:12–0:15 | | 細節：抱枕、bouclé 布紋、洞石茶几 | 50／0.75 | 橫移 0.36 m | 切 |
| 4 | 0:15–0:20 | | 反拍：從中島旁看沙發正面、單椅、展示櫃、掛畫 | 24／1.3 | 橫移 0.7 m | 切 |
| 5 | 0:20–0:26 | 餐廚 | 中景：中島、三盞吊燈、吧台椅、廚具與窗 | 28／1.4 | 橫移 0.9 m | 溶接 |
| 6 | 0:26–0:29 | | 細節：吊燈與窗外 | 50／1.45 | 橫移 0.2 m | 切 |
| 7 | 0:29–0:36 | 主臥 | 從房門側：床、睡枕、格柵牆、壁燈、窗 | 24／1.3 | 推 0.3 m | 溶接 |
| 8 | 0:36–0:39 | | 細節：懸浮床頭櫃、壁燈、睡枕 | 35／1.0 | 橫移 0.1 m | 切 |
| 9 | 0:39–0:44 | 主衛浴 | 從門口：浴缸、淋浴隔屏、窗 | 24／1.4 | 橫移 0.25 m | 溶接 |
| 10 | 0:44–0:49 | 書房 | 從房門：書桌、螢幕、書牆、窗 | 24／1.3 | 推 0.25 m | 溶接 |
| 11 | 0:49–0:52 | | 細節：螢幕、鍵盤、滑鼠 | 35／1.05 | 橫移 0.15 m | 切 |
| 12 | 0:52–0:57 | 客房 | 從角落：床、床頭壁燈、窗 | 24／1.3 | 推 0.25 m | 溶接 |
| 13 | 0:57–1:02 | 陽台 | 從廚房往陽台拉門：橄欖樹與白天的城市景觀 | 28／1.4 | 推 0.43 m | 溶接 |
| 14 | 1:02–1:12 | 客廳 | 收尾：客廳往窗的遠景，幾乎靜止；第 3.5 秒起轉夜景、燈亮起、窗外城市夜景 | 24／1.3 | 推 0.23 m（片尾減速） | 溶接，最後 1.5 秒淡出到黑 |
| — | 1:12–1:18 | | 片尾字卡（黑底） | | | |

- 表上時間未扣溶接重疊（9 處 × 0.6–0.8 秒）；實際成片約 72 秒
- 時間分配：客餐廚 24 秒（約 1/3）、主臥套房 15 秒（約 1/5），符合導覽片的慣例
- 未放進影片：公用衛浴（空間小、門片擋住鏡頭）、儲藏室、走廊

## 片尾字卡

> ※本影片為 3D 電腦合成模擬示意畫面。
> ※影片中之傢俱、家電、燈飾、窗簾、植栽及裝飾品等為空間情境示意，不在買賣範圍內；交屋標準以建材設備表及買賣契約為準。
> ※窗外景觀為模擬，實際景觀依現場為準。
>
> 窗外照片：曾成訓，CC BY 2.0，via Wikimedia Commons

- 台灣預售屋與成屋買賣契約都規定廣告是契約的一部分、「不得約定廣告僅供參考」（[內政部預售屋](https://glrs.moi.gov.tw/LawContent.aspx?id=FL003296)、[成屋](https://glrs.moi.gov.tw/LawContent.aspx?id=GL000442)），所以聲明不只寫「僅供參考」，而是說明哪些東西不在買賣範圍、以什麼為準
- 公平會曾認定「此圖為空間參考示意」的聲明不能補救誤導的畫面（公處字第 110029 號）：影片裡的格局、尺寸、陽台都必須與圖說一致（本模型依 V3 平面）
- 照片授權（CC BY 2.0）要求標示作者與授權，這一行必須保留

## 調查依據

### 台灣、日本的樣品屋／實品屋導覽片

| 項目 | 慣例 | 來源 |
|---|---|---|
| 鏡頭順序 | 依動線：玄關 → 客廳 → 廚房 → 寢室 → 衛浴 → 陽台、眺望；景觀與夜景放在後段當高潮 | [raknal](https://note.com/raknal/n/n71a6151255fe)、[homes.jp](https://biz.homes.jp/column/know-how-00157)、[housecom](https://housecom-fc.jp/20251021-3/)、[熊課看屋 SOP](https://www.shonko.in/wiki/realtor-house-viewing-sop-2026) |
| 長度 | 60 秒版 4–6 個空間（實長 60–75 秒）；一個鏡頭 3–5 秒 | [深森商事](https://fukamori.jp/movie/)、[reel-e](https://www.reel-e.ai/blog/real-estate-video-length) |
| 字卡 | 空間名稱短標、字卡越少越好；台灣常在角落標「3D 合成示意圖」 | [homes.jp](https://biz.homes.jp/column/know-how-00157)、[591 新聞](https://news.591.com.tw/news/219) |
| 景觀 | 「外在環境、視野、景觀之表示與事實不符」屬不實廣告 | [公平會不動產廣告處理原則 三(九)](https://law.ftc.gov.tw/law/LawContent.aspx?id=FL040094) |
| 配樂 | 安靜的鋼琴或 ambient、音量低；文字為主，旁白可有可無 | [homes.jp](https://biz.homes.jp/column/know-how-00157)、[Runway](https://runway.com/resources/real-estate-walkthrough-video) |
| 交付 | 16:9 主片 3840 × 2160／1920 × 1080、30 fps | [YouTube 說明](https://support.google.com/youtube/answer/1722171?hl=zh-Hant) |

### 室內動畫運鏡

| 項目 | 採用 | 來源 |
|---|---|---|
| 焦距 | 遠景 24–28 mm、細節 35–50 mm（全片幅、16:9） | [fotober](https://fotober.com/best-lens-for-real-estate-videography)、[vidpros](https://vidpros.com/best-focal-length-for-real-estate-video/)、[Studio Matrx](https://www.studiomatrx.org/students/architectural-visualization-rendering/camera-fundamentals-focal-length) |
| 相機高 | 遠景 1.3 m（廚房、浴室 1.4 m），細節 0.75–1.45 m | [HDRsoft](https://www.hdrsoft.com/learn/best-height-for-shooting-real-estate-interiors.html) |
| 水平 | 遠景不仰俯、不側傾；要上下構圖用固定移軸 | [Studio Matrx](https://www.studiomatrx.org/students/architectural-visualization-rendering/camera-fundamentals-focal-length)、[Archademia](https://archademia.com/lessons/architectural-animation-course/) |
| 速度 | 推軌 0.03–0.15 m/s、橫移 0.1–0.15 m/s，一個鏡頭移動 0.1–0.9 m；轉向遠低於「7 秒掃過一個畫面寬」 | [imagtor](https://imagtor.com/blog/best-camera-movements-for-real-estate-videography/)、[RED](https://www.reddigitalcinema.com/red-101/camera-panning-speed) |
| 鏡頭長度 | 遠景 5–7 秒、細節 3 秒、收尾 10 秒 | [Archademia](https://archademia.com/lessons/architectural-animation-course/)、[invideo](https://invideo.io/faq/how-long-should-real-estate-b-roll-clips-be/)、[Hah et al. 2008](https://ijdesign.org/index.php/IJDesign/article/view/479) |
| 速度曲線 | 鏡頭內等速；只有片頭加速、片尾減速停住 | [Archademia](https://archademia.com/lessons/architectural-animation-course/)、[Otoy 論壇](https://render.otoy.com/forum/viewtopic.php?p=58734) |
| 轉場 | 同一空間直接切；換空間、換時間溶接 0.6–0.8 秒 | [HomeJab](https://homejab.com/10-video-editing-tips-for-real-estate-tours/) |
| 日轉夜 | 幾乎靜止的遠景，燈依序亮起 | [Morphic](https://morphic.com/resources/vfx/day-night-trans-effect) |
| 幀率／快門 | 30 fps，快門 180°（動態模糊） | [vidpros](https://vidpros.com/best-frame-rate-for-real-estate-videos/)、[RED](https://www.reddigitalcinema.com/red-101/camera-panning-speed) |

## 待決事項

1. 窗外景觀是台中西區的照片：如果這是真實建案、且不在那個位置，影片窗景必須換成實際景觀（或改成不可辨識的景），否則可能違反公平會不動產廣告處理原則三(九)
2. 角落是否常駐一行小字「3D 電腦合成模擬示意」（台灣建案影片常見；不是賣點字卡）
3. 配樂由誰提供：拿到曲子後依 BPM 調整每個鏡頭長度，剪接點對拍子（例如 100 BPM 兩小節 = 4.8 秒）
4. 交付規格：建議 16:9 主片 4K（3840 × 2160）＋ 1080p，30 fps

## 之後的輸出階段（另行處理）

- 白天室內亮度（目前偏暗）、環境光遮蔽（接觸陰影）、景深（細節鏡頭）、動態模糊、統一調色
- 溶接與日轉夜的漸變（燈依序亮起）
- 固定時間步進逐格擷取 → MP4
