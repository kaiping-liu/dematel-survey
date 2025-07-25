// 數據模組 - 處理 JSON 載入、資料管理和 QR Code 功能

/**
 * 動態載入問卷結構，優先使用快取
 * @param {string} fileName - JSON 文件名
 */
function loadJSON(fileName) {
  // 首先嘗試從快取載入
  const cachedData = loadSurveyData();
  if (cachedData) {
    console.log('Using cached survey data');
    processSurveyData(cachedData);
    return;
  }
  
  // 如果沒有快取，則從網路載入
  console.log('Loading survey data from network');
  const cacheBuster = '?t=' + Date.now();
  fetch(fileName + cacheBuster, {
    cache: 'no-cache',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      // 保存到快取
      saveSurveyData(data);
      processSurveyData(data);
    })
    .catch(error => {
      console.error('Error loading JSON:', error);
      alert('載入問卷結構失敗，請重新整理頁面');
    });
}

/**
 * 處理問卷資料
 * @param {Object} data - 問卷結構資料
 */
function processSurveyData(data) {
  surveyData = data;
  
  // 生成所有題目
  generateAllQuestions(data);
  
  // 計算資料的 MD5 hash
  const currentDataHash = calculateMD5(JSON.stringify(data));
  const savedDataHash = loadDataHash();
  
  if (savedDataHash && savedDataHash !== currentDataHash) {
    // JSON資料已變化，強制重填
    alert('檢測到問卷資料已更新，需要重新填寫。將清除之前的資料。');
    clearAllData();
    saveDataHash(currentDataHash);
    console.log('Updated data hash after clearing:', currentDataHash);
    initializePage();
  } else if (savedDataHash === currentDataHash) {
    // 資料相同，詢問是否繼續
    saveDataHash(currentDataHash);
    console.log('Confirmed data hash:', currentDataHash);
    checkAndRestoreProgress();
  } else {
    // 第一次載入，沒有儲存的 hash
    saveDataHash(currentDataHash);
    console.log('First time - saved data hash:', currentDataHash);
    initializePage();
  }
}

// 簡單的 MD5 計算函數（使用 cyrb53 hash）
function calculateMD5(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0].map(x => x.toString(16).padStart(8, '0')).join('');
}

// 檢查並恢復進度或詢問用戶
function checkAndRestoreProgress() {
  const status = getStorageStatus();
  
  // 檢查是否有任何儲存的資料
  const hasData = status.hasAnswers || status.hasBasicInfo || status.currentPhase !== 'intro';
  
  if (hasData) {
    // 有儲存的資料，詢問用戶是否要繼續
    const userChoice = confirm('檢測到您之前有填寫過的資料。\n\n點擊「確定」繼續上次的進度\n點擊「取消」清除資料重新開始');
    
    if (userChoice) {
      // 用戶選擇繼續，恢復進度
      restoreProgress();
    } else {
      // 用戶選擇重新開始，清除所有資料
      clearAllData();
      initializePage();
    }
  } else {
    // 如果沒有資料，初始化頁面
    initializePage();
  }
}

// 恢復之前的進度
function restoreProgress() {
  // 使用新的儲存 API 載入資料
  answers = loadAnswers();
  basicInfo = loadBasicInfo();
  const progress = loadProgress();
  currentPhase = progress.phase;
  idx = progress.index;
  
  console.log('=== 恢復進度 ===');
  console.log('已恢復答案:', answers);
  console.log('已恢復階段:', currentPhase);
  console.log('已恢復索引:', idx);
  
  if (currentPhase === 'basic') {
    document.getElementById('introSection').style.display = 'none';
    document.getElementById('basicInfoSection').style.display = 'block';
    loadBasicInfoForm();
  } else if (currentPhase === 'survey') {
    document.getElementById('introSection').style.display = 'none';
    document.getElementById('basicInfoSection').style.display = 'none';
    document.getElementById('surveySection').style.display = 'block';
    
    // 驗證儲存的 idx 是否合理
    if (idx < 0 || idx >= questions.length) {
      console.log('儲存的 idx 不合理，重新計算');
      idx = findLastAnsweredQuestion();
    }
    
    console.log('最終的 idx:', idx);
    console.log(`這表示已完成 ${idx} 題，將顯示第 ${idx + 1} 題`);
    
    loadSurveyQuestions(false);
    fillPrev();
    render();
  } else if (currentPhase === 'finish') {
    document.getElementById('introSection').style.display = 'none';
    document.getElementById('basicInfoSection').style.display = 'none';
    document.getElementById('surveySection').style.display = 'none';
    document.getElementById('finishSection').style.display = 'block';
  }
  
  updateProgress();
}

