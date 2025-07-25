// Phase 3: UI 模組 - 處理介面相關功能和動畫 (安全渲染)

// 載入介紹內容
function loadIntroduction() {
  console.log('=== Phase 3: 載入介紹內容 ===');
  
  if (!surveyData || !surveyData['說明']) {
    console.log('No introduction data found, using default content');
    return;
  }
  
  const intro = surveyData['說明'];
  const titleElement = document.getElementById('introTitle');
  const contentElement = document.getElementById('introContent');
  const buttonElement = document.getElementById('introNextBtn');
  
  // 設定標題
  if (titleElement) {
    titleElement.textContent = intro['標題'] || 'DEMATEL問卷調查說明';
  }
  
  // 設定內容 (Phase 3: 安全渲染)
  if (contentElement && intro['內容']) {
    // 使用安全的方式處理內容
    contentElement.textContent = ''; // 安全清空
    
    intro['內容'].forEach(line => {
      const p = document.createElement('p');
      if (line.trim() === '') {
        contentElement.appendChild(document.createElement('br'));
      } else if (line.startsWith('填寫說明：') || line.startsWith('本問卷分為三個部分：')) {
        const strong = document.createElement('strong');
        strong.textContent = line;
        p.appendChild(strong);
        contentElement.appendChild(p);
      } else if (line.startsWith('•') || line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.')) {
        p.style.marginLeft = '15px';
        p.textContent = line;
        contentElement.appendChild(p);
      } else {
        p.textContent = line;
        contentElement.appendChild(p);
      }
    });
  }
  
  // 設定按鈕文字
  if (buttonElement && intro['按鈕文字']) {
    buttonElement.textContent = intro['按鈕文字'];
  }
}

// Phase 4: 進度更新函數 (Bootstrap Progress Bar)
function updateProgress() {
  const progressBar = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  if (!progressBar || !progressText) return;
  
  let progressPercent = 0;
  let progressLabel = '';
  
  if (currentPhase === 'intro') {
    progressPercent = 0;
    progressLabel = '準備開始';
  } else if (currentPhase === 'basic') {
    progressPercent = 20;
    progressLabel = '基本資料填寫中';
  } else if (currentPhase === 'survey') {
    if (questions && questions.length > 0) {
      const surveyProgress = Math.floor((idx / questions.length) * 60);
      progressPercent = 20 + surveyProgress;
      progressLabel = `問卷進行中 (${idx + 1}/${questions.length})`;
    } else {
      progressPercent = 20;
      progressLabel = '問卷載入中';
    }
  } else if (currentPhase === 'finish') {
    progressPercent = 100;
    progressLabel = '完成';
  }
  
  // Phase 4: 使用 Bootstrap Progress Bar API
  progressBar.style.width = progressPercent + '%';
  progressBar.setAttribute('aria-valuenow', progressPercent);
  progressText.textContent = progressLabel;
  
  // 動態顏色 (Bootstrap 變體)
  progressBar.className = 'progress-bar progress-bar-striped';
  if (progressPercent < 30) {
    progressBar.classList.add('bg-warning');
  } else if (progressPercent < 70) {
    progressBar.classList.add('bg-info');
  } else if (progressPercent === 100) {
    progressBar.classList.add('bg-success');
  } else {
    progressBar.classList.add('bg-primary');
  }
}

// 其他 UI 處理函數...
function showActionNotification(message, type = 'info', duration = 2000) {
  // 實現略...
}

// 檢查儲存狀態
function checkLocalStorage() {
  const debugInfo = document.getElementById('debugInfo');
  if (!debugInfo) return;
  
  let infoText = '';
  
  try {
    infoText += `localStorage 支援: ${isStorageAvailable() ? "✓" : "✗"}\n`;
    
    const dematelAnswers = loadData('answers');
    const dematelPhase = loadData('phase');
    const dematelIdx = loadData('idx');
    
    infoText += `answers: ${dematelAnswers ? "有資料" : "無"}\n`;
    infoText += `phase: ${dematelPhase || "無"}\n`;
    infoText += `idx: ${dematelIdx || "無"}\n`;
    
    if (window.secureRenderer) {
      infoText += `安全渲染: ✓\n`;
    }
    
    // Phase 5: 壓縮工具狀態
    if (window.compressionUtils) {
      infoText += `Phase 5 壓縮: ✓\n`;
      infoText += `LZ-String: ${window.LZString ? "✓" : "✗"}\n`;
      infoText += `SparkMD5: ${window.SparkMD5 ? "✓" : "✗"}\n`;
    }
    
  } catch(e) {
    infoText += `檢查錯誤: ${e.message}\n`;
  }
  
  debugInfo.textContent = infoText;
}

function clearDebugStorage() {
  if (confirm('確定要清除所有 localStorage 資料嗎？')) {
    clearAllData();
    checkLocalStorage();
    alert('已清除所有儲存資料');
  }
}

// Phase 5: 新增壓縮效能測試功能
function testCompressionPerformance() {
  if (!window.compressionUtils) {
    alert('壓縮工具未載入');
    return;
  }
  
  const testData = {
    basicInfo: {
      姓名: "測試使用者",
      機構: "測試機構",
      專業領域: "資訊科技",
      工作年資: "5-10年"
    },
    answers: {},
    metadata: {
      timestamp: new Date().toISOString(),
      totalQuestions: 100,
      completedQuestions: 100
    }
  };
  
  // 產生測試答案
  for (let i = 0; i < 100; i++) {
    testData.answers[`q${i}`] = Math.floor(Math.random() * 5);
  }
  
  console.log('=== Phase 5: 開始壓縮效能測試 ===');
  window.compressionUtils.performanceTest(testData);
  
  alert('壓縮效能測試完成，請查看控制台輸出');
}

function toggleDebugPanel() {
  const panel = document.getElementById('debugPanel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
}
