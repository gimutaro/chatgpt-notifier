// ポップアップのJavaScript

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('notification-toggle');
  const status = document.getElementById('status');
  const testButton = document.getElementById('test-notification');
  
  // 保存されている設定を読み込む
  chrome.storage.sync.get(['notificationsEnabled'], function(result) {
    // チェックボックスの状態を設定
    toggle.checked = result.notificationsEnabled !== false;
    updateStatus(toggle.checked);
  });
  
  // トグル変更時のイベントリスナー
  toggle.addEventListener('change', function() {
    // 設定を保存
    chrome.storage.sync.set({ notificationsEnabled: toggle.checked }, function() {
      updateStatus(toggle.checked);
    });
  });
  
  // テスト通知ボタンのイベントリスナー
  testButton.addEventListener('click', function() {
    chrome.runtime.sendMessage({
      action: "sendNotification",
      title: "ChatGPT通知テスト",
      message: "これはテスト通知です。通知機能は正常に動作しています。"
    }, function(response) {
      console.log('テスト通知応答:', response);
    });
  });
  
  // ステータステキストを更新する関数
  function updateStatus(enabled) {
    if (enabled) {
      status.textContent = '通知はオンです。ChatGPTが回答を完了すると通知が届きます。';
    } else {
      status.textContent = '通知はオフです。設定を変更するには上のスイッチをオンにしてください。';
    }
  }
});