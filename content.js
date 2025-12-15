// Content script - 處理 DOM 操作和截圖邏輯

let currentMode = null;
let selectionOverlay = null;
let isSelecting = false;
let startPoint = { x: 0, y: 0 };
let highlightedElement = null;

// 監聽來自 background script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    currentMode = request.mode;
    startCapture(request.mode);
  }
  return true;
});

// 開始截圖流程
async function startCapture(mode) {
  try {
    switch (mode) {
      case 'visible':
        await captureVisible();
        break;
      case 'fullpage':
        await captureFullPage();
        break;
      case 'area':
        startAreaSelection();
        break;
      case 'element':
        startElementSelection();
        break;
    }
  } catch (error) {
    console.error('Capture error:', error);
    alert('截圖失敗：' + error.message);
  }
}

// C1: 可見區域截圖
async function captureVisible() {
  // 獲取 DPI 縮放比例
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 使用實際像素尺寸
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  // 使用 Chrome API 擷取畫面
  await captureCurrentView(canvas, ctx, dpr);

  sendToEditor(canvas);
}

// C2: 完整網頁長截圖
async function captureFullPage() {
  const originalScrollTop = window.scrollY;
  const originalScrollLeft = window.scrollX;

  // 獲取 DPI 縮放比例
  const dpr = window.devicePixelRatio || 1;

  // 顯示載入提示
  showLoadingOverlay('正在擷取完整網頁...');

  try {
    const pageHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    const pageWidth = Math.max(
      document.body.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth
    );

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // 建立最終的 canvas（使用實際像素）
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = pageWidth * dpr;
    finalCanvas.height = pageHeight * dpr;
    const finalCtx = finalCanvas.getContext('2d');

    // 計算需要捲動的次數
    const scrollSteps = Math.ceil(pageHeight / viewportHeight);

    // 捲動並擷取每個部分
    for (let i = 0; i < scrollSteps; i++) {
      const scrollTop = i * viewportHeight;
      window.scrollTo(0, scrollTop);

      // 等待頁面穩定
      await new Promise(resolve => setTimeout(resolve, 300));

      // 擷取當前視窗（使用實際像素）
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = viewportWidth * dpr;
      tempCanvas.height = viewportHeight * dpr;
      const tempCtx = tempCanvas.getContext('2d');

      await captureCurrentView(tempCanvas, tempCtx, dpr);

      // 將此部分繪製到最終 canvas（使用實際像素位置）
      finalCtx.drawImage(tempCanvas, 0, scrollTop * dpr);

      updateLoadingProgress((i + 1) / scrollSteps);
    }

    // 恢復原始捲動位置
    window.scrollTo(originalScrollLeft, originalScrollTop);
    hideLoadingOverlay();

    sendToEditor(finalCanvas);
  } catch (error) {
    window.scrollTo(originalScrollLeft, originalScrollTop);
    hideLoadingOverlay();
    throw error;
  }
}

// C3: 選定區域截圖
function startAreaSelection() {
  createSelectionOverlay();

  document.addEventListener('mousedown', onAreaSelectionStart);
  document.addEventListener('mousemove', onAreaSelectionMove);
  document.addEventListener('mouseup', onAreaSelectionEnd);
  document.addEventListener('keydown', onAreaSelectionCancel);
}

