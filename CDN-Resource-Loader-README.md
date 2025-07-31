# CDN 資源載入器

## 概述

這個系統實現了智慧的外部資源載入機制，優先使用 CDN 載入，失敗時自動容錯到本地檔案。

## 功能特點

### 🚀 **CDN 優先載入**
- 優先從高速 CDN 載入資源
- 提供更快的載入速度
- 減少伺服器負載

### 🛡️ **容錯機制**
- CDN 載入失敗時自動切換到本地檔案
- 5秒超時保護
- 完整的錯誤處理

### 📊 **載入監控**
- 即時載入狀態追蹤
- 詳細的錯誤日誌
- 載入統計資訊

### 🔄 **防重複載入**
- 智慧快取機制
- 避免重複載入相同資源
- Promise 管理確保載入順序

## 支援的資源

### JavaScript 庫
- **QRCode.js** - QR 碼生成庫
  - CDN: `https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js`
  - 本地: `lib/qrcode.min.js`

- **Pako** - 資料壓縮庫
  - CDN: `https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js`
  - 本地: `lib/pako.min.js`

### CSS 資源
- **Noto Sans TC** - 繁體中文字體
  - CDN: `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap`
  - 本地: `lib/fonts/noto-sans-tc.css`

## 使用方法

### 基本用法

```javascript
// 載入所有資源
const success = await loadAllResources();
if (success) {
    console.log('所有資源載入完成');
} else {
    console.error('資源載入失敗');
}
```

### 單獨載入資源

```javascript
// 載入 QRCode 庫
await window.resourceLoader.loadScript(
    'QRCode',
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
    'lib/qrcode.min.js',
    () => typeof QRCode !== 'undefined'
);
```

### 檢查載入狀態

```javascript
// 檢查資源是否已載入
if (window.resourceLoader.isLoaded('QRCode')) {
    // 使用 QRCode 庫
}

// 獲取載入統計
const stats = window.resourceLoader.getStats();
console.log('載入統計:', stats);
```

## 配置設定

資源配置位於 `js/resource-loader.js` 中的 `RESOURCE_CONFIG` 物件：

```javascript
window.RESOURCE_CONFIG = {
    qrcode: {
        name: 'QRCode',
        type: 'script',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
        fallbackUrl: 'lib/qrcode.min.js',
        validator: () => typeof QRCode !== 'undefined'
    },
    // ... 其他資源配置
};
```

### 配置參數說明

- `name`: 資源名稱
- `type`: 資源類型 (`script` 或 `css`)
- `cdnUrl`: CDN 載入 URL
- `fallbackUrl`: 本地容錯 URL
- `validator`: JavaScript 資源的驗證函數（可選）

## 測試

### 測試資源載入器

開啟 `test-resource-loader.html` 進行完整測試：

```bash
# 在瀏覽器中開啟
open test-resource-loader.html
```

測試內容包括：
- CDN 資源載入測試
- QR Code 生成功能測試
- Pako 壓縮功能測試
- 載入統計查看

### 手動測試步驟

1. **正常載入測試**
   - 確保網路連線正常
   - 載入頁面並檢查控制台日誌
   - 驗證所有資源從 CDN 載入成功

2. **容錯機制測試**
   - 暫時中斷網路連線或封鎖 CDN
   - 重新載入頁面
   - 驗證資源自動切換到本地載入

3. **功能驗證測試**
   - 測試 QR Code 生成功能
   - 測試 Pako 壓縮/解壓縮功能
   - 確認所有功能正常運作

## 效能優化

### 載入策略
- 並行載入多個資源
- 5秒超時避免長時間等待
- Promise 快取避免重複載入

### 錯誤處理
- 詳細的錯誤訊息
- 完整的載入日誌
- 優雅的降級機制

### 記憶體管理
- 適當的 Promise 清理
- 避免記憶體洩漏
- 最小化 DOM 操作

## 故障排除

### 常見問題

**Q: CDN 載入失敗怎麼辦？**
A: 系統會自動切換到本地檔案載入，無需手動干預。

**Q: 本地檔案也載入失敗？**
A: 檢查 `lib/` 資料夾中的檔案是否存在且完整。

**Q: 資源載入超時？**
A: 檢查網路連線，可以調整 `fallbackTimeout` 參數。

### 除錯技巧

1. **查看控制台日誌**
   ```javascript
   // 開啟詳細日誌
   console.log('資源載入器狀態:', window.resourceLoader.getStats());
   ```

2. **手動測試資源**
   ```javascript
   // 測試 CDN 可達性
   fetch('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js')
     .then(response => console.log('CDN 狀態:', response.status));
   ```

3. **檢查資源驗證**
   ```javascript
   // 檢查庫是否正確載入
   console.log('QRCode 可用:', typeof QRCode !== 'undefined');
   console.log('Pako 可用:', typeof pako !== 'undefined');
   ```

## 版本更新

### v1.0 (當前版本)
- ✅ 基本 CDN 容錯載入功能
- ✅ JavaScript 和 CSS 資源支援
- ✅ 載入狀態監控
- ✅ 防重複載入機制
- ✅ 完整的錯誤處理

### 未來計劃
- 🔄 資源版本管理
- 🔄 更多 CDN 來源支援
- 🔄 載入效能分析
- 🔄 自動重試機制

---

**注意**: 確保本地 `lib/` 檔案夾中有完整的容錯檔案，以提供最佳的使用者體驗。
