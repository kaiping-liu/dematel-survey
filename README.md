# DEMATEL 問卷系統

一個基於 Web 的 DEMATEL (Decision Making Trial and Evaluation Laboratory) 問卷調查系統，支援動態問卷生成、數據收集和 QR Code 匯出功能。


## 🌟 功能特色

- **動態問卷生成**：基於 `dematel-structure.json` 配置自動生成問卷結構，支援自訂基本資料欄位、構面、準則與選項。
- **基本資料欄位進階支援**：
  - 支援文字、下拉選單(select)、複選(checkbox)等多種欄位型態。
  - 選項可設定「其他」：
    - select 欄位：選擇「其他」時自動顯示必填輸入框，並將內容直接儲存於主欄位。
    - checkbox 欄位：「其他」為勾選+輸入框組合，勾選時啟用輸入框並必填，內容直接儲存於主欄位陣列。
  - 所有欄位皆支援必填驗證，未填寫時會即時提示。
- **響應式設計**：支援桌面與行動裝置，UI/UX 針對觸控與鍵盤操作優化。
- **資料即時儲存與恢復**：所有填寫內容自動儲存於本地(localStorage)，可隨時中斷與繼續填寫。
- **問卷進度管理**：自動記錄填寫進度，支援恢復、重新開始、進度條顯示。
- **智能數據壓縮**：使用 Pako 進行壓縮，並結合自動縮短演算法減少 QR Code 數量。
- **QR Code 匯出**：自動分段壓縮數據並生成多個 QR Code，支援截圖回傳。
- **Google Sheet 上傳**：支援直接將問卷結果上傳至 Google Sheet，方便資料收集與分析。
- **統一配置檢查**：所有關鍵操作（下載、上傳、QR生成）都使用統一的配置檢查機制，確保資料一致性。
- **智能配置管理**：支援強制清空或詢問模式，靈活處理配置檔案變更情況。
- **資料完整性驗證**：每份問卷皆有唯一 SHA-256 雜湊值，確保資料未被竄改。
- **設定檔變更偵測**：自動偵測問卷結構檔異動，並根據設定處理資料清空策略。
- **離線支援**：純前端實作，無需伺服器即可完整運作。
- **多語系與字體支援**：預設繁體中文，內建 Noto Sans TC 字體。
- **詳細錯誤提示與防呆設計**：表單、問卷、QR code 產生等皆有完整錯誤處理與提示。
- **資源載入優化**：CDN 優先載入策略，本地容錯機制，確保在各種網路環境下穩定運作。

## 🚀 快速開始

1. 克隆或下載此專案
2. 直接在瀏覽器中開啟 `index.html`
3. 開始填寫問卷

## 📁 專案結構

```
dematel-survey/
├── css/
│   └── styles.css           # 主要樣式檔案
├── js/
│   ├── app.js              # 主要 JavaScript 應用邏輯
│   └── resource-loader.js  # CDN 資源載入器
├── lib/
│   ├── fonts/              # 字體檔案
│   ├── pako.min.js         # 數據壓縮庫
│   ├── qrcode.min.js       # QR Code 生成庫
│   └── README.md           # 第三方庫說明
├── dematel-structure.json      # 問卷結構配置檔案
├── google-apps-script-example.js # Google Apps Script 範例程式
├── google-sheet-test.html     # Google Sheet 上傳功能測試頁面
├── config-check-test.html     # 統一配置檢查功能測試頁面
├── GOOGLE_SHEET_SETUP.md      # Google Sheet 設定指南
├── index.html                 # 主要應用程式入口
└── README.md                  # 專案說明
```

## 🛠️ 技術架構

- **前端框架**：原生 JavaScript (ES6+)，基於 Class 架構設計
- **樣式**：CSS3 + CSS Variables，BEM 命名規範
- **數據壓縮**：Pako (deflate/inflate) + 自動縮短演算法
- **QR Code**：QRCode.js，支援分段生成
- **字體**：Noto Sans TC (繁體中文)，透過 ResourceLoader 動態載入
- **資源管理**：CDN 優先載入，本地容錯機制
- **數據完整性**：SHA-256 雜湊驗證

## 📊 核心演算法

### 資源載入系統
- **CDN 優先策略**：優先使用 CDN 資源，失敗時自動容錯到本地檔案
- **進度追蹤**：即時顯示載入進度和狀態
- **智能重試**：自動重試機制，確保資源載入穩定性

### 統一配置檢查機制
- **MD5 雜湊比對**：自動檢測配置檔案變更
- **版本控制**：支援配置版本管理和相容性檢查
- **清空策略**：可設定強制清空或詢問模式

### 自動縮短壓縮演算法
- 統計分析字串出現頻率
- 基於收益計算公式自動優化
- 支援鍵值對智能縮短

### QR Code 分段策略
- 800字元安全容量限制（經過測試優化）
- 自動分段並標記順序
- SHA-256 雜湊完整性驗證


## 📱 使用方式

1. **填寫基本資料**：依據設定檔自動產生欄位，支援「其他」選項與必填驗證。
2. **完成問卷評估**：依序進行構面與準則兩階段配對評分。
3. **即時儲存進度**：可隨時中斷、關閉網頁，重新開啟自動恢復。
4. **生成 QR Code**：填寫完成後，系統自動壓縮並分段產生 QR Code。
5. **上傳至 Google Sheet**：（可選）直接將結果上傳至 Google 試算表。
6. **截圖回傳**：將所有 QR Code 截圖並提交。

## ☁️ Google Sheet 上傳設定

如需啟用 Google Sheet 上傳功能，請按照以下步驟設定：

1. **查看設定指南**：詳細步驟請參考 [`GOOGLE_SHEET_SETUP.md`](GOOGLE_SHEET_SETUP.md)
2. **測試上傳功能**：使用 [`google-sheet-test.html`](google-sheet-test.html) 測試連線
3. **設定 URL**：在 `dematel-structure.json` 中設定 `SCRIPT_URL`

```json
{
  "settings": {
    "script_url": "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
    "force_clear_on_config_change": false,
    "debug": false,
    "config_version": 1
  }
}
```

## 🔧 問卷結構設定檔（dematel-structure.json）

問卷結構可透過修改 `dematel-structure.json` 來自訂，範例如下：

```json
{
  "說明": {
    "標題": "問卷標題",
    "內容": ["說明文字或圖片路徑..."],
    "按鈕文字": "開始填寫"
  },
  "基本資料": [
    {
      "編號": "gender",
      "名稱": "性別",
      "類型": "select",
      "必填": true,
      "選項": ["男", "女", "其他"]
    },
    ...
  ],
  "架構": [
    {
      "構面": "A",
      "代碼": "A",
      "說明": "...",
      "準則": [
        { "編號": "A1", "名稱": "...", "說明": "..." },
        ...
      ]
    },
    ...
  ]
}
```


## 🎯 瀏覽器支援

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+


## 📄 授權

此專案採用 MIT 授權條款。

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request 來改善此專案。

---

**開發者**：DEMATEL Survey System Team  
**最後更新**：2025年7月29日
