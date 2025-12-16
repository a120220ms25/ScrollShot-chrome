// Editor.js - 截圖編輯器核心邏輯

// 全局變數
let mainCanvas, drawingCanvas, mainCtx, drawingCtx;
let currentTool = 'select';
let isDrawing = false;
let startX, startY;
let currentColor = '#667eea';
let currentStrokeWidth = 4;
let currentFontSize = 16;
let fillShape = false;
let zoomLevel = 1;

// 歷史記錄（用於撤銷/重做）
let history = [];
let historyStep = -1;

// 繪圖對象列表
let objects = [];

// 當前編輯的對象
let selectedObject = null;

// 文字框相關
let activeTextBox = null;
let isDraggingText = false;
let isResizingText = false;
let textDragStart = { x: 0, y: 0 };
let textBoxes = [];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 獲取 canvas 元素
  mainCanvas = document.getElementById('mainCanvas');
  drawingCanvas = document.getElementById('drawingCanvas');
  mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });
  drawingCtx = drawingCanvas.getContext('2d', { willReadFrequently: true });

  // 載入截圖數據
  await loadImage();

  // 初始化工具列事件
  initToolbar();

  // 初始化畫布事件
  initCanvas();

  // 初始化快捷鍵
  initKeyboardShortcuts();

  // 設置初始工具
  selectTool('select');
});

// 載入截圖圖片
async function loadImage() {
  try {
    const data = await chrome.storage.local.get('currentImage');

    if (data.currentImage) {
      const img = new Image();
      img.onload = () => {
        // 設置 canvas 尺寸
        mainCanvas.width = data.currentImage.width;
        mainCanvas.height = data.currentImage.height;
        drawingCanvas.width = data.currentImage.width;
        drawingCanvas.height = data.currentImage.height;

        // 繪製原始圖片
        mainCtx.drawImage(img, 0, 0);

        // 保存初始狀態到歷史記錄
        saveState();

        // 調整視窗以適應圖片
        adjustCanvasView();
      };
      img.src = data.currentImage.data;
    } else {
      alert('無法載入圖片數據');
    }
  } catch (error) {
    console.error('Error loading image:', error);
    alert('載入圖片失敗：' + error.message);
  }
}

// 調整畫布視圖
function adjustCanvasView() {
  const container = document.getElementById('canvasContainer');
  const wrapper = document.getElementById('canvasWrapper');

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const canvasWidth = mainCanvas.width;
  const canvasHeight = mainCanvas.height;

  // 計算適合的縮放比例
  const scaleX = (containerWidth - 40) / canvasWidth;
  const scaleY = (containerHeight - 40) / canvasHeight;
  const scale = Math.min(scaleX, scaleY, 1);

  if (scale < 1) {
    zoomLevel = scale;
    updateZoom();
  }
}

// 初始化工具列
function initToolbar() {
  // 工具按鈕
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool) {
        selectTool(tool);
      }
    });
  });

  // 顏色選擇器
  const colorPicker = document.getElementById('colorPicker');
  const colorPreview = document.getElementById('colorPreview');
  colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    colorPreview.style.background = currentColor;
  });

  // 線條粗細
  document.getElementById('strokeWidth').addEventListener('change', (e) => {
    currentStrokeWidth = parseInt(e.target.value);
  });

  // 字體大小
  document.getElementById('fontSize').addEventListener('change', (e) => {
    currentFontSize = parseInt(e.target.value);
  });

  // 填充選項
  document.getElementById('fillShape').addEventListener('change', (e) => {
    fillShape = e.target.checked;
  });

  // 撤銷/重做
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);

  // 縮放
  document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
  document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
  document.getElementById('resetZoomBtn').addEventListener('click', resetZoom);

  // 複製和下載
  document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
  document.getElementById('downloadBtn').addEventListener('click', downloadImage);

  // 文字輸入
  document.getElementById('textConfirmBtn').addEventListener('click', confirmText);
  document.getElementById('textCancelBtn').addEventListener('click', cancelText);
}

