# DEMATEL 系統部署指南

## 🚀 快速部署

### 方法一：直接開啟 (推薦)
1. 下載所有專案檔案
2. 直接雙擊 `index.html` 開啟
3. 在瀏覽器中即可使用

### 方法二：本地伺服器
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (需安裝 http-server)
npx http-server -p 8000

# PHP
php -S localhost:8000
```

然後開啟 `http://localhost:8000`

## 📁 檔案結構檢查

部署前請確認以下檔案完整：

```
dematel-survey/
├── index.html              ✅ 必要
├── dematel-structure.json  ✅ 必要
├── css/
│   └── style.css           ✅ 必要
├── js/
│   ├── main.js             ✅ 必要
│   ├── survey-logic.js     ✅ 必要
│   ├── ui-handler.js       ✅ 必要
│   ├── data-handler.js     ✅ 必要
│   ├── storage.js          ✅ 必要
│   ├── secure-renderer.js  ✅ 必要
│   ├── lazy-renderer.js    ✅ 必要
│   └── compression-utils.js ✅ 必要
└── lib/
    ├── bootstrap.min.css    ✅ Bootstrap 5.3
    ├── bootstrap.bundle.min.js ✅ Bootstrap 5.3
    ├── qrcode.min.js       ✅ 必要
    ├── lz-string.min.js    ✅ 必要
    ├── pako.min.js         ✅ 必要
    └── spark-md5.min.js    ✅ 必要
```

## 🌐 雲端部署

### GitHub Pages
1. 建立 GitHub Repository
2. 上傳所有檔案到 `main` 分支
3. 在 Repository Settings > Pages 啟用 GitHub Pages
4. 選擇 `Deploy from a branch` > `main` > `/ (root)`
5. 等待部署完成，訪問提供的URL

### Netlify
1. 註冊 Netlify 帳號
2. 拖拽專案資料夾到 Netlify Deploy 區域
3. 等待部署完成
4. 獲得 `https://app-name.netlify.app` 網址

### Vercel
1. 安裝 Vercel CLI: `npm i -g vercel`
2. 在專案目錄執行: `vercel`
3. 跟隨提示完成部署
4. 獲得部署網址

### 自建伺服器

#### Apache 設定
```apache
<VirtualHost *:80>
    DocumentRoot "/path/to/dematel-survey"
    ServerName your-domain.com
    
    <Directory "/path/to/dematel-survey">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

#### Nginx 設定
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dematel-survey;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    # 快取靜態資源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🔧 依賴檔案檢查

### Bootstrap 5.3 (本地部署)
- ✅ `lib/bootstrap.min.css` (146KB)
- ✅ `lib/bootstrap.bundle.min.js` (216KB)
- 🎯 **完全離線運作，無需CDN**

### 核心函式庫
- ✅ `lib/qrcode.min.js` - QR Code 產生
- ✅ `lib/lz-string.min.js` (8KB) - 優先壓縮
- ✅ `lib/pako.min.js` (58KB) - 備用壓縮
- ✅ `lib/spark-md5.min.js` - 檔案雜湊驗證

### 驗證指令
```bash
# 檢查所有必要檔案
ls -la index.html dematel-structure.json
ls -la css/style.css
ls -la js/*.js
ls -la lib/*.{css,js}

# 確認檔案大小 (Windows PowerShell)
Get-ChildItem lib/ | Select-Object Name, Length
```

### 修改問卷內容
編輯 `dematel-structure.json`：

```json
{
  "criteria": [
    {
      "id": "C1",
      "name": "數據分析能力",
      "description": "能夠有效分析和解釋數據，提取有價值的洞察"
    },
    {
      "id": "C2", 
      "name": "批判思維能力",
      "description": "能夠客觀評估信息，識別邏輯錯誤和偏見"
    }
  ],
  "dimensions": [
    {
      "id": "D1",
      "name": "認知能力",
      "criteria": ["C1", "C2"]
    }
  ]
}
```

### 修改樣式
編輯 `css/style.css` 來自定義外觀：

```css
/* 主色調 */
:root {
    --primary-color: #2563eb;      /* 藍色 */
    --secondary-color: #10b981;    /* 綠色 */
    --background-color: #fefae0;   /* 米色 */
}

/* 自定義按鈕顏色 */
.btn-primary {
    background-color: var(--primary-color);
}
```

### 修改標題與說明
編輯 `index.html` 中的相關文字：

```html
<h1>您的問卷標題</h1>
<div class="intro-content">
    <!-- 修改這裡的說明內容 -->
</div>
```

## 🔒 安全考量

### HTTPS 部署 (建議)
- 使用 SSL 憑證確保資料傳輸安全
- 免費憑證：Let's Encrypt
- 雲端平台通常自動提供 HTTPS

### Content Security Policy
在 `index.html` 添加 CSP 標頭：

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
```

### 檔案權限 (Linux/Unix)
```bash
# 設定適當的檔案權限
find /path/to/dematel-survey -type f -exec chmod 644 {} \;
find /path/to/dematel-survey -type d -exec chmod 755 {} \;
```

## 📱 行動裝置最佳化

### Viewport 設定
已包含在 `index.html`：
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
```

### Progressive Web App (PWA)
創建 `manifest.json`：

```json
{
  "name": "DEMATEL 問卷系統",
  "short_name": "DEMATEL",
  "description": "離線問卷調查系統",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fefae0",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## 🔍 部署驗證

### 功能測試清單
- [ ] 問卷頁面正常載入
- [ ] 基本資料填寫功能
- [ ] 問題回答功能
- [ ] 進度儲存功能
- [ ] 資料匯出功能
- [ ] QR Code 生成功能
- [ ] 手機版介面正常

### 效能測試
```javascript
// 在瀏覽器 Console 執行
console.time('pageLoad');
window.addEventListener('load', () => {
    console.timeEnd('pageLoad');
    console.log('Page loaded successfully');
});
```

### 儲存測試
```javascript
// 測試 localStorage 可用性
try {
    localStorage.setItem('test', 'value');
    localStorage.removeItem('test');
    console.log('localStorage available');
} catch (e) {
    console.error('localStorage not available:', e);
}
```

## 🐛 常見部署問題

### 問題1：檔案路徑錯誤
**症狀**: 載入CSS/JS檔案失敗
**解決**: 
- 檢查檔案路徑大小寫
- 確認相對路徑正確
- 檢查檔案是否存在

### 問題2：CORS錯誤
**症狀**: 載入JSON檔案失敗
**解決**:
- 使用本地伺服器而非直接開啟檔案
- 設定正確的 CORS 標頭

### 問題3：手機版顯示異常
**症狀**: 在手機上介面排版錯亂
**解決**:
- 檢查 viewport meta 標籤
- 測試不同螢幕尺寸
- 檢查 CSS media queries

### 問題4：LocalStorage 無法使用
**症狀**: 無法儲存問卷進度
**解決**:
- 檢查瀏覽器隱私設定
- 確認不在無痕模式
- 清理瀏覽器儲存空間

## 📈 監控與維護

### 錯誤監控
在 `main.js` 添加全域錯誤處理：

```javascript
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    // 可選：發送錯誤報告
});
```

### 使用分析
使用 Google Analytics 或其他分析工具追蹤使用情況：

```html
<!-- 在 index.html 中添加追蹤代碼 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID"></script>
```

### 定期備份
- 定期備份部署檔案
- 監控伺服器運行狀態
- 檢查憑證到期時間

---

*部署完成後，建議進行完整的功能測試以確保系統正常運行。*