// 找到最後答題的位置
function findLastAnsweredQuestion() {
  let lastAnsweredIndex = -1;
  
  console.log('=== findLastAnsweredQuestion Debug ===');
  console.log('Total questions:', questions.length);
  console.log('Current answers:', answers);
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    let answerKey;
    
    if (q.key) {
      answerKey = q.key;
    } else {
      answerKey = `${q.A.name}_${q.B.name}`;
    }
    
    console.log(`Question ${i}: key=${answerKey}, answered=${!!answers[answerKey]}`);
    
    if (answers[answerKey]) {
      lastAnsweredIndex = i;
    } else {
      break;
    }
  }
  
  const nextQuestionIndex = lastAnsweredIndex + 1;
  
  if (nextQuestionIndex >= questions.length) {
    const finalIndex = questions.length - 1;
    console.log('All questions answered, staying at last question:', finalIndex);
    return finalIndex;
  }
  
  console.log('Last answered question index:', lastAnsweredIndex);
  console.log('Next question index (return value):', nextQuestionIndex);
  console.log(`This means: answered ${lastAnsweredIndex + 1} questions, should show question ${nextQuestionIndex + 1}`);
  
  return nextQuestionIndex;
}

// ===== QR Code 和壓縮相關函數 =====

function generateHash(data) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(JSON.stringify(data));
  return crypto.subtle.digest('SHA-256', dataBytes).then(hashBuffer => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  });
}

// Phase 5: 使用新的壓縮工具
function compressToBase64(jsonString) {
  try {
    if (window.compressionUtils) {
      return window.compressionUtils.compress(jsonString);
    } else {
      // 向後相容
      const compressed = pako.deflate(jsonString);
      const base64 = btoa(String.fromCharCode.apply(null, compressed));
      return base64;
    }
  } catch (error) {
    console.error('壓縮失敗:', error);
    return null;
  }
}

function decompressFromBase64(base64String) {
  try {
    if (window.compressionUtils) {
      return window.compressionUtils.decompress(base64String);
    } else {
      // 向後相容
      const compressed = Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
      const decompressed = pako.inflate(compressed, { to: 'string' });
      return decompressed;
    }
  } catch (error) {
    console.error('解壓縮失敗:', error);
    return null;
  }
}

function createKeyMappings(obj) {
  const keys = Object.keys(obj);
  const dictionary = {};
  const values = {};
  
  keys.forEach((key, index) => {
    const shortKey = String.fromCharCode(97 + index);
    dictionary[shortKey] = key;
    values[shortKey] = obj[key];
  });
  
  return { d: dictionary, v: values };
}

function restoreFromKeyMappings(d, v) {
  const restored = {};
  Object.keys(v).forEach(shortKey => {
    const originalKey = d[shortKey];
    if (originalKey) {
      restored[originalKey] = v[shortKey];
    }
  });
  return restored;
}