// 選擇工具
function selectTool(tool) {
  currentTool = tool;

  // 更新按鈕狀態
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const toolBtn = document.querySelector(`[data-tool="${tool}"]`);
  if (toolBtn) {
    toolBtn.classList.add('active');
  }

  // 設置游標
  if (tool === 'select') {
    drawingCanvas.style.cursor = 'default';
  } else if (tool === 'text') {
    drawingCanvas.style.cursor = 'text';
  } else {
    drawingCanvas.style.cursor = 'crosshair';
  }
}

// 初始化畫布事件
function initCanvas() {
  drawingCanvas.addEventListener('mousedown', handleMouseDown);
  drawingCanvas.addEventListener('mousemove', handleMouseMove);
  drawingCanvas.addEventListener('mouseup', handleMouseUp);
  drawingCanvas.addEventListener('mouseleave', handleMouseUp);
}

// 滑鼠按下
function handleMouseDown(e) {
  const rect = drawingCanvas.getBoundingClientRect();
  startX = (e.clientX - rect.left) / zoomLevel;
  startY = (e.clientY - rect.top) / zoomLevel;

  if (currentTool === 'text') {
    showTextInput(startX, startY);
    return;
  }

  if (currentTool === 'select') {
    return;
  }

  isDrawing = true;
}

// 滑鼠移動
function handleMouseMove(e) {
  if (!isDrawing) return;

  const rect = drawingCanvas.getBoundingClientRect();
  const currentX = (e.clientX - rect.left) / zoomLevel;
  const currentY = (e.clientY - rect.top) / zoomLevel;

  // 清除繪圖層
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

  // 繪製預覽
  drawingCtx.strokeStyle = currentColor;
  drawingCtx.fillStyle = currentColor;
  drawingCtx.lineWidth = currentStrokeWidth;
  drawingCtx.lineCap = 'round';
  drawingCtx.lineJoin = 'round';

  switch (currentTool) {
    case 'arrow':
      drawArrow(drawingCtx, startX, startY, currentX, currentY);
      break;
    case 'line':
      drawingCtx.beginPath();
      drawingCtx.moveTo(startX, startY);
      drawingCtx.lineTo(currentX, currentY);
      drawingCtx.stroke();
      break;
    case 'rect':
      drawRect(drawingCtx, startX, startY, currentX - startX, currentY - startY);
      break;
    case 'circle':
      drawCircle(drawingCtx, startX, startY, currentX, currentY);
      break;
    case 'pixelate':
    case 'blur':
      drawRect(drawingCtx, startX, startY, currentX - startX, currentY - startY);
      break;
  }
}

// 滑鼠放開
function handleMouseUp(e) {
  if (!isDrawing) return;
  isDrawing = false;

  const rect = drawingCanvas.getBoundingClientRect();
  const endX = (e.clientX - rect.left) / zoomLevel;
  const endY = (e.clientY - rect.top) / zoomLevel;

  // 將繪製內容固化到主畫布
  commitDrawing(startX, startY, endX, endY);

  // 清除繪圖層
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
}

// 固化繪製
function commitDrawing(x1, y1, x2, y2) {
  mainCtx.strokeStyle = currentColor;
  mainCtx.fillStyle = currentColor;
  mainCtx.lineWidth = currentStrokeWidth;
  mainCtx.lineCap = 'round';
  mainCtx.lineJoin = 'round';

  switch (currentTool) {
    case 'arrow':
      drawArrow(mainCtx, x1, y1, x2, y2);
      break;
    case 'line':
      mainCtx.beginPath();
      mainCtx.moveTo(x1, y1);
      mainCtx.lineTo(x2, y2);
      mainCtx.stroke();
      break;
    case 'rect':
      drawRect(mainCtx, x1, y1, x2 - x1, y2 - y1);
      break;
    case 'circle':
      drawCircle(mainCtx, x1, y1, x2, y2);
      break;
    case 'pixelate':
      applyPixelate(x1, y1, x2, y2);
      break;
    case 'blur':
      applyBlur(x1, y1, x2, y2);
      break;
  }

  // 保存狀態
  saveState();
}

