# DEMATEL 簡易問卷系統 – 全端規格 **v1.1**

本版本聚焦在三大主題：**(1) 問卷產生邏輯**、**(2) UI 設計邏輯**、**(3) 使用操作邏輯**，其他章節維持概要層級，以免分散閱讀重點。

---
## 0. 前置欄位（快速回顧）
| 面向 | 規格 |
|------|------|
| 架構 | 純前端 SPA，HTML／CSS／Vanilla JS，可離線。 |
| 執行環境 | ES2020+ 現代瀏覽器（Chrome 94+、Safari 15+…）。 |
| 主要外掛 | QRCode.js、pako（gzip）。 |
| 暫存 | `localStorage`，依 `dataHash` 控制版本。 |

---
## 1. 問卷產生邏輯 (Question Generation Engine)

> **目的**：在執行階段動態產生固定且唯一的題庫，不需手動維護 Excel 或硬編碼。

### 1.1 載入與驗證
1. **載入設定**：透過 `fetch()` 讀取 JSON，加入時間戳避免快取。
2. **Schema 驗證**：
   - `intro`, `basicInfo`, `dimensions` 欄位缺一即拋錯。
   - 每個 `dimension` 至少 2 個 `criteria`；否則停止並提示 *設計不合法*。
   - 檢查所有 `code` 唯一性（構面、準則各自獨立 Name‑Space）。
3. **雜湊計算**：以 MD5 生成 `dataHash`→ 比對 `localStorage.dematel_data_hash`，若不同則 `clearAll()`。

### 1.2 產生流程 Pipeline
```
<JSON> → validate() →
  ├─ genCriteriaPairs()  // 每構面內
  ├─ genDimensionPairs() // 構面之間
  └─ assembleQuestions() // 決定排序／雜湊
```

| 階段 | 演算法 | 產出 | 時間複雜度 |
|-------|---------|------|------------|
| **genCriteriaPairs** | 針對單一 `dimension`, 以雙迴圈 i<j 產生 | `criteriaQ[]` | O(∑ n²) |
| **genDimensionPairs** | 針對 `dimensions` 陣列，雙迴圈 i<j | `dimensionQ[]` | O(m²) |
| **assembleQuestions** | `questions=[...criteriaQ,...dimensionQ]` | `questions[]` | O(p) |

> 其中 `n` = 單一構面的準則數、`m` = 構面數、`p` = 總題數。

### 1.3 Unique Key 產生規則
```
<type>:<idA>|<idB>
// type = criteria | dimension
// id 按 JSON 先後順序固定，不做字典排序 ⇒ 保持題目跨裝置一致
```
示例：`criteria:c11|c12`、`dimension:D1|D2`。

### 1.4 題序排序策略
| 模式 | 行為 |
|------|------|
| 預設 | 先 `criteriaQ`（全部），後 `dimensionQ`。 |
| 隨機 | `shuffle=true` 時，採 Fisher‑Yates，並將亂數種子寫入 `localStorage.seed` 以便重現序列。 |

### 1.5 極端情境處理
| 情境 | 處理方式 |
|------|----------|
| 構面 < 2 或 準則不足 | `alert("設定檔不合法…")`，停留在 Intro。 |
| 題庫 > 5000 題 | 以 `confirm` 提醒使用者「題量過大」，仍允許繼續。 |
| 亂數種子重複 | 重新撲排直到排列結果雜湊不同（避免偶然與固定序相同）。 |

---
## 2. UI 設計邏輯 (UI Architecture)

> **核心理念**：單一頁面、四層結構、BEM 命名、微動畫增進回饋。

### 2.1 架構分層
```
<body>
 ├─ app-shell               // fixed header + progress bar
 ├─ view-container          // 依 phase 切換內容
 │    ├─ view--intro
 │    ├─ view--basic
 │    ├─ view--question     // criteria / dimension 共用
 │    └─ view--finish
 └─ debug-panel (fixed)
```

### 2.2 網格與佈局
| 斷點 | 主區域寬度 | 描述 |
|------|-----------|------|
| ≥ 1024 px | 900 px | 雙欄：45 % + 45 %（左右題目說明），10 % 留白。 |
| 768–1023 px | 90 vw | 雙欄 / 方向按鈕改為水平置中。 |
| 480–767 px | 92 vw | 單欄；左右文字堆疊。 |
| < 480 px | 95 vw | 按鈕改全寬縱向。 |

### 2.3 色彩與字型 Token
```css
:root{
 --clr-bg:      #fefae0;
 --clr-main:    #ccd5ae;
 --clr-accent:  #d4a373;
 --clr-error:   #e63946;
 --font-base:   'Noto Sans TC',sans-serif;
 --radius-lg:   12px;
 --radius-sm:    4px;
}
```
> **淡色主題優先**；若需深色可再衍生 `prefers-color-scheme`。

