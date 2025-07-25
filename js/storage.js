// DEMATEL 問卷系統 - 統一本地儲存 API
// 統一管理 localStorage 操作，便於未來升級至 IndexedDB

// 版本管理 - 使用日期版本號避免舊資料衝突
const STORAGE_VERSION = '20250125';
const STORAGE_KEYS = {
  STATE: `dematel_state_v${STORAGE_VERSION}`,
  ANSWERS: `dematel_answers_v${STORAGE_VERSION}`,
  BASIC_INFO: `dematel_basic_info_v${STORAGE_VERSION}`,
  PHASE: `dematel_phase_v${STORAGE_VERSION}`,
  INDEX: `dematel_idx_v${STORAGE_VERSION}`,
  DATA_HASH: `dematel_data_hash_v${STORAGE_VERSION}`,
  SURVEY_DATA: `dematel_survey_data_v${STORAGE_VERSION}`,
  LAST_SAVE: `dematel_last_save_v${STORAGE_VERSION}`
};

// 儲存容量警告閾值 (5MB)
const QUOTA_WARNING_THRESHOLD = 5 * 1024 * 1024;

/**
 * 檢查 localStorage 是否可用
 */
function isStorageAvailable() {
  try {
    if (typeof(Storage) === "undefined") {
      return false;
    }
    localStorage.setItem('__test__', 'test');
    localStorage.removeItem('__test__');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 檢查儲存容量
 */
function checkStorageQuota() {
  if (!isStorageAvailable()) {
    return { available: false, usage: 0, quota: 0 };
  }
  
  try {
    // 估算當前使用量
    let usage = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        usage += localStorage.getItem(key).length + key.length;
      }
    }
    
    return {
      available: true,
      usage: usage,
      quota: QUOTA_WARNING_THRESHOLD,
      percentage: (usage / QUOTA_WARNING_THRESHOLD) * 100
    };
  } catch (e) {
    return { available: false, usage: 0, quota: 0 };
  }
}

/**
 * 安全儲存資料
 * @param {string} key - 儲存鍵名
 * @param {any} value - 要儲存的值
 * @returns {boolean} - 是否成功儲存
 */
function saveData(key, value) {
  if (!isStorageAvailable()) {
    console.error('localStorage is not available');
    alert('您的瀏覽器不支援本地儲存功能，進度將無法保存');
    return false;
  }
  
  try {
    const serializedValue = JSON.stringify(value);
    localStorage.setItem(key, serializedValue);
    
    // 更新最後保存時間
    localStorage.setItem(STORAGE_KEYS.LAST_SAVE, new Date().toISOString());
    
    console.log(`Successfully saved ${key}`);
    return true;
  } catch (e) {
    console.error(`Error saving ${key}:`, e);
    
    if (e.name === 'QuotaExceededError') {
      alert('本地儲存空間已滿！\n建議：\n1. 點選「產生 QRCode」匯出目前進度\n2. 清除瀏覽器資料後重新開始\n3. 或使用無痕模式繼續填寫');
    } else {
      alert('保存進度時發生錯誤：' + e.message + '\n您的進度可能無法保存');
    }
    return false;
  }
}

/**
 * 載入資料
 * @param {string} key - 儲存鍵名
 * @param {any} defaultValue - 預設值
 * @returns {any} - 載入的值或預設值
 */
function loadData(key, defaultValue = null) {
  if (!isStorageAvailable()) {
    return defaultValue;
  }
  
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item);
  } catch (e) {
    console.error(`Error loading ${key}:`, e);
    return defaultValue;
  }
}

/**
 * 刪除資料
 * @param {string} key - 儲存鍵名
 */
function removeData(key) {
  if (!isStorageAvailable()) {
    return;
  }
  
  try {
    localStorage.removeItem(key);
    console.log(`Successfully removed ${key}`);
  } catch (e) {
    console.error(`Error removing ${key}:`, e);
  }
}

/**
 * 清除所有 DEMATEL 相關資料
 */