// 繪製箭頭
function drawArrow(ctx, x1, y1, x2, y2) {
  const headLength = 15;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // 繪製線條
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // 繪製箭頭
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

// 繪製矩形
function drawRect(ctx, x, y, width, height) {
  if (fillShape) {
    ctx.fillRect(x, y, width, height);
  } else {
    ctx.strokeRect(x, y, width, height);
  }
}

// 繪製圓形
function drawCircle(ctx, x1, y1, x2, y2) {
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const radiusX = Math.abs(x2 - x1) / 2;
  const radiusY = Math.abs(y2 - y1) / 2;

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);

  if (fillShape) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

// 應用馬賽克效果
function applyPixelate(x1, y1, x2, y2) {
  const pixelSize = 10;

  // 確保坐標正確
  const startX = Math.min(x1, x2);
  const startY = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  // 獲取圖像數據
  const imageData = mainCtx.getImageData(startX, startY, width, height);
  const data = imageData.data;

  // 應用像素化
  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      // 計算該區塊的平均顏色
      let r = 0, g = 0, b = 0, count = 0;

      for (let py = 0; py < pixelSize && y + py < height; py++) {
        for (let px = 0; px < pixelSize && x + px < width; px++) {
          const index = ((y + py) * width + (x + px)) * 4;
          r += data[index];
          g += data[index + 1];
          b += data[index + 2];
          count++;
        }
      }

      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);

      // 填充該區塊
      for (let py = 0; py < pixelSize && y + py < height; py++) {
        for (let px = 0; px < pixelSize && x + px < width; px++) {
          const index = ((y + py) * width + (x + px)) * 4;
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
        }
      }
    }
  }

  // 將處理後的數據放回畫布
  mainCtx.putImageData(imageData, startX, startY);
}

// 應用模糊效果
function applyBlur(x1, y1, x2, y2) {
  const startX = Math.min(x1, x2);
  const startY = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  // 獲取圖像數據
  const imageData = mainCtx.getImageData(startX, startY, width, height);

  // 應用簡單的盒式模糊
  const blurred = boxBlur(imageData, 5);

  // 將處理後的數據放回畫布
  mainCtx.putImageData(blurred, startX, startY);
}

// 盒式模糊演算法
function boxBlur(imageData, radius) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;

      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const px = x + kx;
          const py = y + ky;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const index = (py * width + px) * 4;
            r += data[index];
            g += data[index + 1];
            b += data[index + 2];
            count++;
          }
        }
      }

      const index = (y * width + x) * 4;
      output[index] = r / count;
      output[index + 1] = g / count;
      output[index + 2] = b / count;
      output[index + 3] = data[index + 3];
    }
  }

  return new ImageData(output, width, height);
}

