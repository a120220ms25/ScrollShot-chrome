// Background script - 處理事件監聽器、快捷鍵和 API 呼叫

// 監聽擴充功能安裝事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('ScrollShot 擴充功能已安裝');

  // 建立右鍵選單
  chrome.contextMenus.create({
    id: 'scrollshot-menu',
    title: 'ScrollShot 截圖',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'capture-visible',
    parentId: 'scrollshot-menu',
    title: '可見區域截圖',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'capture-fullpage',
    parentId: 'scrollshot-menu',
    title: '完整網頁截圖',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'capture-area',
    parentId: 'scrollshot-menu',
    title: '選定區域截圖',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'capture-element',
    parentId: 'scrollshot-menu',
    title: '元素截圖',
    contexts: ['page']
  });
});

// 監聽右鍵選單點擊
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const mode = info.menuItemId.replace('capture-', '');
  if (['visible', 'fullpage', 'area', 'element'].includes(mode)) {
    handleCapture(mode, tab.id);
  }
});

// 監聽快捷鍵
chrome.commands.onCommand.addListener((command) => {
  const commandMap = {
    'capture-visible': 'visible',
    'capture-full-page': 'fullpage',
    'capture-area': 'area',
    'capture-element': 'element'
  };

  const mode = commandMap[command];
  if (mode) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        handleCapture(mode, tabs[0].id);
      }
    });
  }
});

// 監聽來自 popup 和 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture') {
    handleCapture(request.mode, request.tabId);
  } else if (request.action === 'openEditor') {
    openEditor(request.imageData, request.width, request.height);
  } else if (request.action === 'captureTab') {
    // 擷取可見標籤頁並返回數據
    captureVisibleTab().then(dataUrl => {
      sendResponse({ dataUrl: dataUrl });
    }).catch(error => {
      console.error('Error capturing tab:', error);
      sendResponse({ dataUrl: null });
    });
    return true; // 保持消息通道開啟以進行異步響應
  }
  return true;
});

// 擷取可見標籤頁
async function captureVisibleTab() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });
    return dataUrl;
  } catch (error) {
    console.error('Error in captureVisibleTab:', error);
    throw error;
  }
}

// 處理截圖請求
async function handleCapture(mode, tabId) {
  try {
    // 注入 content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    // 發送截圖命令到 content script
    chrome.tabs.sendMessage(tabId, {
      action: 'startCapture',
      mode: mode
    });
  } catch (error) {
    console.error('Error handling capture:', error);
  }
}

// 開啟編輯器視窗
function openEditor(imageData, width, height) {
  const editorUrl = chrome.runtime.getURL('editor.html');

  // 計算視窗尺寸
  const windowWidth = Math.min(width + 400, 1400);
  const windowHeight = Math.min(height + 200, 900);

  // 建立新視窗
  chrome.windows.create({
    url: editorUrl,
    type: 'popup',
    width: windowWidth,
    height: windowHeight,
    focused: true
  }, () => {
    // 儲存圖片數據到 storage，供編輯器讀取
    chrome.storage.local.set({
      currentImage: {
        data: imageData,
        width: width,
        height: height,
        timestamp: Date.now()
      }
    });
  });
}
