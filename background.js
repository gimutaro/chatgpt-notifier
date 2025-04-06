// バックグラウンドスクリプト
console.log('ChatGPT通知: バックグラウンドスクリプトが読み込まれました');

// 初期設定を保存
chrome.runtime.onInstalled.addListener(() => {
  console.log('ChatGPT通知: 拡張機能がインストールされました');
  
  chrome.storage.sync.set({ notificationsEnabled: true }, () => {
    console.log('ChatGPT通知: 通知設定が初期化されました (デフォルト: オン)');
  });
  
  // ウェルカム通知
  setTimeout(() => {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'ChatGPT通知ツール',
      message: 'インストールありがとうございます！ChatGPTの回答が完了すると通知でお知らせします。',
      priority: 2
    });
  }, 2000);
});

// メッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('ChatGPT通知: メッセージを受信:', message);
  
  if (message.action === "sendNotification") {
    // 通知を表示
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: message.title,
      message: message.message,
      priority: 2
    }, (notificationId) => {
      console.log('ChatGPT通知: 通知が送信されました (ID=' + notificationId + ')');
      
      if (chrome.runtime.lastError) {
        console.error('ChatGPT通知: エラー:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, id: notificationId });
      }
    });
    
    // 非同期応答のためにtrueを返す
    return true;
  }
  
  // デフォルトの応答
  sendResponse({ success: false, error: '未知のアクション' });
  return false;
});