// 顯示文字輸入框（新版：直接在畫面上編輯）
function showTextInput(x, y) {
  // 創建新的可編輯文字框
  const textBoxContainer = document.createElement('div');
  textBoxContainer.className = 'editable-text-box';
  textBoxContainer.style.cssText = `
    position: absolute;
    left: ${x * zoomLevel + drawingCanvas.offsetLeft}px;
    top: ${y * zoomLevel + drawingCanvas.offsetTop}px;
    min-width: 100px;
    min-height: 30px;
    border: 2px dashed ${currentColor};
    background: rgba(255, 255, 255, 0.9);
    padding: 5px;
    cursor: move;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;

  const textInput = document.createElement('div');
  textInput.className = 'text-content';
  textInput.contentEditable = true;
  textInput.style.cssText = `
    outline: none;
    color: ${currentColor};
    font-size: ${currentFontSize}px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    white-space: pre-wrap;
    word-wrap: break-word;
    min-width: 90px;
  `;
  textInput.textContent = '輸入文字...';

  // 添加控制按鈕
  const controls = document.createElement('div');
  controls.className = 'text-controls';
  controls.style.cssText = `
    position: absolute;
    bottom: -35px;
    left: 0;
    display: flex;
    gap: 5px;
    background: white;
    padding: 5px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  `;

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '✓';
  confirmBtn.style.cssText = `
    padding: 5px 10px;
    background: #48bb78;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕';
  cancelBtn.style.cssText = `
    padding: 5px 10px;
    background: #f56565;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;

  // 添加調整大小的控制點
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'resize-handle';
  resizeHandle.style.cssText = `
    position: absolute;
    bottom: -5px;
    right: -5px;
    width: 10px;
    height: 10px;
    background: ${currentColor};
    border: 1px solid white;
    cursor: nwse-resize;
    z-index: 1001;
  `;

  controls.appendChild(confirmBtn);
  controls.appendChild(cancelBtn);
  textBoxContainer.appendChild(textInput);
  textBoxContainer.appendChild(controls);
  textBoxContainer.appendChild(resizeHandle);
  document.body.appendChild(textBoxContainer);

  // 儲存數據
  textBoxContainer.dataset.x = x;
  textBoxContainer.dataset.y = y;
  activeTextBox = textBoxContainer;

  // 選中文字
  textInput.focus();
  textInput.select();

  // 事件處理
  let dragStartX, dragStartY, boxStartX, boxStartY;
  let resizeStartX, resizeStartY, boxStartWidth, boxStartHeight;

  // 拖動文字框
  textBoxContainer.addEventListener('mousedown', (e) => {
    if (e.target === textInput || e.target === resizeHandle) return;

    isDraggingText = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = textBoxContainer.getBoundingClientRect();
    boxStartX = rect.left;
    boxStartY = rect.top;
    e.preventDefault();
  });

  // 調整大小
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizingText = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    const rect = textBoxContainer.getBoundingClientRect();
    boxStartWidth = rect.width;
    boxStartHeight = rect.height;
    e.stopPropagation();
    e.preventDefault();
  });

  document.addEventListener('mousemove', handleTextDrag);
  document.addEventListener('mouseup', handleTextDragEnd);

  // 確認按鈕
  confirmBtn.addEventListener('click', () => {
    confirmEditableText(textBoxContainer, textInput);
  });

  // 取消按鈕
  cancelBtn.addEventListener('click', () => {
    textBoxContainer.remove();
    activeTextBox = null;
  });

  // Enter 確認，Esc 取消
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      textBoxContainer.remove();
      activeTextBox = null;
    }
  });

  function handleTextDrag(e) {
    if (isDraggingText) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      textBoxContainer.style.left = (boxStartX + dx) + 'px';
      textBoxContainer.style.top = (boxStartY + dy) + 'px';
    } else if (isResizingText) {
      const dx = e.clientX - resizeStartX;
      const dy = e.clientY - resizeStartY;
      const newWidth = Math.max(100, boxStartWidth + dx);
      const newHeight = Math.max(30, boxStartHeight + dy);
      textBoxContainer.style.width = newWidth + 'px';
      textBoxContainer.style.height = newHeight + 'px';
    }
  }

  function handleTextDragEnd() {
    isDraggingText = false;
    isResizingText = false;
  }
}

// 確認可編輯文字
function confirmEditableText(textBoxContainer, textInput) {
  const text = textInput.textContent.trim();

  if (text && text !== '輸入文字...') {
    // 計算實際位置（考慮縮放）
    const rect = textBoxContainer.getBoundingClientRect();
    const canvasRect = drawingCanvas.getBoundingClientRect();

    const x = (rect.left - canvasRect.left) / zoomLevel;
    const y = (rect.top - canvasRect.top + 20) / zoomLevel; // +20 調整基線

    // 繪製文字到主畫布
    mainCtx.fillStyle = currentColor;
    mainCtx.font = `${currentFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

    // 處理多行文字
    const lines = text.split('\n');
    const lineHeight = currentFontSize * 1.2;

    lines.forEach((line, index) => {
      mainCtx.fillText(line, x, y + (index * lineHeight));
    });

    // 保存狀態
    saveState();
  }

  // 移除文字框
  textBoxContainer.remove();
  activeTextBox = null;
}

