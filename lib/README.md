# 本地庫文件說明

此目錄包含 DEMATEL 問卷系統所需的所有外部庫文件，已從 CDN 下載到本地以確保離線可用性。

## JavaScript 庫

### QRCode.js (v1.5.3)
- **文件**: `qrcode.min.js` (28.5 KB)
- **來源**: https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js
- **用途**: 生成 QR Code
- **授權**: MIT License

### Pako (v2.1.0)
- **文件**: `pako.min.js` (46.9 KB)
- **來源**: https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js
- **用途**: deflate 壓縮/解壓縮
- **授權**: MIT License

## 字體

### Noto Sans TC (Google Fonts)
- **來源**: Google Fonts
- **用途**: 中文（繁體）網頁字體
- **授權**: SIL Open Font License

#### 字重文件:
- `noto-sans-tc-300.ttf` - Light (7.0 MB)
- `noto-sans-tc-400.ttf` - Regular (7.0 MB) 
- `noto-sans-tc-500.ttf` - Medium (7.0 MB)
- `noto-sans-tc-700.ttf` - Bold (7.0 MB)

#### CSS 配置:
- `noto-sans-tc.css` - 字體 CSS 定義文件，已修改為使用本地字體路徑

## 使用方式

系統會自動載入這些本地庫文件，無需網路連線。如需更新，可以重新從對應的 CDN 下載最新版本。

## 總大小

- JavaScript 庫: ~76 KB
- 字體文件: ~28 MB
- 總計: ~28.1 MB

## 更新日期

2025-07-29
