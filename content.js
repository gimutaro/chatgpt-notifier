// ChatGPT通知拡張機能 - 変数初期化修正版
console.log('ChatGPT通知: コンテンツスクリプトが読み込まれました');

// グローバルスコープで状態追跡用変数を初期化
let isGenerating = false;
let notificationsEnabled = true;
let checkInterval = null;
let lastNotificationTime = 0;
let generatingStartTime = 0;
let stableStateCount = 0;
let lastDetectedState = false;
let longProcessingMode = false;
let extensionContextValid = true;
let activeDeepResearch = false;
let deepResearchTimeout = null;
let lastActivityTime = Date.now();
let errorRecoveryMode = false;

// 設定可能なパラメータ
const CONFIG = {
  // 通常の回答生成の最小時間 (4秒)
  MIN_GENERATION_TIME: 4000,
  
  // 長時間処理と判断する閾値 (30秒)
  LONG_PROCESS_THRESHOLD: 30000,
  
  // 通知間の最小間隔 (15秒)
  NOTIFICATION_COOLDOWN: 15000,
  
  // 状態が安定していると判断するためのカウント閾値
  STABLE_STATE_THRESHOLD: 3,
  
  // 通常の監視間隔 (ミリ秒)
  NORMAL_CHECK_INTERVAL: 2000,
  
  // 長時間処理中の監視間隔 (ミリ秒)
  LONG_PROCESS_CHECK_INTERVAL: 5000,
  
  // 拡張機能コンテキスト検証間隔 (ミリ秒)
  CONTEXT_CHECK_INTERVAL: 30000,
  
  // エラー発生後のフォールバック完了通知時間 (ミリ秒)
  ERROR_FALLBACK_TIMEOUT: 20000,
  
  // DeepResearch無活動タイムアウト (ミリ秒) - 30秒間変化がなければ完了と判断
  DEEP_RESEARCH_INACTIVITY_TIMEOUT: 30000,
  
  // 最大処理時間 (ミリ秒) - 30分を超える処理は強制的に完了と判断
  MAX_PROCESSING_TIME: 30 * 60 * 1000
};

// 拡張機能のコンテキストが有効かどうかを確認する関数
function isExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' && 
           typeof chrome.runtime !== 'undefined' && 
           typeof chrome.runtime.id !== 'undefined';
  } catch (e) {
    return false;
  }
}

// 拡張機能のコンテキストをチェックし、無効になっていれば監視を停止
function checkExtensionContext() {
  if (!isExtensionContextValid()) {
    if (extensionContextValid) {
      console.log('ChatGPT通知: 拡張機能のコンテキストが無効になりました。監視を停止します。');
      extensionContextValid = false;
      
      // 全てのインターバルをクリア
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      
      if (deepResearchTimeout) {
        clearTimeout(deepResearchTimeout);
        deepResearchTimeout = null;
      }
    }
    return false;
  }
  return true;
}

// 定期的にコンテキストの状態をチェック
setInterval(checkExtensionContext, CONFIG.CONTEXT_CHECK_INTERVAL);

// ネットワークエラーを監視する
function setupNetworkErrorListener() {
  try {
    // コンソールエラーを監視するためのハック
    const originalConsoleError = console.error;
    console.error = function() {
      // 元のconsole.errorを呼び出す
      originalConsoleError.apply(console, arguments);
      
      // 引数をテキストに変換して検査
      const errorText = Array.from(arguments).join(' ');
      
      // HTTP/2エラーやネットワークエラーを検出
      if (
        (errorText.includes('ERR_HTTP2_PROTOCOL_ERROR') || 
         errorText.includes('ERR_CONNECTION_RESET') ||
         errorText.includes('ERR_CONNECTION_CLOSED') ||
         errorText.includes('ERR_CONNECTION_ABORTED')) &&
        (errorText.includes('deepresch') || 
         errorText.includes('search-panel') || 
         errorText.includes('browse'))
      ) {
        console.log('ChatGPT通知: Deep Research中のネットワークエラーを検出しました');
        handleDeepResearchError();
      }
    };
    
    console.log('ChatGPT通知: ネットワークエラー検出機能を設定しました');
  } catch (error) {
    console.log('ChatGPT通知: ネットワークエラー検出機能の設定に失敗しました', error);
  }
}