function splitIntoSegments(base64String, maxLength = 800) {
  if (base64String.length <= maxLength) {
    return [{ i: 0, total: 1, part: base64String }];
  }
  
  const totalLength = base64String.length;
  const idealSegmentCount = Math.ceil(totalLength / maxLength);
  const optimalSegmentLength = Math.ceil(totalLength / idealSegmentCount);
  
  const segments = [];
  let index = 0;
  
  for (let i = 0; i < base64String.length; i += optimalSegmentLength) {
    const part = base64String.substring(i, i + optimalSegmentLength);
    segments.push({
      i: index,
      total: idealSegmentCount,
      part: part
    });
    index++;
  }
  
  return segments;
}

// 驗證完整性的函數
function validateCompletion() {
  // 1. 驗證基本資料完整性
  if (!validateBasicInfo()) {
    alert('請先完整填寫基本資料中的必填欄位');
    return false;
  }
  
  // 2. 驗證問卷完整性
  if (!questions || questions.length === 0) {
    alert('問卷尚未載入完成，請稍候再試');
    return false;
  }
  
  const totalQuestions = questions.length;
  const completedQuestions = Object.keys(answers).length;
  
  if (completedQuestions < totalQuestions) {
    alert(`問卷尚未完成！您已完成 ${completedQuestions} 題，還有 ${totalQuestions - completedQuestions} 題未完成。`);
    return false;
  }
  
  // 3. 驗證每個答案的完整性
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const answer = answers[q.key];
    
    if (!answer) {
      alert(`第 ${i + 1} 題答案遺失，請重新檢查問卷`);
      return false;
    }
    
    if (answer.relation === 'to' && !answer.score) {
      alert(`第 ${i + 1} 題影響程度分數遺失`);
      return false;
    }
    
    if (answer.relation === 'from' && !answer.score) {
      alert(`第 ${i + 1} 題影響程度分數遺失`);
      return false;
    }
    
    if (answer.relation === 'bi' && (!answer.score_XtoY || !answer.score_YtoX)) {
      alert(`第 ${i + 1} 題雙向影響分數不完整`);
      return false;
    }
  }
  
  return true;
}

// 驗證後下載
function validateAndDownload() {
  if (validateCompletion()) {
    download();
  }
}

// Phase 5: 驗證後產生QR Code (使用新的壓縮分段工具)
function validateAndShowQRCode() {
  if (validateCompletion()) {
    showQRCodeWithCompression();
  }
}

async function showQRCodeWithCompression() {
  console.log('=== Phase 5: QR Code 產生流程開始 ===');
  
  try {
    const fullData = {
      basicInfo: basicInfo,
      answers: answers,
      metadata: {
        timestamp: new Date().toISOString(),
        totalQuestions: questions.length,
        completedQuestions: Object.keys(answers).length
      }
    };
    
    console.log('完整資料:', fullData);
    
    // Phase 5: 使用新的壓縮分段工具
    if (window.compressionUtils) {
      const result = window.compressionUtils.compressAndSegment(fullData);
      console.log('壓縮分段結果:', result);
      
      renderQRCodeSegments(result);
    } else {
      // 向後相容的舊方法
      console.warn('壓縮工具不可用，使用舊方法');
      showQRCode();
    }
    
  } catch (error) {
    console.error('QR Code 生成失敗:', error);
    alert('QR Code 生成失敗: ' + error.message);
  }
}

