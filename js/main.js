// DEMATEL 問卷系統 - 主要應用模組 (Phase 2: 統一儲存API)
// 核心變數聲明和初始化

// 全域變數
let surveyData = null;
let basicInfo = {};
let answers = {};
let questions = [];
let currentPhase = 'intro';
let idx = 0;
let rel = '';
let score1 = '';
let score2 = '';
let critTotal = 0;
let dimTotal = 0;
let isAnimating = false;

// 常數定義
const fileName = 'dematel-structure.json';
const CLEAR_DELAY = 200;

// Phase 2: 使用新的統一儲存API，保留舊常數名稱以維持兼容性
const LS_KEY = 'dematel_answers';
const LS_BASIC_KEY = 'dematel_basic_info';

// Phase 3: 核心應用初始化
function init() {
  console.log('=== Phase 3: 初始化應用 ===');
  
  // Phase 3: 檢查核心依賴
  const dependencies = [
    { name: 'storage.js', check: () => typeof isStorageAvailable === 'function' },
    { name: 'secureRenderer', check: () => window.secureRenderer },
    { name: 'LazyRenderer', check: () => window.LazyRenderer }
  ];
  
  let allDependenciesLoaded = true;
  dependencies.forEach(dep => {
    const loaded = dep.check();
    console.log(`${dep.name}: ${loaded ? '✅' : '❌'}`);
    if (!loaded) allDependenciesLoaded = false;
  });
  
  if (!allDependenciesLoaded) {
    console.error('❌ Phase 3 依賴未完全載入');
    alert('系統模組載入失敗，請重新整理頁面');
    return;
  } else {
    console.log('✅ 所有 Phase 3 依賴已載入');
  }
  
  // Phase 3: XSS 防護測試
  if (window.secureRenderer) {
    window.secureRenderer.testXSSPrevention();
  }
  
  // 顯示儲存狀態
  const status = getStorageStatus();
  console.log('Storage status:', status);
  
  // 載入問卷資料（支援快取）
  loadJSON(fileName);
}

// 核心問卷邏輯函數
function generateAllQuestions(data) {
  console.log('=== 生成問卷題目 ===');
  questions = [];
  let questionIndex = 0;
  
  const dimensions = data['架構'];
  
  let items = [];
  dimensions.forEach(dim => {
    if (dim.準則 && dim.準則.length > 0) {
      dim.準則.forEach(rule => {
        items.push({ 
          id: rule.編號, 
          name: `${dim.構面}-${rule.名稱}`, 
          desc: rule.說明 || rule.內容 || '' 
        });
      });
    }
  });
  
  // 生成準則比較題目
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      questions.push({
        index: questionIndex,
        key: `${items[i].id}->${items[j].id}`,
        type: 'criteria',
        A: items[i],
        B: items[j]
      });
      questionIndex++;
    }
  }
  
  critTotal = questionIndex;
  
  // 生成構面比較題目
  let dims = dimensions.map(dim => ({ 
    id: dim.構面, 
    name: dim.構面, 
    desc: dim.說明 || '' 
  }));
  
  for (let i = 0; i < dims.length; i++) {
    for (let j = i + 1; j < dims.length; j++) {
      questions.push({
        index: questionIndex,
        key: `${dims[i].id}->${dims[j].id}`,
        type: 'dimension',
        A: dims[i],
        B: dims[j]
      });
      questionIndex++;
    }
  }
  
  dimTotal = questionIndex - critTotal;
  
  console.log(`總題數: ${questions.length} (準則: ${critTotal}, 構面: ${dimTotal})`);
}

// ===== Phase 2: 統一儲存API包裝函數 =====

// 儲存到本地儲存（使用新的 storage.js API）
function saveToLocal() {
  try {
    console.log('=== Phase 2: saveToLocal ===');
    console.log('Saving answers:', answers);
    console.log('Saving currentPhase:', currentPhase);
    console.log('Saving idx:', idx);
    
    // Phase 2: 使用統一儲存API
    const success1 = saveAnswers(answers);
    const success2 = saveProgress(currentPhase, idx);
    
    if (success1 && success2) {
      console.log('✓ Successfully saved using unified storage API');
    } else {
      console.error('✗ Failed to save some data');
    }
    
    return success1 && success2;
    
  } catch(e) {
    console.error('Error in saveToLocal:', e);
    // Phase 2: 改良的錯誤處理，給用戶更具體的建議
    if (e.name === 'QuotaExceededError') {
      alert('儲存空間已滿！\n建議操作：\n1. 先產生QR Code備份\n2. 清除瀏覽器資料\n3. 重新開始填寫');
    } else {
      alert('保存進度時發生錯誤：' + e.message + '\n您的進度可能無法保存');
    }
    return false;
  }
}

function saveBasicInfoToLocal() {
  try {
    const success = saveBasicInfo(basicInfo);
    console.log('✓ Basic info saved:', success);
    return success;
  } catch(e) {
    console.error('Error saving basic info:', e);
    return false;
  }
}