// Deep Researchエラー処理
function handleDeepResearchError() {
  if (activeDeepResearch && !errorRecoveryMode) {
    console.log('ChatGPT通知: Deep Researchエラー回復モードを開始します');
    errorRecoveryMode = true;
    
    // エラー発生後しばらく待ってから通知
    setTimeout(() => {
      // エラー後も生成中状態が続いている場合のみ通知
      if (activeDeepResearch && errorRecoveryMode) {
        console.log('ChatGPT通知: Deep Researchエラーからの回復タイムアウト - 完了として処理します');
        
        // 強制的に完了状態にする
        if (notificationsEnabled) {
          sendErrorRecoveryNotification();
        }
        
        // 状態をリセット
        resetProcessingState();
      }
    }, CONFIG.ERROR_FALLBACK_TIMEOUT);
  }
}

// エラー回復時の通知
function sendErrorRecoveryNotification() {
  // 拡張機能のコンテキストが有効かチェック
  if (!checkExtensionContext()) return;
  
  // 通知のクールダウン確認
  const now = Date.now();
  if (now - lastNotificationTime < CONFIG.NOTIFICATION_COOLDOWN) {
    console.log('ChatGPT通知: クールダウン期間中のため通知を抑制しました');
    return;
  }
  
  // 生成時間を計算
  const generationDuration = now - generatingStartTime;
  const durationText = generationDuration > 60000 ? 
    `${Math.round(generationDuration/60000)}分` : 
    `${Math.round(generationDuration/1000)}秒`;
  
  // 通知を送信
  try {
    chrome.runtime.sendMessage({
      action: "sendNotification",
      title: "ChatGPT通知",
      message: `Deep Researchが停止しました (処理時間: ${durationText})`
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('ChatGPT通知: メッセージエラー', chrome.runtime.lastError);
        extensionContextValid = false;
        return;
      }
      
      lastNotificationTime = now;
      console.log('ChatGPT通知: エラー回復通知を送信しました');
    });
  } catch (error) {
    console.error('ChatGPT通知: 通知送信エラー', error);
  }
}

// 処理状態をリセットする
function resetProcessingState() {
  isGenerating = false;
  activeDeepResearch = false;
  longProcessingMode = false;
  errorRecoveryMode = false;
  stableStateCount = 0;
  
  if (deepResearchTimeout) {
    clearTimeout(deepResearchTimeout);
    deepResearchTimeout = null;
  }
  
  adjustCheckInterval();
}

// 長時間処理のインジケータを検出する特別なセレクタ
const LONG_PROCESS_INDICATORS = [
  // 画像生成インジケータ
  '[data-testid="image-generation"]',
  '.image-generation-container',
  // Deep Searchインジケータ
  '[data-testid="search-panel"]',
  '[data-testid="search-result-answer"]',
  '[data-testid="browsing-result-answer"]',
  '.search-depth-indicator',
  '.browse-loading-indicator',
  '.browse-renderer',
  // その他の長時間処理のインジケータ
  '.processing-indicator',
  '.long-task-indicator'
];

// Deep Research特有のインジケータ
const DEEP_RESEARCH_INDICATORS = [
  '[data-testid="search-panel"]',
  '[data-testid="search-result-answer"]',
  '[data-testid="browsing-result-answer"]',
  '.search-depth-indicator',
  '.browse-renderer',
  '.browse-loading-indicator'
];

