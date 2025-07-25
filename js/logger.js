// P1: Logger 模組 - 環境控制的日誌系統
// 目標：開發環境輸出日誌，正式環境靜默

class Logger {
  constructor() {
    // 檢查是否為開發環境
    this.isDev = this.detectDevEnvironment();
    this.logLevel = this.isDev ? 'debug' : 'silent';
    
    console.log(`Logger initialized - Mode: ${this.isDev ? 'Development' : 'Production'}`);
  }

  // 檢測開發環境
  detectDevEnvironment() {
    // 檢查常見的開發環境指標
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('192.168.') ||
      window.location.protocol === 'file:' ||
      (typeof document !== 'undefined' && document.querySelector('#debugPanel'))
    );
  }

  // 設定日誌級別
  setLogLevel(level) {
    this.logLevel = level;
  }

  // Debug 級別日誌
  debug(...args) {
    if (this.logLevel === 'debug' || this.logLevel === 'verbose') {
      console.log('[DEBUG]', ...args);
    }
  }

  // Info 級別日誌
  info(...args) {
    if (this.logLevel !== 'silent') {
      console.info('[INFO]', ...args);
    }
  }

  // Warning 級別日誌
  warn(...args) {
    if (this.logLevel !== 'silent') {
      console.warn('[WARN]', ...args);
    }
  }

  // Error 級別日誌（總是顯示）
  error(...args) {
    console.error('[ERROR]', ...args);
  }

  // 性能測量開始
  timeStart(label) {
    if (this.logLevel === 'debug' || this.logLevel === 'verbose') {
      console.time(`[PERF] ${label}`);
    }
  }

  // 性能測量結束
  timeEnd(label) {
    if (this.logLevel === 'debug' || this.logLevel === 'verbose') {
      console.timeEnd(`[PERF] ${label}`);
    }
  }

  // 表格形式輸出
  table(data, label = '') {
    if (this.logLevel === 'debug' || this.logLevel === 'verbose') {
      if (label) console.log(`[TABLE] ${label}`);
      console.table(data);
    }
  }

  // 群組日誌開始
  group(label) {
    if (this.logLevel === 'debug' || this.logLevel === 'verbose') {
      console.group(`[GROUP] ${label}`);
    }
  }

  // 群組日誌結束
  groupEnd() {
    if (this.logLevel === 'debug' || this.logLevel === 'verbose') {
      console.groupEnd();
    }
  }

  // 條件日誌
  assert(condition, ...args) {
    if (this.logLevel !== 'silent') {
      console.assert(condition, '[ASSERT]', ...args);
    }
  }

  // 計數器日誌
  count(label = 'default') {
    if (this.logLevel === 'debug' || this.logLevel === 'verbose') {
      console.count(`[COUNT] ${label}`);
    }
  }

  // 重置計數器
  countReset(label = 'default') {
    if (this.logLevel === 'debug' || this.logLevel === 'verbose') {
      console.countReset(`[COUNT] ${label}`);
    }
  }

  // 追蹤堆疊
  trace(...args) {
    if (this.logLevel === 'debug' || this.logLevel === 'verbose') {
      console.trace('[TRACE]', ...args);
    }
  }
}

// 創建全域 Logger 實例
const logger = new Logger();

// P1: 正式版隱藏 Debug Panel
function initProductionMode() {
  if (!logger.isDev) {
    const debugPanel = document.getElementById('debugPanel');
    const debugButton = document.querySelector('button[onclick="toggleDebugPanel()"]');
    
    if (debugPanel) {
      debugPanel.style.display = 'none';
    }
    
    if (debugButton) {
      debugButton.style.display = 'none';
    }
    
    logger.info('Production mode: Debug panel hidden');
  }
}

// 當 DOM 載入完成時初始化正式版模式
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProductionMode);
} else {
  initProductionMode();
}

// 導出 logger 供其他模組使用
window.logger = logger;