// 從本地儲存載入（使用新的 storage.js API）
function loadFromLocal() {
  try {
    answers = loadAnswers();
    console.log('✓ Loaded answers using unified storage API:', Object.keys(answers).length, 'items');
  } catch(e) {
    console.error('Error loading answers:', e);
    answers = {};
  }
}

function loadBasicInfoFromLocal() {
  try {
    basicInfo = loadBasicInfo();
    console.log('✓ Loaded basic info using unified storage API');
  } catch(e) {
    console.error('Error loading basic info:', e);
    basicInfo = {};
  }
}

// Phase 2: 清除所有儲存的資料（使用統一 API）
function clearAllDataWrapper() {
  console.log('=== Phase 2: 清除所有資料 ===');
  
  // 重置變數
  answers = {};
  basicInfo = {};
  currentPhase = 'intro';
  idx = 0;
  rel = '';
  score1 = '';
  score2 = '';
  
  // 使用統一API清除資料
  clearAllData();
  
  // 重新初始化頁面
  initializePage();
}

// 初始化頁面
function initializePage() {
  console.log('=== 初始化頁面 ===');
  
  // 顯示介紹頁面，隱藏其他頁面
  document.getElementById('introSection').style.display = 'block';
  document.getElementById('basicInfoSection').style.display = 'none';
  document.getElementById('surveySection').style.display = 'none';
  document.getElementById('finishSection').style.display = 'none';
  
  // 載入基本資料
  loadBasicInfoFromLocal();
  
  // 載入說明內容
  loadIntroduction();
  
  // 更新進度
  updateProgress();
}

// 載入問卷題目
function loadSurveyQuestions(resetIndex = true) {
  if (!surveyData || !questions.length) {
    console.warn('Survey data or questions not ready');
    return;
  }
  
  if (resetIndex) {
    idx = 0;
  }
  
  console.log(`=== 載入問卷題目 (idx: ${idx}) ===`);
  
  // 切換顯示
  document.getElementById('introSection').style.display = 'none';
  document.getElementById('basicInfoSection').style.display = 'none';
  document.getElementById('surveySection').style.display = 'block';
  document.getElementById('finishSection').style.display = 'none';
  
  // 更新狀態
  currentPhase = 'survey';
  
  // Phase 2: 立即保存狀態
  saveToLocal();
  
  // 載入進度
  loadFromLocal();
  fillPrev();
  render();
}

// 格式化名稱顯示
function formatName(name) {
  const match = name.match(/^(.+?)\-(.+)$/);
  if (match) return `(${match[1]})${match[2]}`;
  return name;
}

// 填入之前的答案
function fillPrev() {
  if (idx >= questions.length) return;
  
  const q = questions[idx];
  const key = q.key;
  const prev = answers[key];
  
  if (!prev) { 
    rel = ''; 
    score1 = ''; 
    score2 = ''; 
    return; 
  }
  
  rel = prev.relation;
  if (rel === 'to') { 
    score1 = prev.score; 
    score2 = ''; 
  } else if (rel === 'from') { 
    score1 = ''; 
    score2 = prev.score; 
  } else if (rel === 'bi') { 
    score1 = prev.score_XtoY; 
    score2 = prev.score_YtoX; 
  } else { 
    score1 = ''; 
    score2 = ''; 
  }
  
  console.log(`Filled previous answer for idx ${idx}:`, { rel, score1, score2 });
}

// ===== Phase 2: 改良的診斷工具 =====

function toggleDebugPanel() {
  const panel = document.getElementById('debugPanel');
  const button = document.querySelector('button[onclick="toggleDebugPanel()"]');
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
    button.style.display = 'none';
    checkLocalStorage(); // 自動刷新狀態
  } else {
    panel.style.display = 'none';
    button.style.display = 'block';
  }
}

function checkLocalStorage() {
  const debugInfo = document.getElementById('debugInfo');
  
  // Phase 2: 使用統一儲存API獲取詳細狀態
  const status = getStorageStatus();
  
  let info = '<div style="margin-top: 10px; font-size: 11px; line-height: 1.3;">';
  info += '<strong>📊 應用狀態:</strong><br>';
  info += `當前題號: ${idx + 1} / ${questions.length}<br>`;
  info += `當前階段: ${currentPhase}<br>`;
  info += `已答題數: ${Object.keys(answers).length}<br>`;
  info += `問卷載入: ${surveyData ? '✓' : '✗'}<br><br>`;
  
  info += '<strong>💾 Phase 2 儲存狀態:</strong><br>';
  info += `API 可用: ${status.available ? '✓' : '✗'}<br>`;
  info += `使用率: ${status.percentage ? status.percentage.toFixed(1) + '%' : '0%'}<br>`;
  info += `容量警告: ${status.percentage > 80 ? '⚠️' : '✓'}<br>`;
  info += `有答案: ${status.hasAnswers ? '✓' : '✗'}<br>`;
  info += `有基本資料: ${status.hasBasicInfo ? '✓' : '✗'}<br>`;
  info += `儲存階段: ${status.currentPhase || '無'}<br>`;
  info += `儲存索引: ${status.currentIndex !== null ? status.currentIndex : '無'}<br>`;
  
  if (status.lastSave) {
    const saveTime = new Date(status.lastSave);
    info += `最後保存: ${saveTime.toLocaleString()}<br>`;
  } else {
    info += `最後保存: 無<br>`;
  }
  
  info += '<br><strong>🔧 快取狀態:</strong><br>';
  const cachedSurvey = loadSurveyData();
  info += `問卷快取: ${cachedSurvey ? '✓' : '✗'}<br>`;
  
  if (status.hasAnswers) {
    const loadedAnswers = loadAnswers();
    info += `<br><strong>📝 最近答案:</strong><br>`;
    const entries = Object.entries(loadedAnswers);
    entries.slice(-3).forEach(([key, value]) => {
      info += `${key.substring(0,20)}...: ${value.relation}<br>`;
    });
  }
  
  info += '</div>';
  debugInfo.innerHTML = info;
}

