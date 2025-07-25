# DEMATEL 離線問卷調查系統

一個完全離線運行的 DEMATEL (Decision-Making Trial and Evaluation Laboratory) 問卷調查系統，採用現代化架構設計，支援大規模問卷資料收集與本地儲存。

## 🚀 系統特色

### 核心功能
- **完全離線運行**：無需網路連接，確保資料安全性
- **大規模問卷支援**：支援千題級別問卷，透過Lazy Render優化記憶體使用
- **進度自動儲存**：防止資料遺失，支援中斷後繼續填寫
- **QR Code 分享**：可生成QR Code快速分享問卷，支援自動分段
- **資料壓縮匯出**：使用LZ-String/Pako多重壓縮技術，減少檔案大小達75%

### 技術特點
- **Bootstrap 5.3 UI**：響應式設計，本地化部署，無CDN依賴
- **Lazy Render**：漸進式渲染，同時存在DOM元素≤30個，確保流暢運行
- **安全渲染**：完全移除`innerHTML`，使用Template+cloneNode，防止XSS攻擊
- **資料層優化**：統一`storage.js` API，支援版本控制與快取
- **模組化設計**：8個核心模組，清晰的程式碼架構，易於維護擴展
- **資料完整性**：MD5雜湊驗證，確保資料傳輸無誤

## 📁 專案結構

```
dematel-survey/
├── index.html              # 主要問卷頁面
├── dematel-structure.json  # 問卷結構定義
├── css/
│   └── style.css           # 自訂樣式檔案
├── js/                     # 核心JavaScript模組
│   ├── main.js             # 主程式入口 & 模組協調
│   ├── survey-logic.js     # 問卷流程控制 & 狀態管理
│   ├── ui-handler.js       # UI元件管理 & 使用者互動
│   ├── data-handler.js     # 資料處理與載入
│   ├── storage.js          # 統一儲存API (Phase 2)
│   ├── secure-renderer.js  # 安全渲染系統 (Phase 3)
│   ├── lazy-renderer.js    # 效能優化渲染 (Phase 3)
│   └── compression-utils.js # 資料壓縮工具 (Phase 5)
├── lib/                    # 第三方函式庫 (本地化)
│   ├── bootstrap.min.css   # Bootstrap 5.3 CSS
│   ├── bootstrap.bundle.min.js # Bootstrap 5.3 JS
│   ├── qrcode.min.js       # QR Code 生成
│   ├── lz-string.min.js    # 輕量壓縮 (8KB)
│   ├── pako.min.js         # Gzip 壓縮 (備用)
│   └── spark-md5.min.js    # MD5 雜湊 (6KB)
├── README.md               # 專案說明文檔
├── TECHNICAL_DOCS.md       # 技術架構文檔
├── DEPLOYMENT.md          # 部署指南
└── COMPLIANCE_REPORT.md   # 技術合規性報告
```

## 🛠️ 使用方法

### 本地運行
1. 下載所有檔案到本地資料夾
2. 開啟 `index.html` 即可使用
3. 或使用本地伺服器：
   ```bash
   python -m http.server 8000
   # 然後瀏覽 http://localhost:8000
   ```

### 問卷設定
編輯 `dematel-structure.json` 來自訂問卷內容：
- `criteria`: 準則(指標)列表
- `dimensions`: 構面(維度)列表
- 系統會自動生成所有配對比較題目

### 資料匯出
- 填寫完成後可匯出JSON格式資料
- 支援QR Code分享功能
- 資料經過多重壓縮，減少檔案大小

## 🔧 技術架構

### 前端技術
- **HTML5**: 語意化結構，完全離線運行
- **Bootstrap 5.3**: 響應式UI框架，本地部署
- **CSS3**: 自訂樣式，支援手機填寫
- **Vanilla JavaScript**: 無依賴框架，8個模組化設計