function renderQRCodeSegments(compressionResult) {
  const { segments, totalSegments, checksum, needsSegmentation } = compressionResult;
  
  const qrWrap = document.getElementById('qrcode-wrap');
  const qrSegments = document.getElementById('qrcode-segments');
  
  qrSegments.innerHTML = '';
  
  // Phase 5: 智慧指示訊息
  const instructionDiv = document.createElement('div');
  instructionDiv.className = 'alert alert-info mb-3';
  instructionDiv.innerHTML = `
    <h4 class="alert-heading">📱 資料匯出指示</h4>
    <p class="mb-2">
      ${needsSegmentation 
        ? `由於資料量較大，已自動分割為 <strong>${totalSegments}</strong> 個 QR Code。`
        : `資料已產生為 <strong>1</strong> 個 QR Code。`
      }
    </p>
    <hr>
    <p class="mb-0">
      ${needsSegmentation 
        ? `請將下方<strong>所有QR Code</strong>分別截圖，並將截圖檔案回傳給研究人員。每個QR Code都包含問卷資料的一部分，缺一不可。`
        : `請將下方QR Code截圖，並將截圖檔案回傳給研究人員。`
      }
    </p>
    ${checksum ? `<small class="text-muted mt-2 d-block">資料校驗碼: ${checksum.substring(0, 8)}...</small>` : ''}
  `;
  qrSegments.appendChild(instructionDiv);
  
  // Phase 5: 分段數量警告
  if (totalSegments > 10) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'alert alert-warning mb-3';
    warningDiv.innerHTML = `
      <h5>⚠️ 分段數量過多提醒</h5>
      <p class="mb-0">目前需要 ${totalSegments} 個 QR Code，建議簡化問卷內容以減少分段數量。</p>
    `;
    qrSegments.appendChild(warningDiv);
  }
  
  // Phase 5: 渲染每個分段
  segments.forEach((segment, index) => {
    const segmentDiv = document.createElement('div');
    segmentDiv.className = 'qr-segment card mb-3';
    
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body text-center';
    
    const title = document.createElement('h5');
    title.className = 'card-title';
    title.textContent = needsSegmentation 
      ? `第 ${index + 1} 段 / 共 ${totalSegments} 段`
      : `問卷資料 QR Code`;
    cardBody.appendChild(title);
    
    const sizeInfo = document.createElement('p');
    sizeInfo.className = 'card-text text-muted small';
    sizeInfo.textContent = `資料量: ${segment.length} 字元`;
    cardBody.appendChild(sizeInfo);
    
    const qrDiv = document.createElement('div');
    qrDiv.id = `qr-${index}`;
    qrDiv.style.margin = '15px auto';
    qrDiv.style.display = 'inline-block';
    cardBody.appendChild(qrDiv);
    
    const showDataBtn = document.createElement('button');
    showDataBtn.className = 'btn btn-outline-secondary btn-sm mt-2';
    showDataBtn.textContent = '顯示原始資料';
    
    const pre = document.createElement('pre');
    pre.className = 'text-start mt-2';
    pre.style.fontSize = '0.7em';
    pre.style.wordBreak = 'break-all';
    pre.style.backgroundColor = '#f8f9fa';
    pre.style.padding = '8px';
    pre.style.borderRadius = '4px';
    pre.style.display = 'none';
    pre.style.maxHeight = '200px';
    pre.style.overflow = 'auto';
    pre.textContent = segment;
    
    showDataBtn.onclick = function() {
      if (pre.style.display === 'none') {
        pre.style.display = 'block';
        showDataBtn.textContent = '隱藏原始資料';
      } else {
        pre.style.display = 'none';
        showDataBtn.textContent = '顯示原始資料';
      }
    };
    
    cardBody.appendChild(showDataBtn);
    cardBody.appendChild(pre);
    segmentDiv.appendChild(cardBody);
    qrSegments.appendChild(segmentDiv);
    
    // 生成 QR Code
    new QRCode(qrDiv, {
      text: segment,
      width: 240,
      height: 240,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  });
  
  qrWrap.style.display = 'block';
}

// 向後相容的舊方法
async function showQRCode() {
  console.log('=== QR Code 產生流程開始 (舊版) ===');
  
  const fullData = {
    basicInfo: basicInfo,
    answers: answers,
    metadata: {
      timestamp: new Date().toISOString(),
      totalQuestions: questions.length,
      completedQuestions: Object.keys(answers).length
    }
  };
  console.log('完整資料:', fullData);
  
  const { d, v } = createKeyMappings(fullData);
  console.log('字典 (d):', d);
  console.log('縮短後的值 (v):', v);
  
  const hash = await generateHash(v);
  console.log('SHA-256 hash (h):', hash);
  
  const packagedData = { d, v, h: hash };
  const jsonString = JSON.stringify(packagedData);
  console.log('打包後的 JSON:', jsonString);
  
  const compressedBase64 = compressToBase64(jsonString);
  if (!compressedBase64) {
    alert('資料壓縮失敗');
    return;
  }
  
  console.log('壓縮後的 base64 長度:', compressedBase64.length);
  
  const segments = splitIntoSegments(compressedBase64);
  console.log('分割片段:', segments);
  
  const qrWrap = document.getElementById('qrcode-wrap');
  const qrSegments = document.getElementById('qrcode-segments');
  
  qrSegments.innerHTML = '';
  
  const instructionDiv = document.createElement('div');
  instructionDiv.style.width = '100%';
  instructionDiv.style.textAlign = 'center';
  instructionDiv.style.marginBottom = '20px';
  instructionDiv.style.padding = '15px';
  instructionDiv.style.backgroundColor = '#e3f2fd';
  instructionDiv.style.borderRadius = '8px';
  instructionDiv.style.border = '1px solid #2196f3';
  instructionDiv.innerHTML = `
    <h4 style="color: #1976d2; margin: 0 0 10px 0;">📱 截圖說明</h4>
    <p style="margin: 0; color: #1565c0; font-size: 0.95em;">
      請將下方<strong>所有QR Code</strong>分別截圖，並將截圖檔案回傳給研究人員。<br>
      每個QR Code都包含問卷資料的一部分，缺一不可。
    </p>
  `;
  qrSegments.appendChild(instructionDiv);
  
  segments.forEach((segment, index) => {
    const segmentDiv = document.createElement('div');
    segmentDiv.className = 'qr-segment';
    
    const title = document.createElement('h4');
    title.textContent = `第 ${index + 1} 個 QR Code（共 ${segments.length} 個）`;
    segmentDiv.appendChild(title);
    
    const sizeInfo = document.createElement('p');
    sizeInfo.style.fontSize = '0.85em';
    sizeInfo.style.color = '#666';
    sizeInfo.style.margin = '5px 0 10px 0';
    sizeInfo.textContent = `資料量: ${segment.part.length} 字元`;
    segmentDiv.appendChild(sizeInfo);
    
    const qrDiv = document.createElement('div');
    qrDiv.id = `qr-${index}`;
    qrDiv.style.margin = '15px auto';
    segmentDiv.appendChild(qrDiv);
    
    const showDataBtn = document.createElement('button');
    showDataBtn.textContent = '顯示原始資料';
    showDataBtn.style.fontSize = '0.8em';
    showDataBtn.style.padding = '5px 10px';
    showDataBtn.style.marginTop = '10px';
    showDataBtn.style.backgroundColor = '#f8f9fa';
    showDataBtn.style.border = '1px solid #ddd';
    showDataBtn.style.borderRadius = '4px';
    showDataBtn.style.cursor = 'pointer';
    
    const pre = document.createElement('pre');
    pre.style.fontSize = '0.7em';
    pre.style.wordBreak = 'break-all';
    pre.style.backgroundColor = '#f8f9fa';
    pre.style.padding = '8px';
    pre.style.borderRadius = '4px';
    pre.style.marginTop = '8px';
    pre.style.display = 'none';
    pre.textContent = JSON.stringify(segment);
    
    showDataBtn.onclick = function() {
      if (pre.style.display === 'none') {
        pre.style.display = 'block';
        showDataBtn.textContent = '隱藏原始資料';
      } else {
        pre.style.display = 'none';
        showDataBtn.textContent = '顯示原始資料';
      }
    };
    
    segmentDiv.appendChild(showDataBtn);
    segmentDiv.appendChild(pre);
    qrSegments.appendChild(segmentDiv);
    
    new QRCode(qrDiv, {
      text: JSON.stringify(segment),
      width: 240,
      height: 240,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  });
  
  qrWrap.style.display = 'block';
}

function hideQRCode() {
  document.getElementById('qrcode-wrap').style.display = 'none';
}

// Phase 5: 增強的驗證和還原功能
async function verifyAndRestore() {
  const input = document.getElementById('verificationInput').value.trim();
  const resultArea = document.getElementById('verificationResult');
  
  if (!input) {
    resultArea.innerHTML = '<div class="alert alert-warning">請輸入要驗證的資料</div>';
    return;
  }
  
  try {
    console.log('=== Phase 5: 驗證還原流程開始 ===');
    
    // Phase 5: 支援新格式和舊格式
    if (window.compressionUtils && input.includes('"_metadata"')) {
      // 新格式：直接使用 compressionUtils
      await verifyWithCompressionUtils(input, resultArea);
    } else {
      // 舊格式：使用原有邏輯
      await verifyLegacyFormat(input, resultArea);
    }
    
  } catch (error) {
    console.error('驗證還原失敗:', error);
    resultArea.innerHTML = `<div class="alert alert-danger">❌ 驗證失敗：${error.message}</div>`;
  }
}

async function verifyWithCompressionUtils(input, resultArea) {
  const lines = input.split('\n').filter(line => line.trim());
  const segments = [];
  
  // 解析分段資料
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line.trim());
      segments.push(parsed);
    } catch {
      // 如果不是 JSON，當作純文字分段處理
      segments.push(line.trim());
    }
  }
  
  console.log('解析的分段:', segments);
  
  // 使用新的組合解壓縮功能
  const restored = window.compressionUtils.combineAndDecompress(segments);
  
  resultArea.innerHTML = `
    <div class="alert alert-success">
      <h5>✅ Phase 5 驗證成功</h5>
      <p class="mb-2">資料完整性驗證通過，校驗和匹配。</p>
      <small class="text-muted">使用了增強的壓縮分段系統</small>
    </div>
    <div class="mt-3">
      <h6>還原的原始資料：</h6>
      <pre class="bg-light p-3 rounded" style="max-height: 300px; overflow-y: auto; font-size: 0.85em;">${JSON.stringify(restored, null, 2)}</pre>
    </div>
  `;
}