function clearDebugStorage() {
  if (confirm('⚠️ 確定要清除所有儲存資料嗎？\n\n這將：\n• 清除所有答題進度\n• 清除基本資料\n• 清除問卷快取\n• 重設為初始狀態')) {
    console.log('=== 用戶要求清除所有資料 ===');
    clearAllDataWrapper();
    alert('✅ 已清除所有資料，頁面即將重新整理');
    setTimeout(() => {
      location.reload();
    }, 1000);
  }
}

// Phase 2: 改良的初始化流程
window.onload = function() {
  console.log('=== Phase 2: 應用啟動 ===');
  
  // 檢查依賴
  if (typeof isStorageAvailable === 'undefined') {
    console.error('❌ storage.js not loaded');
    alert('儲存模組載入失敗，請重新整理頁面');
    return;
  }
  
  if (typeof QRCode === 'undefined') {
    console.error('❌ QRCode library not loaded');
    alert('QR碼模組載入失敗，請重新整理頁面');
    return;
  }
  
  if (typeof pako === 'undefined') {
    console.error('❌ Pako compression library not loaded');
    alert('壓縮模組載入失敗，請重新整理頁面');
    return;
  }
  
  console.log('✅ All dependencies loaded');
  
  // Phase 2: 顯示儲存狀態
  const status = getStorageStatus();
  if (!status.available) {
    alert('⚠️ 本地儲存不可用\n您的填答進度將無法保存\n建議使用較新的瀏覽器');
  } else if (status.percentage > 90) {
    alert('⚠️ 儲存空間即將用完\n建議先清除瀏覽器資料');
  }
  
  // 初始化應用
  init();
};

// Phase 3: 測試工具與驗證函數

// XSS 防護測試
function testXSSPrevention() {
  console.log('=== Phase 3: XSS 防護測試 ===');
  
  if (window.secureRenderer) {
    return window.secureRenderer.testXSSPrevention();
  }
  
  console.error('SecureRenderer not available');
  return false;
}

// 性能測試
function testPerformance() {
  console.log('=== Phase 3: 性能測試 ===');
  
  if (lazyRenderer) {
    return lazyRenderer.performanceTest();
  }
  
  console.error('LazyRenderer not available');
  return false;
}

// 千題卷測試
function test1000Questions() {
  console.log('=== Phase 3: 千題卷測試 ===');
  
  const testData = [];
  for (let i = 0; i < 1000; i++) {
    testData.push({
      question: `測試問題 ${i + 1}`,
      description: `這是第 ${i + 1} 個測試問題的描述`,
      factorA: `因子A${i + 1}`,
      factorB: `因子B${i + 1}`
    });
  }
  
  // 備份原始資料
  const originalQuestions = questions;
  questions = testData;
  
  // 測試渲染性能
  const startTime = performance.now();
  render();
  const endTime = performance.now();
  
  console.log(`千題卷首次渲染耗時: ${(endTime - startTime).toFixed(2)}ms`);
  
  // 測試導航性能
  const navStartTime = performance.now();
  for (let i = 0; i < 100; i++) {
    const randomIdx = Math.floor(Math.random() * 1000);
    idx = randomIdx;
    render();
  }
  const navEndTime = performance.now();
  
  console.log(`千題卷隨機導航100次耗時: ${(navEndTime - navStartTime).toFixed(2)}ms`);
  
  // 恢復原始資料
  questions = originalQuestions;
  
  return {
    renderTime: endTime - startTime,
    navigationTime: navEndTime - navStartTime
  };
}

// Phase 3: 系統狀態檢查
function getSystemStatus() {
  const domElements = document.querySelectorAll('*').length;
  const visibleCards = document.querySelectorAll('.card').length;
  
  return {
    phase: 'Phase 3',
    rendering: {
      secureRenderer: !!window.secureRenderer,
      lazyRenderer: !!lazyRenderer,
      templates: window.secureRenderer ? window.secureRenderer.templates.size : 0
    },
    performance: {
      domElements: domElements,
      visibleCards: visibleCards,
      memoryUsage: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A'
    },
    storage: {
      available: isStorageAvailable(),
      quota: checkStorageQuota()
    }
  };
}
