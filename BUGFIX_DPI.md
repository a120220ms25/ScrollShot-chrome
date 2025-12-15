# 🔧 截圖大小問題修復說明

## 問題描述

截圖出來的尺寸不正確，特別是在高解析度螢幕（Retina 顯示器、4K 螢幕等）上，截圖可能會被拉伸或縮放。

## 問題原因

原代碼沒有考慮螢幕的 **DPI 縮放比例（devicePixelRatio）**。

### 技術細節

在高 DPI 螢幕上：
- `window.innerWidth` 返回的是**邏輯像素**（例如：1920px）
- `chrome.tabs.captureVisibleTab` 返回的是**實際像素**（例如：3840px，在 2x DPI 時）
- **devicePixelRatio** 就是實際像素與邏輯像素的比例

### 範例

| 螢幕類型 | devicePixelRatio | 邏輯尺寸 | 實際尺寸 |
|---------|------------------|---------|---------|
| 普通螢幕 | 1.0 | 1920x1080 | 1920x1080 |
| Retina (MacBook) | 2.0 | 1920x1080 | 3840x2160 |
| 4K 高 DPI | 2.5 | 1920x1080 | 4800x2700 |

## 已修復的功能

✅ **C1: 可見區域截圖** - 現在會正確處理 DPI
✅ **C2: 完整網頁長截圖** - 拼接時正確計算實際像素位置
✅ **C3: 選定區域截圖** - 裁剪時使用實際像素座標
✅ **C4: 元素截圖** - 元素邊界轉換為實際像素

## 修改內容

### 1. captureVisible() - 可見區域截圖
```javascript
// 修改前
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// 修改後
const dpr = window.devicePixelRatio || 1;
canvas.width = window.innerWidth * dpr;
canvas.height = window.innerHeight * dpr;
```

### 2. captureFullPage() - 完整網頁截圖
```javascript
// 修改前
finalCanvas.width = pageWidth;
finalCanvas.height = pageHeight;
finalCtx.drawImage(tempCanvas, 0, scrollTop);

// 修改後
const dpr = window.devicePixelRatio || 1;
finalCanvas.width = pageWidth * dpr;
finalCanvas.height = pageHeight * dpr;
finalCtx.drawImage(tempCanvas, 0, scrollTop * dpr);
```

### 3. captureArea() - 選定區域截圖
```javascript
// 修改前
canvas.width = width;
canvas.height = height;
ctx.drawImage(tempCanvas, x, y, width, height, 0, 0, width, height);

// 修改後
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
ctx.drawImage(
  tempCanvas,
  x * dpr, y * dpr, width * dpr, height * dpr,
  0, 0, width * dpr, height * dpr
);
```

### 4. captureElement() - 元素截圖
```javascript
// 修改前
canvas.width = rect.width;
canvas.height = rect.height;
ctx.drawImage(tempCanvas, rect.left, rect.top, ...);

// 修改後
const dpr = window.devicePixelRatio || 1;
canvas.width = rect.width * dpr;
canvas.height = rect.height * dpr;
ctx.drawImage(
  tempCanvas,
  rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr,
  ...
);
```

### 5. captureCurrentView() - 核心擷取函數
```javascript
// 修改前
async function captureCurrentView(canvas, ctx) {
  // ...
  ctx.drawImage(img, 0, 0);
}

// 修改後
async function captureCurrentView(canvas, ctx, dpr = 1) {
  // ...
  // Chrome 的 captureVisibleTab 已經返回實際像素大小
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}
```

## 如何應用修復

### 方法 1: 重新載入擴充功能（推薦）

1. **開啟擴充功能頁面**
   ```
   chrome://extensions/
   ```

2. **找到 ScrollShot**
   - 在擴充功能列表中找到 ScrollShot

3. **點擊重新載入按鈕**
   - 點擊 ScrollShot 卡片上的「重新載入」圖示 🔄
   - 或按 `Ctrl+R`（在擴充功能頁面）

4. **驗證修復**
   - 打開任意網頁
   - 按 `Alt+Shift+1` 截圖
   - 檢查截圖尺寸是否正確

### 方法 2: 重新安裝

如果重新載入後仍有問題：

1. 移除擴充功能
2. 重新載入 `chrome://extensions/` 頁面
3. 點擊「載入未封裝項目」
4. 選擇專案資料夾

## 測試驗證

### 測試 1: 檢查 DPI 縮放比例

在 Console 中執行（F12）：
```javascript
console.log('devicePixelRatio:', window.devicePixelRatio);
console.log('邏輯尺寸:', window.innerWidth, 'x', window.innerHeight);
console.log('實際尺寸:',
  window.innerWidth * window.devicePixelRatio, 'x',
  window.innerHeight * window.devicePixelRatio
);
```

### 測試 2: 驗證截圖尺寸

1. 打開任意網頁
2. 按 `Alt+Shift+1` 進行可見區域截圖
3. 在編輯器中下載圖片
4. 檢查下載的圖片尺寸：
   - 應該是**實際像素**（innerWidth × devicePixelRatio）
   - 不應該是邏輯像素

### 測試 3: 長截圖拼接

1. 打開 `demo.html`
2. 按 `Alt+Shift+2` 進行完整網頁截圖
3. 檢查拼接處是否有錯位或重疊
4. 應該看到完整、無縫的長截圖

## 預期結果

修復後，截圖應該：

✅ **尺寸正確** - 實際像素尺寸，不會被拉伸
✅ **清晰度佳** - 充分利用高 DPI 螢幕的解析度
✅ **拼接精確** - 長截圖無縫拼接，沒有錯位
✅ **裁剪準確** - 選定區域和元素截圖邊界精確

## 不同 DPI 下的表現

### 1x DPI（普通螢幕）
- 行為：與修復前相同
- 截圖尺寸 = 螢幕邏輯尺寸

### 2x DPI（MacBook Retina）
- 行為：截圖尺寸翻倍
- 1920x1080 邏輯尺寸 → 3840x2160 實際截圖
- 優點：圖片更清晰，細節更豐富

### 2.5x DPI（Windows 高 DPI）
- 行為：截圖尺寸為 2.5 倍
- 1920x1080 邏輯尺寸 → 4800x2700 實際截圖
- 優點：最大化利用螢幕解析度

## 常見問題

### Q: 為什麼截圖檔案變大了？

A: 這是正常的！在高 DPI 螢幕上，截圖現在包含更多像素（實際解析度），所以檔案會更大。但這也意味著截圖更清晰，包含更多細節。

### Q: 能否讓用戶選擇截圖解析度？

A: 可以在未來版本添加此功能。目前預設使用螢幕的實際解析度以確保最佳品質。

### Q: 在普通螢幕上會有影響嗎？

A: 不會。在 1x DPI 螢幕上（devicePixelRatio = 1），行為與修復前完全相同。

### Q: 修復後截圖速度會變慢嗎？

A: 處理更大的圖片確實需要稍多的時間和記憶體，但差異很小，通常不會被察覺。

## 版本資訊

- **修復日期**: 2024-12-15
- **版本**: 1.0.1
- **受影響檔案**: `content.js`
- **修改行數**: ~50 行

## 相關技術文件

- [MDN: Window.devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
- [Chrome Extension: captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/tabs/#method-captureVisibleTab)
- [HTML Canvas: drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)

---

**修復已完成！請重新載入擴充功能以應用變更。** 🎉
