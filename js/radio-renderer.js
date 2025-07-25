// P0: Radio 一步作答渲染模組
// 目標：簡化問卷流程，Radio 變更即自動存檔跳下一題

class RadioRenderer {
  constructor() {
    this.secureRenderer = new SecureRenderer();
  }

  // 主渲染函數
  renderQuestion(questionIndex) {
    const el = document.getElementById('main');
    if (!el) {
      console.error('Main element not found');
      return;
    }
    
    const q = questions[questionIndex];
    if (!q) {
      console.error('Question not found at index:', questionIndex);
      return;
    }

    // 使用 Radio 問題模板
    const questionElement = this.secureRenderer.createElement('tpl-radio-question');
    if (!questionElement) {
      console.error('Failed to create question element');
      return;
    }

    // 填入題目資料
    this.populateQuestionData(questionElement, q);

    // 檢查已保存答案並自動勾選
    this.loadExistingAnswer(questionElement, q);

    // 綁定事件監聽器
    this.bindRadioEvents(questionElement, q);

    // 創建附加元素
    const progressInfo = this.createProgressInfo(questionIndex);
    const controlButtons = this.createControlButtons(questionIndex);
    
    // 渲染到頁面
    el.innerHTML = '';
    el.appendChild(progressInfo);
    el.appendChild(questionElement);
    el.appendChild(controlButtons);

    // 更新進度條
    this.updateProgressBar(questionIndex);
  }

  // 填入題目資料
  populateQuestionData(element, question) {
    const leftTitle = element.querySelector('.left-title');
    const rightTitle = element.querySelector('.right-title');
    
    if (leftTitle) {
      leftTitle.textContent = formatName(question.A.name);
      
      // 添加描述（如果有）
      if (question.A.desc) {
        const leftDesc = document.createElement('p');
        leftDesc.className = 'text-muted small mt-1';
        leftDesc.textContent = question.A.desc;
        leftTitle.appendChild(leftDesc);
      }
    }
    
    if (rightTitle) {
      rightTitle.textContent = formatName(question.B.name);
      
      // 添加描述（如果有）
      if (question.B.desc) {
        const rightDesc = document.createElement('p');
        rightDesc.className = 'text-muted small mt-1';
        rightDesc.textContent = question.B.desc;
        rightTitle.appendChild(rightDesc);
      }
    }
  }

  // 載入已保存的答案
  loadExistingAnswer(element, question) {
    const existingAnswer = answers[question.id];
    if (existingAnswer && existingAnswer.score !== undefined) {
      const radio = element.querySelector(`input[value="${existingAnswer.score}"]`);
      if (radio) {
        radio.checked = true;
      }
    }
  }

  // 綁定 Radio 事件
  bindRadioEvents(element, question) {
    const radios = element.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.handleRadioChange(question, e.target.value);
        }
      });
    });
  }

  // 處理 Radio 變更事件
  handleRadioChange(question, score) {
    console.log('Radio changed for question:', question.id, 'score:', score);
    
    // 保存答案
    answers[question.id] = {
      A: question.A.id,
      B: question.B.id,
      score: parseInt(score),
      type: question.type,
      timestamp: new Date().toISOString()
    };

    console.log('Answer saved:', answers[question.id]);

    // 立即保存到本地儲存
    saveToLocal();

    // 短暫延遲後自動跳到下一題
    setTimeout(() => {
      this.goNextQuestion();
    }, 300);
  }

  // 跳到下一題
  goNextQuestion() {
    idx++;
    console.log('Moving to next question, idx:', idx);
    
    if (idx >= questions.length) {
      finishSurvey();
    } else {
      this.renderQuestion(idx);
    }
  }

  // 跳到上一題
  goPrevQuestion() {
    if (idx > 0) {
      idx--;
      this.renderQuestion(idx);
    }
  }

  // 創建進度資訊
  createProgressInfo(questionIndex) {
    const container = document.createElement('div');
    container.className = 'mb-4';
    
    const q = questions[questionIndex];
    const phaseLabel = q.type === 'criteria' ? '第二部分：準則比較' : '第三部分：構面比較';
    const currentQuestionNumber = questionIndex + 1;
    const totalQuestions = questions.length;
    
    container.innerHTML = `
      <div class="text-center mb-3">
        <h4 class="text-primary">${phaseLabel}</h4>
        <p class="text-muted">問題 ${currentQuestionNumber} / ${totalQuestions}</p>
        <p class="small text-info">選擇選項後將自動進入下一題</p>
      </div>
      <div class="progress mb-3">
        <div class="progress-bar" id="currentProgressBar" role="progressbar" style="width: 0%"></div>
      </div>
    `;
    
    return container;
  }

  // 創建控制按鈕
  createControlButtons(questionIndex) {
    const container = document.createElement('div');
    container.className = 'd-flex justify-content-between mt-4';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-outline-secondary';
    prevBtn.textContent = '← 上一題';
    prevBtn.style.visibility = questionIndex > 0 ? 'visible' : 'hidden';
    prevBtn.onclick = () => this.goPrevQuestion();
    
    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn btn-outline-primary';
    skipBtn.textContent = '跳過 →';
    skipBtn.onclick = () => this.goNextQuestion();
    
    container.appendChild(prevBtn);
    container.appendChild(skipBtn);
    
    return container;
  }

  // 更新進度條
  updateProgressBar(questionIndex) {
    const progressBar = document.getElementById('currentProgressBar');
    if (progressBar) {
      const percent = Math.floor((questionIndex / questions.length) * 100);
      progressBar.style.width = `${percent}%`;
      progressBar.setAttribute('aria-valuenow', percent);
    }
  }
}

// 全局變數：Radio 渲染器實例
let radioRenderer = null;

// P0: 初始化 Radio 渲染器
function initRadioRenderer() {
  if (!radioRenderer) {
    radioRenderer = new RadioRenderer();
  }
  return radioRenderer;
}

// P0: 使用 Radio 渲染器渲染問題
function renderWithRadio() {
  const renderer = initRadioRenderer();
  renderer.renderQuestion(idx);
}
