// 問卷邏輯模組 - 包含問卷核心邏輯函數

// 渲染問卷題目
function render() {
  const el = document.getElementById('main');
  
  if (idx >= questions.length) {
    currentPhase = 'finish';
    
    if (isAnimating) return;
    
    disablePageInteraction();
    addPageTransitionStyles();
    
    const surveySection = document.getElementById('surveySection');
    const finishSection = document.getElementById('finishSection');
    
    if (surveySection) {
      surveySection.classList.remove('page-transition-out', 'page-transition-in', 'page-transition-out-reverse', 'page-transition-in-reverse');
    }
    if (finishSection) {
      finishSection.classList.remove('page-transition-out', 'page-transition-in', 'page-transition-out-reverse', 'page-transition-in-reverse');
    }
    
    if (surveySection) {
      surveySection.classList.add('page-transition-out');
    }
    
    setTimeout(() => {
      document.getElementById('surveySection').style.display = 'none';
      document.getElementById('finishSection').style.display = 'block';
      updateProgress();
      
      if (surveySection) {
        surveySection.classList.remove('page-transition-out');
      }
      
      if (finishSection) {
        finishSection.classList.add('page-transition-in');
        
        setTimeout(() => {
          finishSection.classList.remove('page-transition-in');
          enablePageInteraction();
        }, 400);
      }
    }, 400);
    
    return;
  }
  
  const q = questions[idx];
  let phaseLabel = q.type === 'criteria' ? '第二部分：準則比較' : '第三部分：構面比較';
  let phaseColor = q.type === 'criteria' ? '#2a5298' : '#58aa5a';
  let nameA = q.A.name, nameB = q.B.name;
  let descA = q.A.desc || '', descB = q.B.desc || '';
  
  let currentQuestionNumber = idx + 1;
  let critNow = 0;
  let dimNow = 0;
  
  if (q.type === 'criteria') {
    critNow = questions.slice(0, idx + 1).filter(qq => qq.type === 'criteria').length;
  } else {
    critNow = critTotal;
    dimNow = questions.slice(0, idx + 1).filter(qq => qq.type === 'dimension').length;
  }
  
  let critText = `準則 ${critNow} / ${critTotal} 題`;
  let dimText = `構面 ${dimNow} / ${dimTotal} 題`;
  let percent = Math.floor((idx / questions.length) * 100);
  
  el.innerHTML = `
    <div class="form-title">${phaseLabel}</div>
    <div class="intro-content" style="background: #fff9f9; border-left: 4px solid #d4a373;">
      <div class="step-title">${q.type === 'criteria' ? '請判斷下列準則互相之間的關係' : '請判斷下列構面互相之間的關係'}</div>
      <div class="desc-row">
        <div class="desc-block">
          <div class="block-title">${formatName(nameA)}</div>
          <div class="desc-content">${descA.replace(/\n/g,'<br>')}</div>
        </div>
        <div class="block-vs">vs.</div>
        <div class="desc-block">
          <div class="block-title">${formatName(nameB)}</div>
          <div class="desc-content">${descB.replace(/\n/g,'<br>')}</div>
        </div>
      </div>
      <div class="relation-group relation-buttons">
        <button class="btn${rel==='X'?' selected':''}" type="button" onclick="chooseRel('X')">兩者無關</button>
        <button class="btn${rel==='to'?' selected':''}" type="button" onclick="chooseRel('to')">${formatName(nameA)} 影響 ${formatName(nameB)}</button>
        <button class="btn${rel==='from'?' selected':''}" type="button" onclick="chooseRel('from')">${formatName(nameB)} 影響 ${formatName(nameA)}</button>
        <button class="btn${rel==='bi'?' selected':''}" type="button" onclick="chooseRel('bi')">兩者互相影響</button>
      </div>
      <div class="control-buttons">
        ${idx > 0 ? `<button class="btn btn-outline-primary btn-lg" onclick="prevStep()">← 上一題</button>` : ""}
        <button class="btn btn-primary btn-lg" id="nextBtn" style="display:none;" onclick="saveStep()">下一題 →</button>
      </div>
    </div>
  `;
  
  renderScore();
  updateProgress();
}

// 選擇關係
function chooseRel(v) {
  rel = v;
  score1 = '';
  score2 = '';
  render();

  console.log('=== chooseRel Debug ===');
  console.log('Selected relation:', v);
  console.log('Current question idx:', idx);
  console.log('rel variable set to:', rel);

  if (v === 'X') {
    const q = questions[idx];
    const key = q.key;
    answers[key] = { relation: 'X' };
    console.log('Immediately saved "X" answer for question', idx + 1, ':', answers[key]);
    
    closeScoreModal();
    goNextPage();
  } else {
    showScoreModal();
  }
}

// 分數選擇模態框
function showScoreModal() {
  let modal = document.getElementById('scoreModal');
  if (!modal) {
    modal = createScoreModal();
  }
  
  updateScoreModalContent();
  modal.style.display = 'flex';
  
  setTimeout(() => {
    modal.classList.add('modal-show');
  }, 10);
}