// 確認文字輸入（保留舊的接口）
function confirmText() {
  if (activeTextBox) {
    const textInput = activeTextBox.querySelector('.text-content');
    confirmEditableText(activeTextBox, textInput);
  }
}

// 取消文字輸入
function cancelText() {
  if (activeTextBox) {
    activeTextBox.remove();
    activeTextBox = null;
  }
}

// 保存狀態到歷史記錄
function saveState() {
  // 移除當前步驟之後的歷史
  history = history.slice(0, historyStep + 1);

  // 保存當前狀態
  const imageData = mainCanvas.toDataURL('image/png');
  history.push(imageData);
  historyStep++;

  // 限制歷史記錄數量
  if (history.length > 50) {
    history.shift();
    historyStep--;
  }

  updateUndoRedoButtons();
}

// 撤銷
function undo() {
  if (historyStep > 0) {
    historyStep--;
    loadHistoryState(history[historyStep]);
    updateUndoRedoButtons();
  }
}

// 重做
function redo() {
  if (historyStep < history.length - 1) {
    historyStep++;
    loadHistoryState(history[historyStep]);
    updateUndoRedoButtons();
  }
}

// 載入歷史狀態
function loadHistoryState(dataUrl) {
  const img = new Image();
  img.onload = () => {
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.drawImage(img, 0, 0);
  };
  img.src = dataUrl;
}

// 更新撤銷/重做按鈕狀態
function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');

  undoBtn.disabled = historyStep <= 0;
  redoBtn.disabled = historyStep >= history.length - 1;

  if (undoBtn.disabled) {
    undoBtn.style.opacity = '0.5';
    undoBtn.style.cursor = 'not-allowed';
  } else {
    undoBtn.style.opacity = '1';
    undoBtn.style.cursor = 'pointer';
  }

  if (redoBtn.disabled) {
    redoBtn.style.opacity = '0.5';
    redoBtn.style.cursor = 'not-allowed';
  } else {
    redoBtn.style.opacity = '1';
    redoBtn.style.cursor = 'pointer';
  }
}

// 縮放功能
function zoomIn() {
  zoomLevel = Math.min(zoomLevel * 1.2, 5);
  updateZoom();
}

function zoomOut() {
  zoomLevel = Math.max(zoomLevel / 1.2, 0.1);
  updateZoom();
}

function resetZoom() {
  zoomLevel = 1;
  updateZoom();
}

function updateZoom() {
  const wrapper = document.getElementById('canvasWrapper');
  wrapper.style.transform = `scale(${zoomLevel})`;

  const resetBtn = document.getElementById('resetZoomBtn');
  resetBtn.textContent = Math.round(zoomLevel * 100) + '%';
}

// 複製到剪貼簿
async function copyToClipboard() {
  try {
    const blob = await new Promise(resolve => {
      mainCanvas.toBlob(resolve, 'image/png');
    });

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);

    showNotification('已複製到剪貼簿');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    alert('複製失敗：' + error.message);
  }
}

// 下載圖片
function downloadImage() {
  const dataUrl = mainCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  link.download = `ScrollShot-${timestamp}.png`;
  link.href = dataUrl;
  link.click();

  showNotification('圖片已下載');
}

// 顯示通知
function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    animation: fadeInOut 2s ease-in-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2000);
}

// 快捷鍵
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Z: 撤銷
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }

    // Ctrl/Cmd + Y 或 Ctrl/Cmd + Shift + Z: 重做
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }

    // Ctrl/Cmd + S: 下載
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      downloadImage();
    }

    // Ctrl/Cmd + C: 複製
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      copyToClipboard();
    }

    // Escape: 取消當前操作
    if (e.key === 'Escape') {
      cancelText();
      selectTool('select');
    }
  });
}

// CSS 動畫（通知淡入淡出）
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    85% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  }
`;
document.head.appendChild(style);