function clearAllData() {
  if (!isStorageAvailable()) {
    return;
  }
  
  try {
    // 清除當前版本的所有資料
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // 清除舊版本資料（向下兼容）
    const legacyKeys = [
      'dematel_answers',
      'dematel_basic_info', 
      'dematel-phase',
      'dematel-idx',
      'dematel-data-hash',
      'dematel-last-save'
    ];
    legacyKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('All DEMATEL data cleared');
  } catch (e) {
    console.error('Error clearing data:', e);
  }
}

/**
 * 獲取儲存狀態摘要
 */
function getStorageStatus() {
  const quota = checkStorageQuota();
  const lastSave = loadData(STORAGE_KEYS.LAST_SAVE);
  
  return {
    available: quota.available,
    usage: quota.usage,
    percentage: quota.percentage,
    lastSave: lastSave,
    hasAnswers: !!loadData(STORAGE_KEYS.ANSWERS),
    hasBasicInfo: !!loadData(STORAGE_KEYS.BASIC_INFO),
    currentPhase: loadData(STORAGE_KEYS.PHASE),
    currentIndex: loadData(STORAGE_KEYS.INDEX)
  };
}

// ===== 高階 API - 業務邏輯封裝 =====

/**
 * 保存完整的應用狀態
 */
function saveAppState(state) {
  const success = saveData(STORAGE_KEYS.STATE, {
    answers: state.answers || {},
    basicInfo: state.basicInfo || {},
    currentPhase: state.currentPhase || 'intro',
    currentIndex: state.currentIndex || 0,
    timestamp: new Date().toISOString()
  });
  return success;
}

/**
 * 載入完整的應用狀態
 */
function loadAppState() {
  return loadData(STORAGE_KEYS.STATE, {
    answers: {},
    basicInfo: {},
    currentPhase: 'intro',
    currentIndex: 0,
    timestamp: null
  });
}

/**
 * 保存問卷答案
 */
function saveAnswers(answers) {
  return saveData(STORAGE_KEYS.ANSWERS, answers);
}

/**
 * 載入問卷答案
 */
function loadAnswers() {
  return loadData(STORAGE_KEYS.ANSWERS, {});
}

/**
 * 保存基本資料
 */
function saveBasicInfo(basicInfo) {
  return saveData(STORAGE_KEYS.BASIC_INFO, basicInfo);
}

/**
 * 載入基本資料
 */
function loadBasicInfo() {
  return loadData(STORAGE_KEYS.BASIC_INFO, {});
}

/**
 * 保存當前階段和索引
 */
function saveProgress(phase, index) {
  const success1 = saveData(STORAGE_KEYS.PHASE, phase);
  const success2 = saveData(STORAGE_KEYS.INDEX, index);
  return success1 && success2;
}

/**
 * 載入當前階段和索引
 */
function loadProgress() {
  return {
    phase: loadData(STORAGE_KEYS.PHASE, 'intro'),
    index: loadData(STORAGE_KEYS.INDEX, 0)
  };
}

/**
 * 保存問卷資料的雜湊值
 */
function saveDataHash(hash) {
  return saveData(STORAGE_KEYS.DATA_HASH, hash);
}

/**
 * 載入問卷資料的雜湊值
 */
function loadDataHash() {
  return loadData(STORAGE_KEYS.DATA_HASH);
}

/**
 * 保存問卷結構資料到快取
 */
function saveSurveyData(data) {
  return saveData(STORAGE_KEYS.SURVEY_DATA, {
    data: data,
    timestamp: new Date().toISOString(),
    version: STORAGE_VERSION
  });
}

/**
 * 從快取載入問卷結構資料
 */
function loadSurveyData() {
  const cached = loadData(STORAGE_KEYS.SURVEY_DATA);
  if (cached && cached.data) {
    return cached.data;
  }
  return null;
}

// 匯出 API
if (typeof module !== 'undefined' && module.exports) {
  // Node.js 環境
  module.exports = {
    STORAGE_KEYS,
    isStorageAvailable,
    checkStorageQuota,
    saveData,
    loadData,
    removeData,
    clearAllData,
    getStorageStatus,
    saveAppState,
    loadAppState,
    saveAnswers,
    loadAnswers,
    saveBasicInfo,
    loadBasicInfo,
    saveProgress,
    loadProgress,
    saveDataHash,
    loadDataHash,
    saveSurveyData,
    loadSurveyData
  };
}