async function verifyLegacyFormat(input, resultArea) {
  const lines = input.split('\n').filter(line => line.trim());
  const segments = lines.map(line => JSON.parse(line.trim()));
  
  segments.sort((a, b) => a.i - b.i);
  
  const reconstructedBase64 = segments.map(s => s.part).join('');
  
  const decompressed = decompressFromBase64(reconstructedBase64);
  if (!decompressed) {
    throw new Error('解壓縮失敗');
  }
  
  const packagedData = JSON.parse(decompressed);
  const { d, v, h } = packagedData;
  
  const calculatedHash = await generateHash(v);
  if (calculatedHash !== h) {
    resultArea.innerHTML = '<div class="alert alert-danger">❌ 驗證失敗：資料可能已被篡改</div>';
    return;
  }
  
  const restored = restoreFromKeyMappings(d, v);
  
  resultArea.innerHTML = `
    <div class="alert alert-success">
      <h5>✅ 舊格式驗證成功</h5>
      <p class="mb-0">資料完整且未被篡改</p>
    </div>
    <div class="mt-3">
      <h6>還原的原始資料：</h6>
      <pre class="bg-light p-3 rounded" style="max-height: 300px; overflow-y: auto; font-size: 0.85em;">${JSON.stringify(restored, null, 2)}</pre>
    </div>
  `;
}