function createSelectionOverlay() {
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = 'scrollshot-selection-overlay';
  selectionOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    cursor: crosshair;
    z-index: 2147483647;
  `;

  const selectionBox = document.createElement('div');
  selectionBox.id = 'scrollshot-selection-box';
  selectionBox.style.cssText = `
    position: absolute;
    border: 2px solid #667eea;
    background: rgba(102, 126, 234, 0.1);
    display: none;
  `;

  selectionOverlay.appendChild(selectionBox);
  document.body.appendChild(selectionOverlay);
}

function onAreaSelectionStart(e) {
  if (e.target !== selectionOverlay && e.target.parentElement !== selectionOverlay) return;

  isSelecting = true;
  startPoint = { x: e.clientX, y: e.clientY };

  const selectionBox = document.getElementById('scrollshot-selection-box');
  selectionBox.style.left = startPoint.x + 'px';
  selectionBox.style.top = startPoint.y + 'px';
  selectionBox.style.width = '0';
  selectionBox.style.height = '0';
  selectionBox.style.display = 'block';
}

function onAreaSelectionMove(e) {
  if (!isSelecting) return;

  const selectionBox = document.getElementById('scrollshot-selection-box');
  const currentX = e.clientX;
  const currentY = e.clientY;

  const left = Math.min(startPoint.x, currentX);
  const top = Math.min(startPoint.y, currentY);
  const width = Math.abs(currentX - startPoint.x);
  const height = Math.abs(currentY - startPoint.y);

  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
}

async function onAreaSelectionEnd(e) {
  if (!isSelecting) return;

  isSelecting = false;

  const selectionBox = document.getElementById('scrollshot-selection-box');
  const rect = selectionBox.getBoundingClientRect();

  // 移除選擇覆蓋層
  removeSelectionListeners();
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }

  // 如果選擇區域太小，取消截圖
  if (rect.width < 10 || rect.height < 10) {
    return;
  }

  // 擷取選定區域
  await captureArea(rect.left, rect.top, rect.width, rect.height);
}

function onAreaSelectionCancel(e) {
  if (e.key === 'Escape') {
    removeSelectionListeners();
    if (selectionOverlay) {
      selectionOverlay.remove();
      selectionOverlay = null;
    }
  }
}

function removeSelectionListeners() {
  document.removeEventListener('mousedown', onAreaSelectionStart);
  document.removeEventListener('mousemove', onAreaSelectionMove);
  document.removeEventListener('mouseup', onAreaSelectionEnd);
  document.removeEventListener('keydown', onAreaSelectionCancel);
}

async function captureArea(x, y, width, height) {
  // 獲取 DPI 縮放比例
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');

  // 先擷取完整可見區域，然後裁剪
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = window.innerWidth * dpr;
  tempCanvas.height = window.innerHeight * dpr;
  const tempCtx = tempCanvas.getContext('2d');

  await captureCurrentView(tempCanvas, tempCtx, dpr);

  // 裁剪選定區域（使用實際像素）
  ctx.drawImage(
    tempCanvas,
    x * dpr, y * dpr, width * dpr, height * dpr,
    0, 0, width * dpr, height * dpr
  );

  sendToEditor(canvas);
}

// C4: 元素截圖
function startElementSelection() {
  createElementOverlay();
  document.addEventListener('mousemove', onElementHover);
  document.addEventListener('click', onElementClick);
  document.addEventListener('keydown', onElementCancel);
}

function createElementOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'scrollshot-element-overlay';
  overlay.style.cssText = `
    position: absolute;
    border: 2px solid #667eea;
    background: rgba(102, 126, 234, 0.1);
    pointer-events: none;
    z-index: 2147483646;
    display: none;
  `;
  document.body.appendChild(overlay);
}

function onElementHover(e) {
  const overlay = document.getElementById('scrollshot-element-overlay');
  if (!overlay) return;

  const element = e.target;
  if (element.id === 'scrollshot-element-overlay') return;

  const rect = element.getBoundingClientRect();

  overlay.style.display = 'block';
  overlay.style.left = (rect.left + window.scrollX) + 'px';
  overlay.style.top = (rect.top + window.scrollY) + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';

  highlightedElement = element;
}

async function onElementClick(e) {
  e.preventDefault();
  e.stopPropagation();

  if (!highlightedElement) return;

  const element = highlightedElement;
  const rect = element.getBoundingClientRect();

  // 移除元素選擇監聽器
  removeElementListeners();

  // 擷取元素
  await captureElement(element, rect);
}

function onElementCancel(e) {
  if (e.key === 'Escape') {
    removeElementListeners();
  }
}

function removeElementListeners() {
  document.removeEventListener('mousemove', onElementHover);
  document.removeEventListener('click', onElementClick);
  document.removeEventListener('keydown', onElementCancel);

  const overlay = document.getElementById('scrollshot-element-overlay');
  if (overlay) {
    overlay.remove();
  }

  highlightedElement = null;
}

async function captureElement(element, rect) {
  // 獲取 DPI 縮放比例
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement('canvas');
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');

  // 使用 html2canvas 或類似方法擷取元素
  // 這裡使用簡化的方法
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = window.innerWidth * dpr;
  tempCanvas.height = window.innerHeight * dpr;
  const tempCtx = tempCanvas.getContext('2d');

  await captureCurrentView(tempCanvas, tempCtx, dpr);

  // 裁剪元素區域（使用實際像素）
  ctx.drawImage(
    tempCanvas,
    rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr,
    0, 0, rect.width * dpr, rect.height * dpr
  );

  sendToEditor(canvas);
}

// 輔助函數：擷取當前視窗畫面
async function captureCurrentView(canvas, ctx, dpr = 1) {
  // 使用 Chrome API 擷取畫面
  // 注意：這個方法需要在 background script 中執行
  // 這裡我們使用 DOM 轉圖片的方法

  return new Promise((resolve) => {
    // 使用 html2canvas 庫（需要額外引入）
    // 或者發送消息到 background script 使用 chrome.tabs.captureVisibleTab

    // 這裡我們使用消息傳遞方式
    chrome.runtime.sendMessage({ action: 'captureTab' }, (response) => {
      if (response && response.dataUrl) {
        const img = new Image();
        img.onload = () => {
          // Chrome 的 captureVisibleTab 已經返回實際像素大小的圖片
          // 直接繪製到 canvas（canvas 已經是實際像素大小）
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve();
        };
        img.src = response.dataUrl;
      } else {
        resolve();
      }
    });
  });
}

// 發送截圖到編輯器
function sendToEditor(canvas) {
  const imageData = canvas.toDataURL('image/png');

  chrome.runtime.sendMessage({
    action: 'openEditor',
    imageData: imageData,
    width: canvas.width,
    height: canvas.height
  });
}

// 載入覆蓋層
function showLoadingOverlay(message) {
  const overlay = document.createElement('div');
  overlay.id = 'scrollshot-loading-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 18px;
  `;

  const content = document.createElement('div');
  content.innerHTML = `
    <div style="text-align: center;">
      <div style="margin-bottom: 20px;">${message}</div>
      <div id="scrollshot-progress-bar" style="width: 300px; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;">
        <div id="scrollshot-progress-fill" style="width: 0%; height: 100%; background: #667eea; transition: width 0.3s;"></div>
      </div>
    </div>
  `;

  overlay.appendChild(content);
  document.body.appendChild(overlay);
}

function updateLoadingProgress(progress) {
  const fill = document.getElementById('scrollshot-progress-fill');
  if (fill) {
    fill.style.width = (progress * 100) + '%';
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('scrollshot-loading-overlay');
  if (overlay) {
    overlay.remove();
  }
}