function closeScoreModal(opts = {}) {
  const modal = document.getElementById('scoreModal');
  if (modal) {
    modal.classList.remove('modal-show');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  }
  
  if (!opts.keepSelection) {
    rel = '';
    score1 = '';
    score2 = '';
  }
  
  render();
}

function createScoreModal() {
  const modal = document.createElement('div');
  modal.id = 'scoreModal';
  modal.className = 'score-modal';
  
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeScoreModal()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">選擇影響程度</h3>
        <button class="modal-close" onclick="closeScoreModal()">&times;</button>
      </div>
      <div class="modal-body" id="modalScoreContent">
        <!-- 分數選擇內容將在這裡動態生成 -->
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  return modal;
}

function updateScoreModalContent() {
  const content = document.getElementById('modalScoreContent');
  if (!content) return;
  
  if (rel === '' || rel === 'X') {
    content.innerHTML = '';
    return;
  }
  
  const q = questions[idx];
  let html = '';
  
  if (rel === 'to') {
    html = `
      <div class="modal-relation-info">
        <strong>${formatName(q.A.name)}</strong> 影響 <strong>${formatName(q.B.name)}</strong>
      </div>
      <div class="modal-score-title">請選擇影響程度 (1=低影響, 4=高影響)</div>
      <div class="modal-score-group">
        <button class="modal-score-btn${score1==='1'?' selected':''}" onclick="chooseScoreInModal(1, '1')">1</button>
        <button class="modal-score-btn${score1==='2'?' selected':''}" onclick="chooseScoreInModal(1, '2')">2</button>
        <button class="modal-score-btn${score1==='3'?' selected':''}" onclick="chooseScoreInModal(1, '3')">3</button>
        <button class="modal-score-btn${score1==='4'?' selected':''}" onclick="chooseScoreInModal(1, '4')">4</button>
      </div>
    `;
  } else if (rel === 'from') {
    html = `
      <div class="modal-relation-info">
        <strong>${formatName(q.B.name)}</strong> 影響 <strong>${formatName(q.A.name)}</strong>
      </div>
      <div class="modal-score-title">請選擇影響程度 (1=低影響, 4=高影響)</div>
      <div class="modal-score-group">
        <button class="modal-score-btn${score2==='1'?' selected':''}" onclick="chooseScoreInModal(2, '1')">1</button>
        <button class="modal-score-btn${score2==='2'?' selected':''}" onclick="chooseScoreInModal(2, '2')">2</button>
        <button class="modal-score-btn${score2==='3'?' selected':''}" onclick="chooseScoreInModal(2, '3')">3</button>
        <button class="modal-score-btn${score2==='4'?' selected':''}" onclick="chooseScoreInModal(2, '4')">4</button>
      </div>
    `;
  } else if (rel === 'bi') {
    html = `
      <div class="modal-relation-info">
        <strong>兩者互相影響</strong>
      </div>
      <div class="modal-score-section">
        <div class="modal-score-title">${formatName(q.A.name)} → ${formatName(q.B.name)} 的影響程度</div>
        <div class="modal-score-group">
          <button class="modal-score-btn${score1==='1'?' selected':''}" onclick="chooseScoreInModal(1, '1')">1</button>
          <button class="modal-score-btn${score1==='2'?' selected':''}" onclick="chooseScoreInModal(1, '2')">2</button>
          <button class="modal-score-btn${score1==='3'?' selected':''}" onclick="chooseScoreInModal(1, '3')">3</button>
          <button class="modal-score-btn${score1==='4'?' selected':''}" onclick="chooseScoreInModal(1, '4')">4</button>
        </div>
      </div>
      <div class="modal-score-section">
        <div class="modal-score-title">${formatName(q.B.name)} → ${formatName(q.A.name)} 的影響程度</div>
        <div class="modal-score-group">
          <button class="modal-score-btn${score2==='1'?' selected':''}" onclick="chooseScoreInModal(2, '1')">1</button>
          <button class="modal-score-btn${score2==='2'?' selected':''}" onclick="chooseScoreInModal(2, '2')">2</button>
          <button class="modal-score-btn${score2==='3'?' selected':''}" onclick="chooseScoreInModal(2, '3')">3</button>
          <button class="modal-score-btn${score2==='4'?' selected':''}" onclick="chooseScoreInModal(2, '4')">4</button>
        </div>
      </div>
    `;
  }
  
  content.innerHTML = html;
}

function chooseScoreInModal(idxN, v) {
  if (idxN === 1) score1 = v;
  if (idxN === 2) score2 = v;
  
  console.log('=== chooseScoreInModal Debug ===');
  console.log('Selected score for index', idxN, ':', v);
  console.log('Current scores - score1:', score1, 'score2:', score2);
  
  updateScoreModalContent();
  render();
  
  const q = questions[idx];
  
  let isComplete = false;
  if (rel === 'to' && score1) {
    isComplete = true;
  } else if (rel === 'from' && score2) {
    isComplete = true;
  } else if (rel === 'bi' && score1 && score2) {
    isComplete = true;
  }
  
  console.log('Question complete status:', isComplete);
  
  if (isComplete) {
    const key = q.key;
    if (rel === 'to') {
      answers[key] = { relation: 'to', score: score1 };
    } else if (rel === 'from') {
      answers[key] = { relation: 'from', score: score2 };
    } else if (rel === 'bi') {
      answers[key] = { relation: 'bi', score_XtoY: score1, score_YtoX: score2 };
    }
    
    console.log('Completed answer for question', idx + 1, ':', answers[key]);
    
    setTimeout(() => {
      closeScoreModal({ keepSelection: true });
      
      setTimeout(() => {
        goNextPage();
      }, 300);
    }, 500);
  }
}

