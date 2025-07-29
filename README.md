# DEMATEL 問卷系統

一個基於 Web 的 DEMATEL (Decision Making Trial and Evaluation Laboratory) 問卷調查系統，支援動態問卷生成、數據收集和 QR Code 匯出功能。

## 🌟 功能特色

- **動態問卷生成**：基於 JSON 配置自動生成問卷結構
- **響應式設計**：支援桌面和移動設備
- **智能數據壓縮**：使用統計分析的自動縮短演算法
- **QR Code 匯出**：自動分段壓縮數據並生成 QR Code
- **數據完整性**：SHA-256 雜湊驗證確保數據完整性
- **離線支援**：純前端實作，無需伺服器

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
│   └── app.js              # 主要 JavaScript 應用邏輯
├── lib/
│   ├── fonts/              # 字體檔案
│   ├── pako.min.js         # 數據壓縮庫
│   ├── qrcode.min.js       # QR Code 生成庫
│   └── README.md           # 第三方庫說明
├── dematel-structure.json  # 問卷結構配置檔案
├── index.html              # 主要應用程式入口
└── README.md               # 專案說明
```

## 🛠️ 技術架構

- **前端框架**：原生 JavaScript (ES6+)
- **樣式**：CSS3 + CSS Variables
- **數據壓縮**：Pako (deflate/inflate)
- **QR Code**：QRCode.js
- **字體**：Noto Sans TC (繁體中文)

## 📊 核心演算法

### 自動縮短壓縮演算法
- 統計分析字串出現頻率
- 基於收益計算公式自動優化
- 支援鍵值對智能縮短

### QR Code 分段策略
- 300字元安全容量限制
- 自動分段並標記順序
- SHA-256 雜湊完整性驗證

## 📱 使用方式

1. **填寫基本資料**：輸入必要的個人資訊
2. **完成問卷評估**：根據構面和準則進行評分
3. **生成 QR Code**：系統自動壓縮數據並生成 QR Code
4. **截圖回傳**：將所有 QR Code 截圖並提交

## 🔧 配置檔案

問卷結構可透過修改 `dematel-structure.json` 來自訂：

```json
{
  "title": "問卷標題",
  "basicInfo": { ... },
  "dimensions": [ ... ],
  "criteria": [ ... ]
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