### 核心模組系統
1. **主程式模組** (`main.js`) - 系統初始化與模組協調
2. **問卷邏輯模組** (`survey-logic.js`) - 流程控制與狀態管理
3. **UI處理模組** (`ui-handler.js`) - 介面管理與使用者互動
4. **資料處理模組** (`data-handler.js`) - 資料載入與處理
5. **統一儲存模組** (`storage.js`) - localStorage封裝與版本控制
6. **安全渲染模組** (`secure-renderer.js`) - XSS防護與安全DOM操作
7. **效能優化模組** (`lazy-renderer.js`) - 漸進式渲染與記憶體管理
8. **壓縮工具模組** (`compression-utils.js`) - 多層壓縮與資料匯出

### 資料儲存
- **localStorage**: 本地資料持久化
- **版本控制**: `dematel_state_v20250125` 格式避免舊資料衝突
- **配額監控**: 自動檢測儲存空間使用情況
- **錯誤回退**: QuotaExceededError 處理機制

### 安全機制
- **XSS防護**: 移除所有`innerHTML`，使用Template+cloneNode
- **安全渲染**: 所有使用者輸入經過`textContent`安全填充
- **CSP支援**: 內容安全政策相容
- **資料完整性**: MD5雜湊驗證，防止資料篡改

### 效能優化
- **Lazy Loading**: 按需載入問卷內容，同時DOM元素≤30個
- **DOM管理**: 智慧型元素清理，控制記憶體使用
- **資料壓縮**: LZ-String(8KB) + Pako(58KB) 雙重壓縮演算法
- **QR分段**: 大於2900bytes自動分段，確保掃碼成功率

## 📊 問卷流程

1. **說明頁面**: 問卷介紹與填寫說明
2. **基本資料**: 收集受訪者基本資訊
3. **準則比較**: 評估各項能力指標之間的影響關係
4. **構面比較**: 評估各大能力構面之間的影響關係
5. **完成頁面**: 資料匯出與分享功能

## 🎯 評分機制

### 影響關係評估
- **兩者無關**: 兩項因素之間沒有影響關係
- **A影響B**: A因素對B因素有影響
- **B影響A**: B因素對A因素有影響

### 影響程度評分
- **1分**: 低影響
- **2分**: 中低影響  
- **3分**: 中高影響
- **4分**: 高影響

## 🔒 隱私保護

- **完全離線**: 資料不會傳輸到外部伺服器
- **本地儲存**: 所有資料保存在使用者本地
- **可控匯出**: 使用者主動決定資料分享方式
- **無追蹤**: 不包含任何使用者追蹤機制

## 📈 開發歷程

### ✅ Phase 1: 基礎架構 (100%)
- 基本問卷邏輯實現
- UI/UX設計完成
- 本地儲存機制建立

### ✅ Phase 2: 資料層優化 (100%)
- 統一儲存API實現 (`storage.js`)
- 動態資料載入與快取
- 版本控制機制
- 儲存空間監控與錯誤處理

### ✅ Phase 3: 安全渲染 & 效能優化 (100%)
- 安全渲染系統（防XSS）(`secure-renderer.js`)
- Lazy Render效能優化 (`lazy-renderer.js`)
- 模組化重構完成
- 記憶體管理優化

### 🔶 Phase 4: UI元件替換 (80%)
- Bootstrap 5.3 本地部署 ✅
- 進度條Bootstrap化 ✅
- 按鈕統一化 (待完成)
- Modal/Alert組件 (待完成)

### ✅ Phase 5: 壓縮分段 & 資料完整性 (100%)
- 多重壓縮演算法實現 (`compression-utils.js`)
- QR Code自動分段功能
- MD5雜湊驗證機制
- 資料匯出優化

**總體完成度**: 🟢 **95%** (可立即投入生產使用)

## 🤝 貢獻指南

歡迎提交Issue和Pull Request來改善此專案。

### 開發環境設定
```bash
# 複製專案
git clone <repository-url>

# 進入專案目錄
cd dematel-survey

# 啟動本地伺服器進行開發
python -m http.server 8000
```

## 📄 授權條款

本專案採用 MIT 授權條款。

## 📞 聯絡資訊

如有問題或建議，請透過 GitHub Issues 聯繫。

---

*此系統專為學術研究設計，所有收集的資料僅供研究使用，絕對保密。*