function renderScore() {
  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) {
    if (rel === 'X' || 
       (rel === 'to' && score1) || 
       (rel === 'from' && score2) || 
       (rel === 'bi' && score1 && score2)) {
      nextBtn.style.display = 'inline-block';
    } else {
      nextBtn.style.display = 'none';
    }
  }
}

function goNextPage() {
  idx++;
  console.log('Updated idx to:', idx, '(已完成', idx, '題)');
  saveToLocal();
  
  executePageTransition();
  
  clearSelectionDelayed(CLEAR_DELAY);
}

function executePageTransition() {
  const mainElement = document.getElementById('main');
  if (!mainElement) {
    fillPrev();
    render();
    return;
  }
  
  disablePageInteraction();
  addPageTransitionStyles();
  
  mainElement.classList.remove('page-transition-out', 'page-transition-in', 'page-transition-out-reverse', 'page-transition-in-reverse');
  
  mainElement.style.transform = 'translateX(0)';
  mainElement.style.opacity = '1';
  
  setTimeout(() => {
    mainElement.classList.add('page-transition-out');
    
    setTimeout(() => {
      fillPrev();
      render();
      
      mainElement.classList.remove('page-transition-out');
      
      mainElement.classList.add('page-transition-in');
      
      setTimeout(() => {
        mainElement.classList.remove('page-transition-in');
        mainElement.style.transform = 'translateX(0)';
        mainElement.style.opacity = '1';
        
        enablePageInteraction();
      }, 400);
    }, 400);
  }, 50);
}

function saveStep() {
  if (isAnimating) return;
  
  const q = questions[idx];
  const key = q.key;
  
  console.log('=== saveStep Debug ===');
  console.log('Current idx:', idx, '(正在回答第', idx + 1, '題)');
  console.log('Current question:', q);
  console.log('Answer key:', key);
  console.log('rel:', rel, 'score1:', score1, 'score2:', score2);
  
  if (rel === 'X') {
    answers[key] = { relation: 'X' };
  } else if (rel === 'to') {
    answers[key] = { relation: 'to', score: score1 };
  } else if (rel === 'from') {
    answers[key] = { relation: 'from', score: score2 };
  } else if (rel === 'bi') {
    answers[key] = { relation: 'bi', score_XtoY: score1, score_YtoX: score2 };
  }
  
  console.log('Saved answer for question', idx + 1, ':', answers[key]);
  console.log('Total answered questions after saving:', Object.keys(answers).length);
  
  idx++;
  console.log('New idx after increment:', idx, '(已完成', idx, '題，將顯示第', idx + 1, '題)');
  
  saveToLocal();
  
  executePageTransition();
}

function prevStep() {
  if (idx <= 0) return;
  
  if (isAnimating) return;
  
  const mainElement = document.getElementById('main');
  if (!mainElement) {
    idx--;
    fillPrev();
    render();
    return;
  }
  
  disablePageInteraction();
  addPageTransitionStyles();
  
  mainElement.classList.remove('page-transition-out', 'page-transition-in', 'page-transition-out-reverse', 'page-transition-in-reverse');
  
  mainElement.style.transform = 'translateX(0)';
  mainElement.style.opacity = '1';
  
  setTimeout(() => {
    mainElement.classList.add('page-transition-out-reverse');
    
    setTimeout(() => {
      idx--;
      fillPrev();
      render();
      
      mainElement.classList.remove('page-transition-out-reverse');
      
      mainElement.classList.add('page-transition-in-reverse');
      
      setTimeout(() => {
        mainElement.classList.remove('page-transition-in-reverse');
        mainElement.style.transform = 'translateX(0)';
        mainElement.style.opacity = '1';
        
        enablePageInteraction();
      }, 400);
    }, 400);
  }, 50);
}

// 延遲清除選中狀態
let clearSelectionTimer = null;

function clearSelectionDelayed(delay = 200) {
  if (clearSelectionTimer) {
    clearTimeout(clearSelectionTimer);
    clearSelectionTimer = null;
  }
  
  clearSelectionTimer = setTimeout(() => {
    rel = '';
    score1 = '';
    score2 = '';
    
    render();
    
    clearSelectionTimer = null;
  }, delay);
}

function clearSelectionImmediate() {
  if (clearSelectionTimer) {
    clearTimeout(clearSelectionTimer);
    clearSelectionTimer = null;
  }
  
  rel = '';
  score1 = '';
  score2 = '';
}