### 2.4 組件狀態圖 (Finite State)
1. **DirectionButton**  
   `idle → hover → active:selected → idle`；active 2 s 內自動 idle。
2. **ScoreModal**  
   `hidden → opening → visible (valid?|invalid) → closing → hidden`。
3. **ProgressBar**  
   `update` 事件以 **CSS variable** `--percent` 控制寬度。

### 2.5 動畫與時序
| 事件 | 動畫 | 時長 | Easing |
|------|------|------|--------|
| 頁面切換 | `slide-out-left / slide-in-right` | 0.4 s | ease-in-out |
| Modal 彈跳 | `scale(0.8→1)` + fade | 0.3 s | ease-out |
| 按鈕 Hover | `transform:scale(1.1)` | 0.15 s | ease |

### 2.6 可近性 (A11y)
- **ARIA**：所有互動元件加 `aria-label`；Modal 以 `role="dialog" aria-modal="true"`。
- **鍵盤導覽**：Tab 迴圈、左右上下鍵選方向、Enter 送出、Esc 關閉 Modal。
- **對比**：主背景與文字對比比 ≥ 4.5；錯誤提示 ≥ 7。 

---
## 3. 使用操作邏輯 (User Interaction Flow)

### 3.1 全域狀態機
```
              (valid)      ┌───────────────┐
 intro ─click─► basic ─next► criteria ────┐│
 │                         │               ▼│
 │                  (all criteria done)  dimension ────┐
 │                         │               ▼          │
 └──────── abort / reload ◄─ idx&phase restore ──── finish
```
> **恢復機制**：任意頁面 reload → 讀 `phase+idx` → 回復對應 view。

### 3.2 互動步驟詳述
| # | 使用者動作 | 系統回應 (UI) | 狀態更新 | 備註 |
|---|------------|--------------|-----------|-------|
| 1 | 進入網址 | Intro 卡片淡入 | phase="intro" | 若 `localStorage.phase` 存在則顯示「續填」提示。 |
| 2 | 點「開始」 | 卡片 slide-out；BasicForm slide-in；Progress 5→10% | phase="basic" | — |
| 3 | 填基本資料 | 即時移除 error；Tab 次序自動循環 | basicInfo 更新 | debounced save 500 ms |
| 4 | 點「下一步」 | 若未填→整表單 shake；已填→Question card 淡入 | phase="criteria", idx=0 | — |
| 5 | 點方向 `X` | 按鈕.selected；0.1 s 後自動切題 | answers[key].rel='X'；idx++ | saveToLocal() idlesave |
| 6 | 點方向 `to/from/bi` | Modal 彈出 | tempRel = 'to' | — |
| 7 | 輸入分數 1‑4 | 非法值紅色 outline；合法值→確定鈕亮起 | modalValid | — |
| 8 | Enter / 確定 | Modal 隱藏；徽章顯示分數；下一題 slide-in | answers[key] 存完整；idx++ | 若 `bi` 要求兩分數，input2 失焦後才亮起確定。
| 9 | **所有準則題完成** | 題卡右滑退出；進入 dimension 題卡 | phase="dimension" | Progress 自動跳轉比例 |
|10 | 完成最後一題 | Progress 100%；畫面翻頁→Finish | phase="finish" | validateCompletion() 通過 |
|11 | 下載 JSON | 按鈕 spinner→blob 下載→恢復 | — | 檔名 `dematel‑YYYYMMDD.json` |
|12 | 產生 QR | 多張 QR fade‑in；顯示 i/n | — | 每片 ≤ 1200 char (Base64) |
|13 | 🐞 Debug | Panel slide-up；顯示 JSON dump | — | 清空後 `location.reload()` |

### 3.3 例外與錯誤流
| 觸發點 | 行為 | UI 訊息 |
|---------|------|---------|
| 離線且 localStorage quota 滿 | 暫停存檔，紅色 Toast「無法儲存，請清空空間」。 | Toast 3 s |
| 輸入分數非 1‑4 | 保留 Modal，input 標記 `.is-error` | Hint：「請輸入 1–4」 |
| 亂離按鍵 | 不可接受的鍵盤操作 → 鈴聲 (accessibility beep) | 無 |

---
### ✨ 小結
- **問卷產生**：保證唯一、可重現、複雜度 O(p)。
- **UI 設計**：四層架構＋Atomic Token＋動畫對應各 State。 
- **使用流程**：自 Intro→Finish、任何中斷可續填、錯誤即時回饋。

本文件至此，足供開發者直譯為程式碼或審核用測試案例。