function download() {
  const fullData = {
    basicInfo: basicInfo,
    answers: answers,
    metadata: {
      timestamp: new Date().toISOString(),
      totalQuestions: questions.length,
      completedQuestions: Object.keys(answers).length
    }
  };
  
  const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dematel-survey-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// P0: 實作 loadBasicInfoForm 函數
function loadBasicInfoForm() {
  console.log('Loading basic info form...');
  
  if (!window.surveyStructure || !window.surveyStructure.basic) {
    console.error('Survey structure not loaded or missing basic info');
    return;
  }

  const form = document.getElementById('basicInfoForm');
  if (!form) {
    console.error('Basic info form container not found');
    return;
  }

  // 清空現有內容
  form.innerHTML = '';

  // 創建安全渲染器實例
  const renderer = new SecureRenderer();

  // 載入已保存的基本資料
  const savedBasicInfo = loadBasicInfoFromLocal();

  // 渲染每個欄位
  window.surveyStructure.basic.forEach(fieldConfig => {
    try {
      const fieldElement = renderer.renderField(fieldConfig);
      
      // 設置已保存的值
      if (savedBasicInfo && savedBasicInfo[fieldConfig.編號]) {
        const value = savedBasicInfo[fieldConfig.編號];
        const input = fieldElement.querySelector('input, select');
        
        if (input) {
          if (fieldConfig.類型 === 'checkbox') {
            // 處理 checkbox 陣列值
            if (Array.isArray(value)) {
              const checkboxes = fieldElement.querySelectorAll('input[type="checkbox"]');
              checkboxes.forEach(checkbox => {
                if (value.includes(checkbox.value)) {
                  checkbox.checked = true;
                }
              });
            }
          } else if (fieldConfig.類型 === 'radio') {
            // 處理 radio 值
            const radio = fieldElement.querySelector(`input[value="${value}"]`);
            if (radio) radio.checked = true;
          } else {
            // 處理一般輸入值
            input.value = value;
          }
        }
      }

      // 添加事件監聽器
      const inputs = fieldElement.querySelectorAll('input, select');
      inputs.forEach(input => {
        const eventType = input.type === 'checkbox' || input.type === 'radio' ? 'change' : 'input';
        input.addEventListener(eventType, saveBasicInfoToLocal);
      });

      // 添加到表單
      form.appendChild(fieldElement);
      
    } catch (error) {
      console.error(`Error rendering field ${fieldConfig.編號}:`, error);
    }
  });

  console.log('Basic info form loaded successfully');
}

// P0: 保存基本資料到本地儲存
function saveBasicInfoToLocal() {
  const form = document.getElementById('basicInfoForm');
  if (!form) return;

  const basicInfo = {};
  
  // 收集所有欄位數據
  window.surveyStructure.basic.forEach(fieldConfig => {
    const fieldId = fieldConfig.編號;
    const fieldType = fieldConfig.類型;
    
    if (fieldType === 'checkbox') {
      // 處理 checkbox 群組
      const checkboxes = form.querySelectorAll(`input[name="${fieldId}[]"]:checked`);
      basicInfo[fieldId] = Array.from(checkboxes).map(cb => cb.value);
    } else if (fieldType === 'radio') {
      // 處理 radio 群組
      const radio = form.querySelector(`input[name="${fieldId}"]:checked`);
      if (radio) {
        basicInfo[fieldId] = radio.value;
      }
    } else {
      // 處理一般輸入欄位
      const input = form.querySelector(`[name="${fieldId}"]`);
      if (input && input.value) {
        basicInfo[fieldId] = input.value;
      }
    }
  });

  // 儲存到 localStorage
  try {
    localStorage.setItem('dematel_basic_info', JSON.stringify(basicInfo));
    console.log('Basic info saved:', basicInfo);
  } catch (error) {
    console.error('Failed to save basic info:', error);
  }
}

// P0: 從本地儲存載入基本資料
function loadBasicInfoFromLocal() {
  try {
    const saved = localStorage.getItem('dematel_basic_info');
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Failed to load basic info:', error);
    return {};
  }
}
