# 嵐・悠・羊駝的家｜3D 模型

用 three.js 以程式建模的住宅室內模型，最終目標是製作售屋銷售等級的室內導覽短片。

`handoff/`（交接文件、參考版單檔、原始貼圖）只保留在本機，不納入版本控制；`compare.html` 與 `tools/verify/` 的比對工具需要本機有 `handoff/reference/house3d_current.html` 才能使用。

## 開發

```bash
npm install
npm run fetch:backplates
npm run dev
```

`fetch:backplates` 會從 Wikimedia Commons 下載窗外景觀用的 4 張台中市景照片（各約 3–4 MB）到 `public/backplates/`，不納入版本控制；沒有這些檔案時窗外會是純色。

- `http://localhost:5173/`：模型本體（俯瞰／漫遊、日夜、剖切、房間跳轉、小地圖；左側參數面板可開關各扇門）
- `http://localhost:5173/compare.html`：參考版與新版並排對照（鏡頭同步，也可切換 A/B 疊圖）
- `http://localhost:5173/tools/verify/harness.html`：自動比對幾何與像素。執行前先跑 `npm run verify:prep`，產生加了匯出功能的參考版副本

## 結構

| 路徑 | 內容 |
|---|---|
| `src/data/layout.ts` | 單一資料來源：牆體、開口、門、空間、家具擺位、燈位（SVG px，100 px = 1 m） |
| `src/builders/` | 依 layout 產生幾何：architecture／millwork／furniture／fixtures／decor |
| `src/materials/` | 貼圖載入（`public/textures/`）、PBR 材質、染色倍率 |
| `src/lighting/` | 日／夜燈光預設 |
| `src/cameras/` | 俯瞰（OrbitControls）、漫遊 |
| `src/ui/` | 操作列、小地圖 |
| `tools/` | 貼圖處理與平面圖產生器（Python）、比對工具 |
| `handoff/` | 交接資料（參考版單檔、原始貼圖），唯讀，僅本機 |

## 素材授權

窗外照片：曾成訓（2013-12-25，台中西區），CC BY 2.0，via Wikimedia Commons。影片使用時需在片尾或說明欄註明「Photo: 曾成訓, CC BY 2.0, via Wikimedia Commons」。

- [Taichung old city center Skyline 2013](https://commons.wikimedia.org/wiki/File:Taichung_old_city_center_Skyline_2013.jpg)
- [Taichung night skyline 2013](https://commons.wikimedia.org/wiki/File:Taichung_night_skyline_2013.jpg)
- [Cityscape in West District of Taichung](https://commons.wikimedia.org/wiki/File:Cityscape_in_West_District_of_Taichung.jpg)
- [Night cityscape in West District of Taichung 02](https://commons.wikimedia.org/wiki/File:Night_cityscape_in_West_District_of_Taichung_02.jpg)
