// 處理 popup 選單的點擊事件

document.getElementById('captureVisible').addEventListener('click', () => {
  sendCaptureMessage('visible');
});

document.getElementById('captureFullPage').addEventListener('click', () => {
  sendCaptureMessage('fullpage');
});

document.getElementById('captureArea').addEventListener('click', () => {
  sendCaptureMessage('area');
});

document.getElementById('captureElement').addEventListener('click', () => {
  sendCaptureMessage('element');
});

async function sendCaptureMessage(mode) {
  try {
    // 獲取當前活動標籤
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 發送消息到 background script
    chrome.runtime.sendMessage({
      action: 'capture',
      mode: mode,
      tabId: tab.id
    });

    // 關閉 popup
    window.close();
  } catch (error) {
    console.error('Error sending capture message:', error);
  }
}
