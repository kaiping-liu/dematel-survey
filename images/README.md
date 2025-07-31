# DEMATEL 問卷系統 - 圖片支援功能

## 功能說明

現在您可以在 `dematel-structure.json` 的說明內容中添加圖片！

## 使用方法

1. 將圖片文件放置在 `images/` 目錄中
2. 在 `dematel-structure.json` 的 `說明.內容` 數組中，添加圖片路徑

## 支援的圖片格式

- .jpg / .jpeg
- .png
- .gif
- .webp
- .svg
- .bmp

## 範例

```json
{
  "說明": {
    "標題": "DEMATEL問卷調查說明",
    "內容": [
      "歡迎參與問卷調查！",
      "images/survey-diagram.png",
      "以下是詳細說明..."
    ]
  }
}
```

## 圖片樣式特色

- 自動適應螢幕寶度
- 圓角設計
- 陰影效果
- 滑鼠懸停放大效果
- 響應式設計（手機友善）

## 注意事項

- 圖片路徑區分大小寫
- 建議使用相對路徑（如 `images/filename.png`）
- 圖片將居中顯示
- 建議圖片寬度不超過 800px 以獲得最佳體驗