// ChatGPTの応答生成状態を検出する関数
function detectGeneratingState() {
  try {
    const now = Date.now();
    
    // まず、プロセスが最大時間を超えているかチェック
    if (isGenerating && (now - generatingStartTime > CONFIG.MAX_PROCESSING_TIME)) {
      console.log('ChatGPT通知: 最大処理時間を超過しました - 強制的に完了とします');
      return false;
    }
    
    // DeepResearchアクティビティの確認
    checkDeepResearchActivity();
    
    // 回答生成中かどうかを判定する視覚的な要素
    const visualIndicators = [
      // 停止ボタン
      'button[aria-label="Stop generating"]',
      'button[data-testid="stop-generating-button"]',
      // 進行状況インジケータ
      '[role="progressbar"]',
      '.animate-pulse',
      '.result-streaming'
    ];
    
    // いずれかの視覚的インジケータが見つかったら生成中と判断
    for (const selector of visualIndicators) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Deep Research特有のインジケータをチェック
    let foundDeepResearch = false;
    for (const selector of DEEP_RESEARCH_INDICATORS) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          foundDeepResearch = true;
          
          // Deep Research処理中のフラグを設定
          if (!activeDeepResearch) {
            activeDeepResearch = true;
            console.log('ChatGPT通知: Deep Research処理を検出しました');
            startDeepResearchMonitoring();
          }
          
          // アクティビティタイムスタンプを更新
          lastActivityTime = now;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Deep Research処理中でなくなった場合
    if (activeDeepResearch && !foundDeepResearch) {
      // Deep Research終了 - 通常の完了として扱う
      console.log('ChatGPT通知: Deep Research処理が完了しました');
      activeDeepResearch = false;
      
      if (deepResearchTimeout) {
        clearTimeout(deepResearchTimeout);
        deepResearchTimeout = null;
      }
      
      return false;
    }
    
    // 他の長時間処理のインジケータをチェック
    for (const selector of LONG_PROCESS_INDICATORS) {
      if (DEEP_RESEARCH_INDICATORS.includes(selector)) continue; // すでにチェック済み
      
      try {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          // 長時間処理モードをオン
          if (!longProcessingMode) {
            console.log('ChatGPT通知: 長時間処理を検出しました');
            longProcessingMode = true;
            adjustCheckInterval();
          }
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    
    // テキスト内容に基づく判定
    const loadingTexts = ['生成中', 'Generating', 'thinking', 'searching', 'browsing', '検索中', '思考中'];
    const divs = document.querySelectorAll('div');
    
    for (const div of divs) {
      if (!div || !div.textContent) continue;
      
      const text = div.textContent.toLowerCase();
      for (const loadingText of loadingTexts) {
        if (text.includes(loadingText.toLowerCase())) {
          return true;
        }
      }
    }
    
    // エラー回復モード中はまだ生成中と扱う
    if (errorRecoveryMode) {
      return true;
    }
    
    // 長時間処理モードで、かつ開始から30秒以内の場合は生成中と判断
    if (longProcessingMode && (now - generatingStartTime < 30000)) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('ChatGPT通知: 状態検出エラー', error);
    return lastDetectedState; // エラー時は前回の状態を維持
  }
}

// Deep Research処理の監視を開始
function startDeepResearchMonitoring() {
  console.log('ChatGPT通知: Deep Research監視を開始します');
  
  // 長時間処理モードを有効化
  longProcessingMode = true;
  adjustCheckInterval();
  
  // 無活動タイムアウトを設定
  if (deepResearchTimeout) {
    clearTimeout(deepResearchTimeout);
  }
  
  deepResearchTimeout = setTimeout(checkDeepResearchInactivity, 
                                   CONFIG.DEEP_RESEARCH_INACTIVITY_TIMEOUT);
}

// Deep Researchのアクティビティを確認
function checkDeepResearchActivity() {
  if (!activeDeepResearch) return;
  
  try {
    // UIの変更を検出
    const now = Date.now();
    const inactiveTime = now - lastActivityTime;
    
    // 長時間無活動の場合、タイムアウトを再設定
    if (inactiveTime > (CONFIG.DEEP_RESEARCH_INACTIVITY_TIMEOUT / 2)) {
      if (deepResearchTimeout) {
        clearTimeout(deepResearchTimeout);
      }
      
      deepResearchTimeout = setTimeout(checkDeepResearchInactivity, 
                                      CONFIG.DEEP_RESEARCH_INACTIVITY_TIMEOUT);
    }
  } catch (error) {
    console.warn('ChatGPT通知: アクティビティ確認エラー', error);
  }
}

// Deep Research無活動チェック - 一定時間UIの変化がなければ完了と判断
function checkDeepResearchInactivity() {
  console.log('ChatGPT通知: Deep Research無活動タイムアウトが発生しました');
  
  if (activeDeepResearch) {
    const now = Date.now();
    const inactiveTime = now - lastActivityTime;
    
    if (inactiveTime >= CONFIG.DEEP_RESEARCH_INACTIVITY_TIMEOUT) {
      console.log('ChatGPT通知: Deep Researchが無活動状態です - 完了として処理します');
      
      // 状態を変更して通知を発生させる
      if (isGenerating) {
        // 強制的に完了状態に
        isGenerating = false;
        lastDetectedState = false;
        stableStateCount = CONFIG.STABLE_STATE_THRESHOLD;
        
        if (notificationsEnabled) {
          sendNotification("Deep Researchが完了しました");
        }
      }
      
      // 状態をリセット
      resetProcessingState();
    } else {
      // アクティビティがあった場合は再度タイマーを設定
      console.log('ChatGPT通知: Deep Researchはまだアクティブです');
      if (deepResearchTimeout) {
        clearTimeout(deepResearchTimeout);
      }
      
      deepResearchTimeout = setTimeout(checkDeepResearchInactivity, 
                                      CONFIG.DEEP_RESEARCH_INACTIVITY_TIMEOUT);
    }
  }
}

// 監視間隔を調整する関数
function adjustCheckInterval() {
  if (!checkExtensionContext()) return;
  
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  const interval = longProcessingMode ? 
    CONFIG.LONG_PROCESS_CHECK_INTERVAL : 
    CONFIG.NORMAL_CHECK_INTERVAL;
    
  checkInterval = setInterval(smartObserver, interval);
  console.log(`ChatGPT通知: 監視間隔を ${interval/1000} 秒に調整しました`);
}

// 通知を送信する関数
function sendNotification(customMessage = null) {
  // 拡張機能のコンテキストが有効かチェック
  if (!checkExtensionContext()) return;
  
  const now = Date.now();
  
  // 通知クールダウン期間中なら送信しない
  if (now - lastNotificationTime < CONFIG.NOTIFICATION_COOLDOWN) {
    console.log('ChatGPT通知: クールダウン期間中のため通知を抑制しました');
    return;
  }
  
  // 生成時間を計算
  const generationDuration = now - generatingStartTime;
  const durationText = generationDuration > 60000 ? 
    `${Math.round(generationDuration/60000)}分` : 
    `${Math.round(generationDuration/1000)}秒`;
  
  // メッセージを決定
  let message;
  if (customMessage) {
    message = customMessage;
  } else if (activeDeepResearch) {
    message = `Deep Researchが完了しました！(処理時間: ${durationText})`;
  } else if (longProcessingMode) {
    message = `長時間処理が完了しました！(処理時間: ${durationText})`;
  } else {
    message = `ChatGPTが回答を完了しました！`;
  }
  
  // 通知を送信
  try {
    chrome.runtime.sendMessage({
      action: "sendNotification",
      title: "ChatGPT通知",
      message: message
    }, response => {
      // エラーチェック
      if (chrome.runtime.lastError) {
        console.error('ChatGPT通知: メッセージエラー', chrome.runtime.lastError);
        extensionContextValid = false;
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        return;
      }
      
      // 最終通知時間を更新
      lastNotificationTime = now;
      console.log(`ChatGPT通知: 通知を送信しました (処理時間: ${durationText})`);
    });
  } catch (error) {
    console.error('ChatGPT通知: 通知送信エラー', error);
    extensionContextValid = false;
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }
}

// 安定した状態監視を行う関数
function smartObserver() {
  // 拡張機能のコンテキストが有効かチェック
  if (!checkExtensionContext()) return;
  
  try {
    const now = Date.now();
    const currentState = detectGeneratingState();
    
    // 状態が前回と同じ場合、安定カウントを増やす
    if (currentState === lastDetectedState) {
      stableStateCount++;
    } else {
      // 状態が変わった場合はカウントをリセット
      stableStateCount = 0;
      lastDetectedState = currentState;
      
      // 生成開始時間の記録
      if (currentState && !isGenerating) {
        generatingStartTime = now;
        lastActivityTime = now;
        console.log('ChatGPT通知: 回答生成開始を検出しました');
      }
    }
    
    // 安定した状態変化のみを処理
    if (stableStateCount >= CONFIG.STABLE_STATE_THRESHOLD) {
      // 生成中→完了の遷移を検出
      if (isGenerating && !currentState) {
        const generationDuration = now - generatingStartTime;
        
        console.log(`ChatGPT通知: 回答生成完了を検出 (生成時間: ${generationDuration / 1000}秒)`);
        
        // 最小生成時間より長い場合のみ通知
        // 長時間処理モードの場合は最小時間の条件を無視
        const validDuration = longProcessingMode || activeDeepResearch || 
                             generationDuration >= CONFIG.MIN_GENERATION_TIME;
        
        if (validDuration) {
          if (notificationsEnabled) {
            sendNotification();
          } else {
            console.log('ChatGPT通知: 通知設定がオフのため、通知は送信されません');
          }
        } else {
          console.log('ChatGPT通知: 生成時間が短すぎるため通知を抑制しました');
        }
        
        // 状態をリセット
        resetProcessingState();
      }
      
      // 状態を更新
      isGenerating = currentState;
      
      // 長時間処理の検出（通常の回答生成よりも長く続いている場合）
      if (isGenerating && !longProcessingMode && (now - generatingStartTime > CONFIG.LONG_PROCESS_THRESHOLD)) {
        console.log('ChatGPT通知: 長時間処理モードに移行します');
        longProcessingMode = true;
        adjustCheckInterval();
      }
    }
  } catch (error) {
    console.error('ChatGPT通知: 監視処理エラー', error);
  }
}

// 拡張機能の初期化
function initExtension() {
  // 拡張機能のコンテキストが有効かチェック
  if (!checkExtensionContext()) return;
  
  console.log('ChatGPT通知: 初期化開始');
  
  // ネットワークエラーリスナーをセットアップ
  setupNetworkErrorListener();
  
  // 設定を読み込む
  try {
    chrome.storage.sync.get(['notificationsEnabled'], result => {
      // エラーチェック
      if (chrome.runtime.lastError) {
        console.error('ChatGPT通知: 設定読み込みエラー', chrome.runtime.lastError);
        extensionContextValid = false;
        return;
      }
      
      if (result.hasOwnProperty('notificationsEnabled')) {
        notificationsEnabled = result.notificationsEnabled;
      }
      console.log(`ChatGPT通知: 設定読み込み完了 (通知: ${notificationsEnabled ? 'オン' : 'オフ'})`);
    });
  } catch (error) {
    console.error('ChatGPT通知: 設定初期化エラー', error);
    extensionContextValid = false;
    return;
  }
  
  // 設定変更を監視
  try {
    chrome.storage.onChanged.addListener(changes => {
      // 拡張機能のコンテキストが有効かチェック
      if (!checkExtensionContext()) return;
      
      if (changes.notificationsEnabled) {
        notificationsEnabled = changes.notificationsEnabled.newValue;
        console.log(`ChatGPT通知: 設定変更 (通知: ${notificationsEnabled ? 'オン' : 'オフ'})`);
      }
    });
  } catch (error) {
    console.error('ChatGPT通知: 設定変更リスナーエラー', error);
    extensionContextValid = false;
    return;
  }
  
  // 監視開始
  try {
    checkInterval = setInterval(smartObserver, CONFIG.NORMAL_CHECK_INTERVAL);
    console.log(`ChatGPT通知: 監視を開始しました (${CONFIG.NORMAL_CHECK_INTERVAL/1000}秒間隔)`);
  } catch (error) {
    console.error('ChatGPT通知: 監視開始エラー', error);
    extensionContextValid = false;
  }
}

// 再試行機能 - ページ遷移があってもコンテキストが復活する可能性があるため
function initWithRetry() {
  // 拡張機能のコンテキストが有効になったか定期的にチェック
  const retryInterval = setInterval(() => {
    if (isExtensionContextValid()) {
      if (!extensionContextValid) {
        console.log('ChatGPT通知: 拡張機能のコンテキストが復活しました。初期化を再試行します。');
        extensionContextValid = true;
        initExtension();
      }
    } else {
      extensionContextValid = false;
    }
  }, 60000); // 1分ごとに再試行
  
  // 最初の初期化を試行
  initExtension();
}

// ページ読み込み完了時に実行
if (document.readyState === 'complete') {
  initWithRetry();
} else {
  window.addEventListener('load', initWithRetry);
}

// タブがアクティブになったときの処理
document.addEventListener('visibilitychange', () => {
  // 拡張機能のコンテキストが有効かチェック
  if (!checkExtensionContext()) return;
  
  if (document.visibilityState === 'visible') {
    console.log('ChatGPT通知: ページがアクティブになりました');
    
    // 状態をリセット
    stableStateCount = 0;
    
    // 現在の状態を再確認
    setTimeout(() => {
      if (!checkExtensionContext()) return;
      
      const currentState = detectGeneratingState();
      lastDetectedState = currentState;
      
      // すでに生成中だった場合は継続
      if (isGenerating && currentState) {
        console.log('ChatGPT通知: 生成処理継続中です');
        
        // アクティビティタイムスタンプを更新
        lastActivityTime = Date.now();
      } 
      // 状態に変化があった場合
      else if (isGenerating !== currentState) {
        // 生成中 → 完了に変わっていた場合
        if (isGenerating && !currentState) {
          const now = Date.now();
          const generationDuration = now - generatingStartTime;
          
          console.log(`ChatGPT通知: タブ復帰時に完了を検出 (生成時間: ${generationDuration / 1000}秒)`);
          
          if (notificationsEnabled) {
            sendNotification();
          }
          
          // 状態をリセット
          resetProcessingState();
        } else if (!isGenerating && currentState) {
          // 新しい生成が始まった
          generatingStartTime = Date.now();
          lastActivityTime = Date.now();
        }
        
        // 状態を更新
        isGenerating = currentState;
      }
      
      if (currentState) {
        console.log('ChatGPT通知: 現在の状態は生成中です');
      } else {
        console.log('ChatGPT通知: 現在の状態は待機中です');
      }
    }, 1000);
  }
});