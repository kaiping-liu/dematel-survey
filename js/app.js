/**
 * DEMATEL 問卷系統主要程式
 * 版本: 1.1
 * 功能: 問卷產生、UI 互動、資料管理
 */

class DEMATELSurvey {
    constructor() {
        this.config = null;
        this.questions = [];
        this.answers = {};
        this.basicInfo = {};
        this.currentPhase = 'intro';
        this.currentIndex = 0;
        this.maxReachedIndex = 0; // 記錄用戶達到過的最大題目索引
        this.dataHash = '';
        this.tempRelation = null;
        this.isModalValid = false;
        this.selectedScore1 = 0;
        this.selectedScore2 = 0;
        this.isAnimating = false;
        
        // DOM 快取 - 避免重複查詢提升效能
        this.$cache = {
            scoreButtons: null,
            directionButtons: null,
            appShell: null,
            viewContainer: null,
            questionContent: null
        };
        
        // 事件監聽器管理
        this.eventListeners = new Map();
        this.isEventListenersSetup = false;
        
        // 懶加載系統
        this.questionCache = new Map();
        this.isQuestionGenerationComplete = false;
        this.questionGenerationBatchSize = 50; // 每批處理的問題數量
        
        // 清理計時器
        this.cleanupTimers = new Set();
        
        // 保存計時器（防抖用）
        this.saveTimer = null;
        this.lastSavedIndex = null;
        this.lastSavedPhase = null;
        
        // 生成問卷唯一編號
        this.surveyId = this.generateUUID();
        
        // 時間記錄
        this.startTime = null;     // 開始填寫時間（讀完說明頁開始填的時間）
        this.endTime = null;       // 問卷結束時間
        
        this.initializeApp();
    }

    /**
     * 初始化應用程式
     */
    async initializeApp() {
        try {
            // 載入設定檔
            await this.loadConfig();
            
            // 初始化 UI
            this.initializeUI();
            
            // 設置事件監聽器
            this.setupEventListeners();
            
            // 初始化進度顯示
            this.updateProgress();
            
            console.log('✅ DEMATEL Survey 初始化完成');
            
        } catch (error) {
            console.error('初始化失敗:', error);
            console.error('錯誤堆疊:', error.stack);
            this.showError(`系統初始化失敗: ${error.message}\n\n請檢查瀏覽器控制台獲取更多資訊，或重新整理頁面。`);
        }
    }

    /**
     * 載入設定檔
     */
    async loadConfig() {
        try {
            // 強制重新抓取，禁用快取
            const timestamp = Date.now();
            const url = `dematel-structure.json?t=${timestamp}`;
            
            const response = await fetch(url, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`無法載入設定檔: HTTP ${response.status} ${response.statusText}`);
            }
            
            const configText = await response.text();
            this.config = JSON.parse(configText);
            
            // 計算新的 MD5
            const newMD5 = await this.calculateMD5(configText);
            
            // 驗證設定檔
            this.validateConfig();
            
            // 計算資料雜湊
            this.calculateDataHash();
            
            // 產生問卷
            await this.generateQuestions();
            
            // 檢查 MD5 變化（必須在問題生成之後）
            await this.checkConfigChanges(newMD5);
            
        } catch (error) {
            console.error('載入設定檔詳細錯誤:', error);
            throw new Error(`載入設定檔失敗: ${error.message}`);
        }
    }

    /**
     * 計算文字的 MD5 雜湊值
     */
    async calculateMD5(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 檢查設定檔變化
     */
    async checkConfigChanges(newMD5) {
        const storedMD5 = localStorage.getItem('dematel_config_md5');
        
        if (!storedMD5) {
            // 第一次載入，直接儲存 MD5 並顯示介紹頁面
            localStorage.setItem('dematel_config_md5', newMD5);
            this.currentMd5 = newMD5;
            this.showView('intro');
            return;
        }
        
        if (storedMD5 === newMD5) {
            // MD5 相同，檢查是否有未完成的問卷
            this.currentMd5 = newMD5;
            await this.showConfigUnchangedDialog();
        } else {
            // MD5 不同，設定檔已變更
            await this.showConfigChangedDialog(newMD5);
        }
    }

    /**
     * 顯示設定檔未變更對話框
     */
    async showConfigUnchangedDialog() {
        const hasExistingData = localStorage.getItem('dematel_answers') || 
                               localStorage.getItem('dematel_phase') || 
                               localStorage.getItem('dematel_basic_info');
        
        if (hasExistingData) {
            // 在顯示 Modal 之前先載入現有資料
            this.checkExistingData();
            
            return new Promise((resolve) => {
                this.showResumeContinueModal(resolve);
            });
        } else {
            // 如果沒有現有資料，顯示介紹頁面
            this.showView('intro');
        }
    }

    /**
     * 顯示設定檔已變更對話框
     */
    async showConfigChangedDialog(newMD5) {
        return new Promise((resolve) => {
            this.showConfigChangedModal(newMD5, resolve);
        });
    }

    /**
     * 驗證設定檔結構
     */
    validateConfig() {
        if (!this.config) {
            throw new Error('設定檔為空');
        }

        // 檢查必要欄位
        if (!this.config.說明) {
            throw new Error('缺少說明欄位');
        }
        
        if (!this.config.基本資料) {
            throw new Error('缺少基本資料欄位');
        }
        
        if (!this.config.架構 || !Array.isArray(this.config.架構)) {
            throw new Error('缺少架構欄位或格式錯誤');
        }

        // 檢查構面數量
        if (this.config.架構.length < 2) {
            throw new Error('構面數量不足，至少需要 2 個構面');
        }

        // 收集所有準則，確保總數足夠進行比較
        const allCriteria = [];
        for (const dimension of this.config.架構) {
            if (dimension.準則 && Array.isArray(dimension.準則)) {
                allCriteria.push(...dimension.準則);
            }
        }
        
        if (allCriteria.length < 2) {
            throw new Error('準則總數不足，至少需要 2 個準則才能進行比較');
        }

        // 檢查代碼唯一性
        this.validateUniqueCodes();
    }

    /**
     * 檢查代碼唯一性
     */
    validateUniqueCodes() {
        const dimensionCodes = new Set();
        const criteriaCodes = new Set();

        for (const dimension of this.config.架構) {
            // 檢查構面代碼
            if (dimensionCodes.has(dimension.代碼)) {
                throw new Error(`構面代碼重複: ${dimension.代碼}`);
            }
            dimensionCodes.add(dimension.代碼);

            // 檢查準則代碼
            if (dimension.準則) {
                for (const criteria of dimension.準則) {
                    if (criteriaCodes.has(criteria.編號)) {
                        throw new Error(`準則代碼重複: ${criteria.編號}`);
                    }
                    criteriaCodes.add(criteria.編號);
                }
            }
        }
    }

    /**
     * 計算資料雜湊
     */
    calculateDataHash() {
        const dataString = JSON.stringify(this.config);
        this.dataHash = this.simpleHash(dataString);
        
        // 檢查是否需要清除舊資料
        const storedHash = localStorage.getItem('dematel_data_hash');
        if (storedHash && storedHash !== this.dataHash) {
            this.clearAllData();
        }
        
        localStorage.setItem('dematel_data_hash', this.dataHash);
    }

    /**
     * 簡單雜湊函數
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 轉換為 32 位整數
        }
        return hash.toString();
    }

    /**
     * 產生問卷題目
     */
    async generateQuestions() {
        this.questions = [];
        this.isQuestionGenerationComplete = false;
        
        console.log('🔄 開始生成問卷題目...');
        
        // 產生構面比較題目（先構面）
        const dimensionQuestions = await this.generateDimensionQuestions();
        
        // 產生準則比較題目（後準則）
        const criteriaQuestions = await this.generateCriteriaQuestions();
        
        // 組合題目：先構面，後準則
        this.questions = [...dimensionQuestions, ...criteriaQuestions];
        
        // 檢查題目數量
        if (this.questions.length > 5000) {
            const proceed = confirm(
                `題量過大 (${this.questions.length} 題)，可能影響使用體驗。是否繼續？`
            );
            if (!proceed) {
                throw new Error('使用者取消，題量過大');
            }
        }
        
        // 設定題庫完成旗標
        this.isQuestionGenerationComplete = true;
    }

    /**
     * 產生準則比較題目（懶加載版本）
     */
    async generateCriteriaQuestions() {
        // 如果已經生成過，直接返回快取
        if (this.questionCache.has('criteria')) {
            return this.questionCache.get('criteria');
        }
        
        const questions = [];
        
        // 收集所有準則
        const allCriteria = [];
        for (const dimension of this.config.架構) {
            if (dimension.準則 && Array.isArray(dimension.準則)) {
                for (const criteria of dimension.準則) {
                    allCriteria.push({
                        ...criteria,
                        dimension: dimension.構面,
                        dimensionCode: dimension.代碼
                    });
                }
            }
        }
        
        // 使用生成器函數來實現懶加載
        const questionGenerator = this.createCriteriaQuestionGenerator(allCriteria);
        
        // 分批生成問題以避免阻塞UI（異步）
        await this.generateQuestionsInBatches(questionGenerator, questions, 'criteria');
        
        return questions;
    }
    
    /**
     * 創建準則問題生成器
     */
    *createCriteriaQuestionGenerator(allCriteria) {
        for (let i = 0; i < allCriteria.length; i++) {
            for (let j = i + 1; j < allCriteria.length; j++) {
                const criteriaA = allCriteria[i];
                const criteriaB = allCriteria[j];
                
                yield {
                    type: 'criteria',
                    key: `criteria:${criteriaA.編號}|${criteriaB.編號}`,
                    itemA: {
                        id: criteriaA.編號,
                        name: criteriaA.名稱,
                        description: criteriaA.說明,
                        examples: criteriaA.舉例 || [],
                        dimension: criteriaA.dimension,
                        dimensionCode: criteriaA.dimensionCode
                    },
                    itemB: {
                        id: criteriaB.編號,
                        name: criteriaB.名稱,
                        description: criteriaB.說明,
                        examples: criteriaB.舉例 || [],
                        dimension: criteriaB.dimension,
                        dimensionCode: criteriaB.dimensionCode
                    }
                };
            }
        }
    }
    
    /**
     * 分批生成問題以避免阻塞UI（異步版本）
     */
    generateQuestionsInBatches(generator, questions, type) {
        return new Promise((resolve) => {
            const batch = [];
            let count = 0;
            
            const processBatch = () => {
                if (batch.length > 0) {
                    questions.push(...batch);
                    batch.length = 0;
                    count = 0;
                }
            };
            
            for (const question of generator) {
                batch.push(question);
                count++;
                
                if (count >= this.questionGenerationBatchSize) {
                    // 使用 setTimeout 將控制權交還給瀏覽器
                    setTimeout(processBatch, 0);
                }
            }
            
            // 處理最後一批並完成
            setTimeout(() => {
                processBatch();
                
                // 快取結果
                this.questionCache.set(type, questions);
                
                resolve(questions);
            }, 0);
        });
    }

    /**
     * 產生構面比較題目（懶加載版本）
     */
    async generateDimensionQuestions() {
        // 如果已經生成過，直接返回快取
        if (this.questionCache.has('dimension')) {
            return this.questionCache.get('dimension');
        }
        
        const questions = [];
        const dimensions = this.config.架構;
        
        // 使用生成器函數來實現懶加載
        const questionGenerator = this.createDimensionQuestionGenerator(dimensions);
        
        // 分批生成問題以避免阻塞UI（異步）
        await this.generateQuestionsInBatches(questionGenerator, questions, 'dimension');
        
        return questions;
    }
    
    /**
     * 創建構面問題生成器
     */
    *createDimensionQuestionGenerator(dimensions) {
        for (let i = 0; i < dimensions.length; i++) {
            for (let j = i + 1; j < dimensions.length; j++) {
                const dimensionA = dimensions[i];
                const dimensionB = dimensions[j];
                
                yield {
                    type: 'dimension',
                    key: `dimension:${dimensionA.代碼}|${dimensionB.代碼}`,
                    itemA: {
                        id: dimensionA.代碼,
                        name: dimensionA.構面,
                        description: dimensionA.說明,
                        examples: this.getDimensionExamples(dimensionA)
                    },
                    itemB: {
                        id: dimensionB.代碼,
                        name: dimensionB.構面,
                        description: dimensionB.說明,
                        examples: this.getDimensionExamples(dimensionB)
                    }
                };
            }
        }
    }

    /**
     * 獲取構面的舉例信息
     * @param {Object} dimension - 構面對象
     * @returns {Array} - 舉例數組
     */
    getDimensionExamples(dimension) {
        // 構面本身通常沒有舉例，只返回構面級別的舉例（如果有的話）
        // 不從準則中收集舉例，因為那是準則的內容
        if (dimension.舉例 && Array.isArray(dimension.舉例)) {
            return dimension.舉例;
        }
        return []; // 構面沒有舉例時返回空數組
    }

    /**
     * 隨機排序題目
     */
    /**
     * 初始化 UI
     */
    initializeUI() {
        // 初始化 DOM 快取
        this.initializeDOMCache();
        
        // 計算並設置動態 header 高度
        this.updateHeaderHeight();
        
        // 設置 Intro 頁面內容
        this.setupIntroView();
        
        // 設置基本資料表單
        this.setupBasicForm();
        
        // 更新進度條
        this.updateProgress();
        
        // 只有在沒有恢復資料時才顯示 intro 頁面
        // 如果有恢復資料，currentPhase 已經在 checkExistingData 中設置
        if (this.currentPhase === 'intro') {
            this.showInitialView('intro');
        }
        // 如果已經有恢復的資料，不要覆蓋 currentPhase
    }

    /**
     * 初始化 DOM 快取
     */
    initializeDOMCache() {
        this.$cache.appShell = document.querySelector('.app-shell');
        this.$cache.viewContainer = document.querySelector('.view-container');
        this.$cache.questionContent = document.querySelector('.question-card__content');
        // scoreButtons 和 directionButtons 會在需要時動態更新
        this.updateButtonCache();
    }

    /**
     * 更新按鈕快取
     */
    updateButtonCache() {
        this.$cache.scoreButtons = document.querySelectorAll('.score-btn');
        this.$cache.directionButtons = document.querySelectorAll('.direction-btn');
    }

    /**
     * 動態計算並設置 header 高度
     */
    updateHeaderHeight() {
        if (this.$cache.appShell) {
            const headerHeight = this.$cache.appShell.offsetHeight;
            document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
        }
    }

    /**
     * 立即顯示初始頁面，避免動畫延遲
     */
    showInitialView(viewName) {
        // 隱藏所有視圖
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
            view.classList.remove('active');
        });
        
        // 立即顯示並激活指定視圖
        const targetView = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
        if (targetView) {
            targetView.style.display = 'block';
            targetView.classList.add('active');
        }
        
        // 設置當前階段
        this.currentPhase = viewName;
        
        // 確保交互已啟用
        this.enableInteractions();
    }

    /**
     * 檢查字串是否為圖片路徑
     * @param {string} str - 要檢查的字串
     * @returns {boolean} - 是否為圖片路徑
     */
    isImagePath(str) {
        if (typeof str !== 'string') return false;
        
        // 檢查是否包含常見圖片副檔名
        const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
        return imageExtensions.test(str.trim());
    }

    /**
     * 設置 Intro 頁面
     */
    setupIntroView() {
        const titleEl = document.getElementById('introTitle');
        const contentEl = document.getElementById('introContent');
        const startBtn = document.getElementById('startBtn');
        
        if (this.config?.說明) {
            titleEl.textContent = this.config.說明.標題;
            
            // 將內容轉換為 HTML
            const content = this.config.說明.內容;
            if (Array.isArray(content)) {
                contentEl.innerHTML = content.map(line => {
                    if (line.trim() === '') {
                        return '<br>';
                    } else if (this.isImagePath(line)) {
                        // 如果是圖片路徑，直接加時間戳
                        const imageSrc = line + '?v=' + Date.now();
                        return `<div class="intro-image-container"><img src="${imageSrc}" alt="說明圖片" class="intro-image" /></div>`;
                    } else {
                        return `<p>${line}</p>`;
                    }
                }).join('');
            } else {
                if (this.isImagePath(content)) {
                    // 如果是圖片路徑，直接加時間戳
                    const imageSrc = content + '?v=' + Date.now();
                    contentEl.innerHTML = `<div class="intro-image-container"><img src="${imageSrc}" alt="說明圖片" class="intro-image" /></div>`;
                } else {
                    contentEl.innerHTML = `<p>${content}</p>`;
                }
            }
            
            startBtn.textContent = this.config.說明.按鈕文字;
            startBtn.disabled = false;
        }
    }

    /**
     * 設置基本資料表單
     */
    setupBasicForm() {
        const fieldsContainer = document.getElementById('basicFields');
        
        if (!this.config?.基本資料) {
            return;
        }
        
        fieldsContainer.innerHTML = '';
        
        for (const field of this.config.基本資料) {
            const fieldEl = this.createFormField(field);
            fieldsContainer.appendChild(fieldEl);
        }
    }

    /**
     * 建立表單欄位
     */
    createFormField(field) {
        const container = document.createElement('div');
        container.className = 'form-field';
        
        const label = document.createElement('label');
        label.className = 'form-field__label';
        label.htmlFor = field.編號;
        label.innerHTML = field.名稱 + (field.必填 ? ' <span class="form-field__required">*</span>' : '');
        
        let input;
        
        switch (field.類型) {
            case 'text':
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-field__input';
                input.id = field.編號;
                input.name = field.編號;
                input.placeholder = field.說明;
                // 文字輸入保持正常的鍵盤導航能力
                break;
                
            case 'select':
                input = document.createElement('select');
                input.className = 'form-field__select';
                input.id = field.編號;
                input.name = field.編號;
                input.tabIndex = -1; // 禁用鍵盤導航
                
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '請選擇...';
                input.appendChild(defaultOption);
                
                for (const option of field.選項) {
                    const optionEl = document.createElement('option');
                    optionEl.value = option;
                    optionEl.textContent = option;
                    input.appendChild(optionEl);
                }
                break;
                
            case 'checkbox':
                input = document.createElement('div');
                input.className = 'form-field__checkboxes';
                
                for (const option of field.選項) {
                    const checkboxContainer = document.createElement('div');
                    checkboxContainer.className = 'form-field__checkbox';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `${field.編號}_${option}`;
                    checkbox.name = field.編號;
                    checkbox.value = option;
                    checkbox.tabIndex = -1; // 禁用鍵盤導航
                    
                    const checkboxLabel = document.createElement('label');
                    checkboxLabel.htmlFor = `${field.編號}_${option}`;
                    checkboxLabel.textContent = option;
                    checkboxLabel.tabIndex = -1; // 禁用鍵盤導航
                    
                    checkboxContainer.appendChild(checkbox);
                    checkboxContainer.appendChild(checkboxLabel);
                    input.appendChild(checkboxContainer);
                }
                break;
        }
        
        // 不添加重複的說明文字，因為 placeholder 已經有說明了
        
        container.appendChild(label);
        container.appendChild(input);
        
        return container;
    }

    /**
     * 檢查現有資料
     */
    checkExistingData() {
        const storedPhase = localStorage.getItem('dematel_phase');
        const storedIndex = localStorage.getItem('dematel_index');
        const storedMaxReachedIndex = localStorage.getItem('dematel_max_reached_index');
        const storedBasicInfo = localStorage.getItem('dematel_basic_info');
        const storedAnswers = localStorage.getItem('dematel_answers');
        const storedSurveyId = localStorage.getItem('dematel_survey_id');
        const storedConfigMd5 = localStorage.getItem('dematel_config_md5');
        const storedStartTime = localStorage.getItem('dematel_start_time');
        const storedEndTime = localStorage.getItem('dematel_end_time');
        
        // 恢復配置 MD5
        if (storedConfigMd5) {
            this.currentMd5 = storedConfigMd5;
        }
        
        // 恢復或生成問卷編號
        if (storedSurveyId) {
            this.surveyId = storedSurveyId;
        } else {
            // 如果沒有存儲的編號，使用新生成的並保存
            localStorage.setItem('dematel_survey_id', this.surveyId);
        }
        
        // 恢復時間戳
        if (storedStartTime && storedStartTime !== '') {
            this.startTime = parseInt(storedStartTime);
        }
        if (storedEndTime && storedEndTime !== '') {
            this.endTime = parseInt(storedEndTime);
        }
        
        if (storedPhase && storedBasicInfo) {
            // 載入已存資料，但不顯示 UI（由 Modal 系統處理）
            this.currentPhase = storedPhase;
            this.currentIndex = parseInt(storedIndex) || 0;
            this.maxReachedIndex = parseInt(storedMaxReachedIndex) || 0;
            this.basicInfo = JSON.parse(storedBasicInfo);
            this.answers = storedAnswers ? JSON.parse(storedAnswers) : {};
        }
    }

    /**
     * 設置事件監聽器
     */
    setupEventListeners() {
        // 防止重複設置事件監聽器
        if (this.isEventListenersSetup) {
            return;
        }
        
        // 使用事件委託來提高性能並減少內存使用
        this.addEventListenerWithCleanup(document, 'click', this.handleGlobalClick.bind(this));
        this.addEventListenerWithCleanup(document, 'submit', this.handleGlobalSubmit.bind(this));
        this.addEventListenerWithCleanup(document, 'input', this.handleGlobalInput.bind(this));
        this.addEventListenerWithCleanup(document, 'keydown', this.handleKeyboardInput.bind(this));
        
        // 視窗大小變化時重新計算 header 高度（重要：手機裝置橫豎螢幕切換）
        this.addEventListenerWithCleanup(window, 'resize', this.debounceResize.bind(this));
        
        // 頁面卸載時強制保存資料
        this.addEventListenerWithCleanup(window, 'beforeunload', () => {
            this.forceSaveToLocal();
        });
        
        this.isEventListenersSetup = true;
    }
    
    /**
     * 防抖的視窗大小變化處理器
     */
    debounceResize() {
        this.clearTimer(this.resizeTimer);
        this.resizeTimer = this.addTimer(() => {
            this.updateHeaderHeight();
        }, 150);
    }
    
    /**
     * 添加事件監聽器並記錄以便清理
     */
    addEventListenerWithCleanup(element, eventType, handler, options = false) {
        element.addEventListener(eventType, handler, options);
        
        // 使用更精確的 key，包含 handler 引用以避免覆蓋
        const key = `${element === document ? 'document' : element.id || `elem_${this.eventListeners.size}`}_${eventType}_${handler.name || 'anonymous'}`;
        
        // 如果相同的 key 已存在，先移除舊的監聽器
        if (this.eventListeners.has(key)) {
            const old = this.eventListeners.get(key);
            old.element.removeEventListener(old.eventType, old.handler, old.options);
        }
        
        this.eventListeners.set(key, { element, eventType, handler, options });
    }
    
    /**
     * 移除所有事件監聽器
     */
    removeAllEventListeners() {
        for (const [key, { element, eventType, handler, options }] of this.eventListeners) {
            element.removeEventListener(eventType, handler, options);
        }
        this.eventListeners.clear();
        this.isEventListenersSetup = false;
    }
    
    /**
     * 全局點擊事件處理器（事件委託）
     */
    handleGlobalClick(e) {
        const target = e.target;
        const button = target.closest('button');
        
        // 處理按鈕點擊
        if (button) {
            // 立即移除所有按鈕的焦點，防止手機上的黑色邊框
            setTimeout(() => {
                button.blur();
                document.activeElement.blur();
            }, 0);

            const id = button.id;
            const classList = button.classList;
            
            // 根據按鈕類型和ID分發事件
            if (id === 'startBtn') {
                this.startSurvey();
            } else if (id === 'resumeBtn') {
                this.resumeSurvey();
            } else if (id === 'restartBtn') {
                this.restartSurvey();
            } else if (id === 'prevQuestionBtn') {
                this.previousQuestion();
            } else if (id === 'nextQuestionBtn') {
                this.nextQuestion();
            } else if (id === 'closeModalBtn') {
                this.hideModal();
            } else if (id === 'downloadBtn') {
                this.downloadResults();
            } else if (id === 'generateQRBtn') {
                this.generateQRCode();
            } else if (id === 'restartSurveyBtn') {
                this.restartSurvey();
            } else if (id === 'clearDataBtn') {
                this.clearAllData();
            } else if (classList.contains('score-btn')) {
                this.handleScoreButtonClick(button);
            } else if (classList.contains('direction-btn')) {
                this.selectDirection(button.dataset.direction);
                // 立即移除焦點，避免手機瀏覽器殘留黑框
                setTimeout(() => button.blur(), 0);
            } else if (classList.contains('modal__backdrop')) {
                this.hideModal();
            } else if (id === 'modalCloseBtn') {
                this.hideDetailModal();
            }
        }
        
        // 處理構面/準則卡片點擊事件（非按鈕點擊）
        if (target.closest('.question-pair__item--clickable')) {
            const clickedItem = target.closest('.question-pair__item--clickable');
            const isLeft = clickedItem.id === 'leftItem';
            this.showDetailModal(isLeft);
        }
        
        // 處理詳情模態窗口點擊外部區域關閉
        if (target.classList.contains('modal-overlay') && target.id === 'detailModal') {
            this.hideDetailModal();
        }
    }
    
    /**
     * 全局提交事件處理器
     */
    handleGlobalSubmit(e) {
        if (e.target.id === 'basicForm') {
            e.preventDefault();
            this.submitBasicInfo();
        }
    }
    
    /**
     * 全局輸入事件處理器
     */
    handleGlobalInput(e) {
        if (e.target.closest('#basicForm')) {
            // 使用防抖來避免過於頻繁的儲存
            this.clearTimer(this.inputDebounceTimer);
            this.inputDebounceTimer = this.addTimer(() => {
                this.saveBasicInfoToLocal();
            }, 500);
        }
    }
    
    /**
     * 添加計時器並記錄以便清理
     */
    addTimer(callback, delay) {
        const timerId = setTimeout(() => {
            callback();
            this.cleanupTimers.delete(timerId);
        }, delay);
        this.cleanupTimers.add(timerId);
        return timerId;
    }
    
    /**
     * 清理單個計時器
     */
    clearTimer(timerId) {
        if (timerId) {
            clearTimeout(timerId);
            this.cleanupTimers.delete(timerId);
        }
    }
    
    /**
     * 清理所有計時器
     */
    clearAllTimers() {
        for (const timerId of this.cleanupTimers) {
            clearTimeout(timerId);
        }
        this.cleanupTimers.clear();
    }
    
    /**
     * 記憶體清理方法
     */
    cleanup() {
        // 清理事件監聽器
        this.removeAllEventListeners();
        
        // 清理計時器
        this.clearAllTimers();
        
        // 清理快取
        this.questionCache.clear();
        this.$cache = null;
        
        // 清理其他引用
        this.config = null;
        this.questions = null;
        this.answers = null;
        this.basicInfo = null;
    }

    /**
     * 開始問卷
     */
    startSurvey() {
        // 記錄開始填寫時間
        this.startTime = Date.now(); // 使用 timestamp
        
        this.currentPhase = 'basic';
        this.currentIndex = 0;
        this.showView('basic');
        this.updateProgress();
    }

    /**
     * 繼續填寫問卷
     */
    async resumeSurvey() {
        // 確保題庫生成完成
        if (!this.isQuestionGenerationComplete) {
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (this.isQuestionGenerationComplete) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 50);
            });
        }
        
        // 載入基本資料到表單
        this.loadBasicInfoToForm();
        
        // 跳轉到對應頁面
        if (this.currentPhase === 'intro') {
            // 如果 currentPhase 是 intro 但有儲存的資料，說明資料載入有問題
            // 重新載入一次資料
            this.checkExistingData();
            
            // 根據重新載入的資料決定顯示哪個頁面
            if (this.currentPhase === 'basic') {
                this.showView('basic');
            } else if (this.currentPhase === 'criteria' || this.currentPhase === 'dimension') {
                this.showView('question');
                this.updateQuestionView();
            } else if (this.currentPhase === 'finish') {
                this.showView('finish');
            }
        } else if (this.currentPhase === 'basic') {
            this.showView('basic');
        } else if (this.currentPhase === 'criteria' || this.currentPhase === 'dimension') {
            this.showView('question');
            this.updateQuestionView();
        } else if (this.currentPhase === 'finish') {
            this.showView('finish');
        }
        
        this.updateProgress();
    }

    /**
     * 重新開始問卷
     */
    restartSurvey() {
        if (confirm('確定要重新開始嗎？所有已填寫的資料將會清除。')) {
            // 清除所有資料
            this.clearAllData();
            
            // 重置時間記錄
            this.startTime = null;
            this.endTime = null;
            
            // 重置應用程式狀態到初始狀態
            this.currentPhase = 'intro';
            this.currentQuestionIndex = 0;
            this.responses = {};
            this.basicInfo = {};
            
            // 直接顯示說明頁面，不重新載入整個頁面
            this.showView('intro');
            this.updateProgress();
        }
    }

    /**
     * 提交基本資料
     */
    submitBasicInfo() {
        const form = document.getElementById('basicForm');
        const formData = new FormData(form);
        
        // 驗證必填欄位
        const errors = this.validateBasicInfo(formData);
        if (errors.length > 0) {
            this.showFormErrors(errors);
            form.classList.add('shake');
            setTimeout(() => form.classList.remove('shake'), 500);
            return;
        }
        
        // 儲存基本資料
        this.saveBasicInfo(formData);
        
        // 進入問卷階段 - 改成先構面後準則
        this.currentPhase = this.getDimensionQuestions().length > 0 ? 'dimension' : 'criteria';
        this.currentIndex = 0;
        
        this.showView('question');
        this.updateQuestionView();
        this.updateProgress();
        this.saveToLocal();
    }

    /**
     * 驗證基本資料
     */
    validateBasicInfo(formData) {
        const errors = [];
        
        for (const field of this.config.基本資料) {
            if (field.必填) {
                const value = formData.get(field.編號);
                if (!value || value.trim() === '') {
                    errors.push({
                        field: field.編號,
                        message: `${field.名稱}為必填欄位`
                    });
                }
            }
        }
        
        return errors;
    }

    /**
     * 顯示表單錯誤
     */
    showFormErrors(errors) {
        // 清除之前的錯誤
        document.querySelectorAll('.form-field__error').forEach(el => el.remove());
        document.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));
        
        // 顯示新錯誤
        for (const error of errors) {
            const field = document.getElementById(error.field);
            if (field) {
                field.classList.add('is-error');
                
                const errorEl = document.createElement('div');
                errorEl.className = 'form-field__error';
                errorEl.textContent = error.message;
                field.parentNode.appendChild(errorEl);
            }
        }
    }

    /**
     * 儲存基本資料
     */
    saveBasicInfo(formData) {
        this.basicInfo = {};
        
        for (const field of this.config.基本資料) {
            if (field.類型 === 'checkbox') {
                const values = formData.getAll(field.編號);
                this.basicInfo[field.編號] = values;
            } else {
                this.basicInfo[field.編號] = formData.get(field.編號);
            }
        }
        
        this.saveBasicInfoToLocal();
    }

    /**
     * 儲存基本資料到本地
     */
    saveBasicInfoToLocal() {
        const formData = new FormData(document.getElementById('basicForm'));
        const basicInfo = {};
        
        for (const field of this.config.基本資料) {
            if (field.類型 === 'checkbox') {
                const values = formData.getAll(field.編號);
                basicInfo[field.編號] = values;
            } else {
                basicInfo[field.編號] = formData.get(field.編號);
            }
        }
        
        localStorage.setItem('dematel_basic_info', JSON.stringify(basicInfo));
    }

    /**
     * 載入基本資料到表單
     */
    loadBasicInfoToForm() {
        for (const [key, value] of Object.entries(this.basicInfo)) {
            const field = document.getElementById(key);
            if (field) {
                if (Array.isArray(value)) {
                    // 複選框
                    const checkboxes = document.querySelectorAll(`input[name="${key}"]`);
                    checkboxes.forEach(cb => {
                        cb.checked = value.includes(cb.value);
                    });
                } else {
                    field.value = value;
                }
            }
        }
    }

    /**
     * 選擇方向
     */
    selectDirection(direction) {
        // 清除之前選擇
        document.querySelectorAll('.direction-btn').forEach(btn => {
            btn.classList.remove('selected');
            // 強制移除焦點，避免手機上的黑色邊框
            btn.blur();
        });
        
        // 選擇新方向
        const selectedBtn = document.querySelector(`[data-direction="${direction}"]`);
        selectedBtn.classList.add('selected');
        // 立即移除新選擇按鈕的焦點
        selectedBtn.blur();
        
        if (direction === 'none') {
            // 兩者無關，立即移除焦點避免 hover 效果
            selectedBtn.blur();
            // 直接進入下一題
            this.saveAnswer(direction, null, null);
            setTimeout(() => {
                this.clearAllSelections();
                // 確保動畫保護也適用於延遲執行
                if (!this.isAnimating) {
                    this.nextQuestion();
                }
            }, 300); // 縮短延遲時間
        } else {
            // 需要評分，顯示 Modal
            this.tempRelation = direction;
            this.showModal(direction);
        }
    }

    /**
     * 顯示評分 Modal
     */
    showModal(direction) {
        const modal = document.getElementById('scoreModal');
        const modalTitle = document.getElementById('modalTitle');
        const scoreGroup2 = document.getElementById('scoreGroup2');
        const scoreLabel1 = document.getElementById('scoreLabel1');
        const scoreLabel2 = document.getElementById('scoreLabel2');
        
        // 初始化評分變數
        this.selectedScore1 = 0;
        this.selectedScore2 = 0;
        
        // 清除所有按鈕的選中狀態
        document.querySelectorAll('.score-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // 獲取當前題目
        const question = this.getCurrentQuestion();
        const leftName = question.itemA.name;
        const rightName = question.itemB.name;
        
        // 設置標題和標籤
        switch (direction) {
            case 'to':
                modalTitle.textContent = `請選擇影響程度`;
                scoreLabel1.textContent = `${leftName} 單方面影響 ${rightName}`;
                scoreGroup2.style.display = 'none';
                break;
            case 'from':
                modalTitle.textContent = `請選擇影響程度`;
                scoreLabel1.textContent = `${rightName} 單方面影響 ${leftName}`;
                scoreGroup2.style.display = 'none';
                break;
            case 'bi':
                modalTitle.textContent = `請選擇影響程度`;
                scoreLabel1.textContent = `${leftName} 對 ${rightName}`;
                scoreLabel2.textContent = `${rightName} 對 ${leftName}`;
                scoreGroup2.style.display = 'block';
                break;
        }
        
        modal.classList.add('show');
    }

    /**
     * 隱藏 Modal
     */
    hideModal() {
        const modal = document.getElementById('scoreModal');
        modal.classList.remove('show');
        
        // 清除方向選擇
        document.querySelectorAll('.direction-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        this.tempRelation = null;
    }

    /**
     * 顯示構面/準則詳情模態窗口
     * @param {boolean} isLeft - 是否為左側項目
     */
    showDetailModal(isLeft) {
        const currentQuestion = this.getCurrentQuestion();
        if (!currentQuestion) return;

        const item = isLeft ? currentQuestion.itemA : currentQuestion.itemB;
        const modal = document.getElementById('detailModal');
        const title = document.getElementById('modalTitle');
        const description = document.getElementById('modalDescription');
        const examples = document.getElementById('modalExamples');
        const examplesList = document.getElementById('examplesList');
        const noContent = document.getElementById('modalNoContent');

        // 設置標題
        title.textContent = item.name;

        // 設置描述
        description.textContent = item.description || '';

        // 處理舉例內容
        if (item.examples && item.examples.length > 0) {
            examples.style.display = 'block';
            noContent.style.display = 'none';
            
            examplesList.innerHTML = '';
            item.examples.forEach(example => {
                const li = document.createElement('li');
                li.textContent = example;
                examplesList.appendChild(li);
            });
        } else {
            examples.style.display = 'none';
            noContent.style.display = 'none';
        }

        // 顯示模態窗口
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    /**
     * 隱藏構面/準則詳情模態窗口
     */
    hideDetailModal() {
        const modal = document.getElementById('detailModal');
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300); // 等待動畫完成
    }

    /**
     * 處理評分按鈕點擊
     */
    handleScoreButtonClick(button) {
        // 如果正在動畫中，禁止操作
        if (this.isAnimating) {
            return;
        }
        
        const score = button.dataset.score;
        const group = button.dataset.group;
        
        // 移除同組其他按鈕的選中狀態
        const groupButtons = document.querySelectorAll(`.score-btn[data-group="${group}"]`);
        groupButtons.forEach(btn => {
            btn.classList.remove('selected');
            // 強制移除焦點，避免手機上的黑色邊框
            btn.blur();
        });
        
        // 選中當前按鈕
        button.classList.add('selected');
        // 立即移除新選擇按鈕的焦點
        button.blur();
        
        // 更新評分值
        if (group === '1') {
            this.selectedScore1 = parseInt(score);
        } else if (group === '2') {
            this.selectedScore2 = parseInt(score);
        }
        
        // 檢查是否需要等待第二個評分
        const scoreGroup2 = document.getElementById('scoreGroup2');
        const needsBothScores = scoreGroup2.style.display !== 'none';
        
        if (needsBothScores && (this.selectedScore1 === 0 || this.selectedScore2 === 0)) {
            // 還需要另一個評分，不進入下一題
            return;
        }
        
        // 延遲一點時間讓用戶看到選擇效果，然後自動進入下一題
        setTimeout(() => {
            this.autoConfirmScore();
        }, 300);
    }

    /**
     * 自動確認評分並進入下一題
     */
    autoConfirmScore() {
        // 防止重複點擊和動畫衝突
        if (this.isAnimating) {
            return;
        }
        
        const score1 = this.selectedScore1;
        const score2 = document.getElementById('scoreGroup2').style.display !== 'none' 
            ? this.selectedScore2 
            : null;
        
        this.saveAnswer(this.tempRelation, score1, score2);
        this.hideModal();
        this.nextQuestion();
    }

    /**
     * 確認分數
     */
    confirmScore() {
        // 防止重複點擊和動畫衝突
        if (this.isAnimating) {
            return;
        }
        
        const score1 = this.selectedScore1;
        const score2 = document.getElementById('scoreGroup2').style.display !== 'none' 
            ? this.selectedScore2 
            : null;
        
        this.saveAnswer(this.tempRelation, score1, score2);
        this.hideModal();
        this.nextQuestion();
    }

    /**
     * 儲存答案
     */
    saveAnswer(relation, score1, score2) {
        const question = this.getCurrentQuestion();
        if (!question) return;
        
        this.answers[question.key] = {
            relation: relation,
            score1: score1,
            score2: score2,
            timestamp: Date.now()
        };
        
        this.saveToLocal();
    }

    /**
     * 下一題
     */
    nextQuestion() {
        // 防止重複調用
        if (this.isAnimating) {
            return;
        }
        
        const currentQuestions = this.getCurrentQuestions();
        
        if (this.currentIndex < currentQuestions.length - 1) {
            this.currentIndex++;
            // 更新最大達到索引
            this.maxReachedIndex = Math.max(this.maxReachedIndex, this.currentIndex);
        } else {
            // 當前階段完成
            if (this.currentPhase === 'dimension') {
                // 進入準則比較階段
                this.currentPhase = 'criteria';
                this.currentIndex = 0;
                this.maxReachedIndex = 0; // 重置為新階段的開始
            } else {
                // 完成所有題目
                this.endTime = Date.now(); // 使用 timestamp
                
                // 驗證題目完成度
                const expectedTotalQuestions = this.questions.length;
                const actualAnsweredQuestions = Object.keys(this.answers).length;
                
                console.log(`📊 問卷完成驗證: 預期 ${expectedTotalQuestions} 題, 實際回答 ${actualAnsweredQuestions} 題`);
                
                if (actualAnsweredQuestions < expectedTotalQuestions) {
                    console.warn(`⚠️ 問卷不完整! 還有 ${expectedTotalQuestions - actualAnsweredQuestions} 題未回答`);
                }
                
                this.currentPhase = 'finish';
                this.showView('finish');
                this.updateProgress();
                return;
            }
        }
        
        this.updateQuestionViewWithAnimation();
        this.updateProgress();
        this.saveToLocal();
    }

    /**
     * 上一題
     */
    previousQuestion() {
        // 防止重複調用
        if (this.isAnimating) {
            return;
        }
        
        if (this.currentIndex > 0) {
            this.currentIndex--;
        } else if (this.currentPhase === 'criteria') {
            // 回到構面比較的最後一題
            this.currentPhase = 'dimension';
            this.currentIndex = this.getDimensionQuestions().length - 1;
        } else if (this.currentPhase === 'dimension') {
            // 構面比較是第一階段，無法再往前
            return;
        }
        
        this.updateQuestionViewWithAnimation(true); // 傳遞 reverse 參數
        this.updateProgress();
        this.saveToLocal();
    }

    /**
     * 帶動畫的題目視圖更新
     */
    updateQuestionViewWithAnimation(reverse = false) {
        const questionContent = document.querySelector('.question-card__content');
        
        // 立即將容器滾動到頂部
        const viewContainer = document.querySelector('.view-container');
        if (viewContainer) {
            viewContainer.scrollTop = 0;
        }
        // 同時也將 body 和 window 滾動到頂部（備用方案）
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        window.scrollTo(0, 0);
        
        // 禁用所有交互
        this.disableInteractions();
        
        // 清除所有按鈕的選中狀態
        this.clearAllSelections();
        
        // 第一步：移除 active 類別，觸發淡出動畫
        questionContent.classList.remove('active');
        
        // 如果是反向動畫，添加反向類別
        if (reverse) {
            questionContent.classList.add('reverse');
        }
        
        setTimeout(() => {
            // 第二步：更新內容
            this.updateQuestionView();
            
            // 第三步：延遲添加 active 類別，觸發淡入動畫
            setTimeout(() => {
                questionContent.classList.add('active');
                
                // 移除反向類別並重新啟用交互
                setTimeout(() => {
                    if (reverse) {
                        questionContent.classList.remove('reverse');
                    }
                    this.enableInteractions();
                }, 450); // 動畫完成後再啟用
            }, 50);
        }, 400);
    }

    /**
     * 清除所有按鈕的選中狀態
     */
    clearAllSelections() {
        // 使用快取的 DOM 元素，避免重複查詢
        if (this.$cache.scoreButtons) {
            this.$cache.scoreButtons.forEach(btn => {
                btn.classList.remove('selected');
            });
        }
        
        if (this.$cache.directionButtons) {
            this.$cache.directionButtons.forEach(btn => {
                btn.classList.remove('selected');
            });
        }
        
        // 更新快取（以防DOM有變化）
        this.updateButtonCache();
    }

    /**
     * 禁用所有交互
     */
    disableInteractions() {
        // 禁用所有按鈕
        document.querySelectorAll('button').forEach(btn => {
            btn.disabled = true;
        });
        
        // 禁用評分按鈕點擊
        this.isAnimating = true;
    }

    /**
     * 啟用所有交互
     */
    enableInteractions() {
        // 啟用所有按鈕
        document.querySelectorAll('button').forEach(btn => {
            btn.disabled = false;
        });
        
        // 強制清除所有按鈕的焦點狀態，避免hover效果殘留
        this.clearAllButtonStates();
        
        // 重新檢查按鈕狀態
        this.updateButtonStates();
        
        // 啟用評分按鈕點擊
        this.isAnimating = false;
        
        // 額外的焦點清除，確保萬無一失
        setTimeout(() => {
            this.forceRemoveAllFocus();
        }, 50);
    }

    /**
     * 清除所有按鈕的焦點和hover狀態
     */
    clearAllButtonStates() {
        // 清除所有按鈕的焦點
        document.querySelectorAll('button').forEach(btn => {
            btn.blur();
        });
        
        // 移除當前活動元素的焦點
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
            document.activeElement.blur();
        }
        
        // 在觸控裝置上，額外觸發事件來清除hover狀態
        if ('ontouchstart' in window) {
            document.querySelectorAll('.direction-btn, .score-btn').forEach(btn => {
                // 模擬touch事件來清除hover狀態
                const touchEvent = new TouchEvent('touchstart', {
                    bubbles: true,
                    cancelable: true
                });
                btn.dispatchEvent(touchEvent);
                
                const touchEndEvent = new TouchEvent('touchend', {
                    bubbles: true,
                    cancelable: true
                });
                btn.dispatchEvent(touchEndEvent);
            });
        }
    }

    /**
     * 更新按鈕狀態
     */
    updateButtonStates() {
        // 更新上一題按鈕狀態
        const prevBtn = document.getElementById('prevQuestionBtn');
        if (prevBtn) {
            // 在構面比較的第一題時禁用上一題按鈕（因為構面是第一階段）
            prevBtn.disabled = this.currentIndex === 0 && this.currentPhase === 'dimension';
        }

        // 更新下一題按鈕狀態
        const nextBtn = document.getElementById('nextQuestionBtn');
        if (nextBtn) {
            // 當 currentIndex 不等於 maxReachedIndex 時啟用「下一題」按鈕
            const shouldEnable = this.currentIndex < this.maxReachedIndex;
            nextBtn.disabled = !shouldEnable;
            
            // 調試模式
            if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
                console.log(`🔍 按鈕狀態檢查:`);
                console.log(`  - currentIndex: ${this.currentIndex}`);
                console.log(`  - maxReachedIndex: ${this.maxReachedIndex}`);
                console.log(`  - shouldEnable: ${shouldEnable}`);
                console.log(`下一題按鈕狀態: ${shouldEnable ? '啟用' : '禁用'}`);
            }
        }
    }

    /**
     * 更新問卷視圖
     */
    updateQuestionView() {
        // 每次題目載入就強制重置所有按鈕狀態
        this.resetAllButtonStates();
        
        const question = this.getCurrentQuestion();
        if (!question) {
            // 如果題庫還沒生成完成，等待一下再重試
            if (!this.isQuestionGenerationComplete) {
                setTimeout(() => {
                    this.updateQuestionView();
                }, 100);
                return;
            }
            
            // 如果題庫已完成但還是沒有題目，顯示錯誤
            console.error('❌ 題庫已完成但無法獲取題目');
            alert('載入題目時發生錯誤，請重新整理頁面');
            return;
        }
        
        // 更新題目類型
        const questionTypeText = question.type === 'criteria' ? '準則比較' : '構面比較';
        document.getElementById('questionType').textContent = questionTypeText;
        
        // 更新題目內容
        document.getElementById('leftItemTitle').textContent = question.itemA.name;
        document.getElementById('leftItemDescription').textContent = question.itemA.description;
        document.getElementById('rightItemTitle').textContent = question.itemB.name;
        document.getElementById('rightItemDescription').textContent = question.itemB.description;
        
        // 如果是準則比較，顯示所屬構面資訊在左上角
        const leftDimensionEl = document.getElementById('leftItemDimension');
        const rightDimensionEl = document.getElementById('rightItemDimension');
        
        if (question.type === 'criteria' && question.itemA.dimension && question.itemB.dimension) {
            leftDimensionEl.textContent = question.itemA.dimension;
            leftDimensionEl.style.display = 'block';
            rightDimensionEl.textContent = question.itemB.dimension;
            rightDimensionEl.style.display = 'block';
        } else {
            leftDimensionEl.style.display = 'none';
            rightDimensionEl.style.display = 'none';
        }
        
        // 更新按鈕文字 - 優化影響關係描述
        const leftName = question.itemA.name;
        const rightName = question.itemB.name;
        
        // 如果名稱太長，截斷但保持可讀性
        const maxLength = 8;
        const leftShort = leftName.length > maxLength ? leftName.substring(0, maxLength) + '..' : leftName;
        const rightShort = rightName.length > maxLength ? rightName.substring(0, maxLength) + '..' : rightName;
        
        // 使用粗體標記和改進的措辭
        document.getElementById('toButtonText').innerHTML = `<strong>${leftShort}</strong> 單方面影響 <strong>${rightShort}</strong>`;
        document.getElementById('fromButtonText').innerHTML = `<strong>${rightShort}</strong> 單方面影響 <strong>${leftShort}</strong>`;
        
        console.log('按鈕文字已更新:', `${leftShort} 單方面影響 ${rightShort}`, `${rightShort} 單方面影響 ${leftShort}`);
        
        // 清除之前的選擇
        document.querySelectorAll('.direction-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // 顯示之前的答案（如果有）
        const existingAnswer = this.answers[question.key];
        if (existingAnswer && existingAnswer.relation !== 'skipped') {
            const btn = document.querySelector(`[data-direction="${existingAnswer.relation}"]`);
            if (btn) {
                btn.classList.add('selected');
            }
        }
        
        // 更新按鈕狀態
        this.updateButtonStates();
        
        // 調試：檢查下一題按鈕狀態
        if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
            console.log('=== 問題視圖更新調試 ===');
            console.log('當前問題:', question.key);
            console.log('當前階段:', this.currentPhase);
            console.log('當前索引:', this.currentIndex);
            const nextQ = this.getNextQuestion();
            console.log('下一題:', nextQ ? nextQ.key : '無');
            console.log('下一題有答案:', this.hasNextQuestionAnswer());
            console.log('========================');
        }
        
        // 確保問卷內容是可見的（直接載入時需要）
        const questionContent = document.querySelector('.question-card__content');
        if (questionContent && !questionContent.classList.contains('active')) {
            questionContent.classList.add('active');
        }
        
        // 移除所有方向按鈕的焦點，防止手機瀏覽器殘留黑框
        setTimeout(() => {
            const directionButtons = document.querySelectorAll('.direction-btn');
            directionButtons.forEach(btn => btn.blur());
        }, 100);
    }

    /**
     * 重置所有按鈕狀態 - 每次題目載入時的根本重置
     */
    resetAllButtonStates() {
        // 1. 清除所有選中狀態
        document.querySelectorAll('.direction-btn, .score-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // 2. 移除所有焦點和任何可能的CSS狀態
        document.querySelectorAll('button').forEach(btn => {
            btn.blur();
            // 強制觸發 mouseout 事件來清除 hover 狀態
            const mouseOutEvent = new MouseEvent('mouseout', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            btn.dispatchEvent(mouseOutEvent);
        });
        
        // 3. 移除活動元素焦點
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
            document.activeElement.blur();
        }
        
        // 4. 將焦點轉移到安全的地方
        const safeElement = document.querySelector('.app-shell') || document.body;
        safeElement.focus();
        safeElement.blur(); // 立即移除焦點，避免任何視覺效果
        
        // 5. 在觸控裝置上進行額外處理
        if ('ontouchstart' in window) {
            document.querySelectorAll('.direction-btn, .score-btn').forEach(btn => {
                // 觸發 touchcancel 來清除觸控狀態
                const touchCancelEvent = new TouchEvent('touchcancel', {
                    bubbles: true,
                    cancelable: true
                });
                btn.dispatchEvent(touchCancelEvent);
            });
        }
    }

    /**
     * 強制移除所有按鈕的焦點狀態
     */
    forceRemoveAllFocus() {
        // 移除所有按鈕的焦點
        document.querySelectorAll('button').forEach(btn => {
            btn.blur();
        });
        
        // 移除當前活動元素的焦點
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
            document.activeElement.blur();
        }
        
        // 強制移除body的焦點
        document.body.focus();
        
        // 在觸控裝置上，觸發清除事件
        if ('ontouchstart' in window) {
            // 創建一個不可見的臨時元素來"吸收"焦點
            const tempElement = document.createElement('div');
            tempElement.style.position = 'absolute';
            tempElement.style.left = '-9999px';
            tempElement.tabIndex = -1;
            document.body.appendChild(tempElement);
            tempElement.focus();
            document.body.removeChild(tempElement);
        }
    }

    /**
     * 獲取當前題目
     */
    getCurrentQuestion() {
        const currentQuestions = this.getCurrentQuestions();
        return currentQuestions[this.currentIndex];
    }

    /**
     * 獲取下一題（如果存在）
     */
    getNextQuestion() {
        const currentQuestions = this.getCurrentQuestions();
        
        if (this.currentIndex < currentQuestions.length - 1) {
            // 同階段的下一題
            return currentQuestions[this.currentIndex + 1];
        } else {
            // 檢查下一階段的第一題
            if (this.currentPhase === 'dimension') {
                const criteriaQuestions = this.getCriteriaQuestions();
                return criteriaQuestions.length > 0 ? criteriaQuestions[0] : null;
            }
        }
        return null;
    }

    /**
     * 檢查下一題是否已有答案
     */
    hasNextQuestionAnswer() {
        const nextQuestion = this.getNextQuestion();
        if (!nextQuestion) return false;
        
        return this.answers[nextQuestion.key] && this.answers[nextQuestion.key].relation !== 'skipped';
    }

    /**
     * 獲取當前階段的題目
     */
    getCurrentQuestions() {
        if (this.currentPhase === 'criteria') {
            return this.getCriteriaQuestions();
        } else if (this.currentPhase === 'dimension') {
            return this.getDimensionQuestions();
        }
        return [];
    }

    /**
     * 獲取準則題目
     */
    getCriteriaQuestions() {
        return this.questions.filter(q => q.type === 'criteria');
    }

    /**
     * 獲取構面題目
     */
    getDimensionQuestions() {
        return this.questions.filter(q => q.type === 'dimension');
    }

    /**
     * 更新進度條
     */
    updateProgress() {
        let progress = 0;
        
        switch (this.currentPhase) {
            case 'intro':
                progress = 0;
                break;
            case 'basic':
                progress = 5;
                break;
            case 'dimension':
            case 'criteria':
                // 統一使用實際完成度百分比
                const criteriaQuestions = this.getCriteriaQuestions();
                const dimensionQuestions = this.getDimensionQuestions();
                
                // 計算已完成的題目數
                let criteriaCompleted = 0;
                let dimensionCompleted = 0;
                
                criteriaQuestions.forEach(q => {
                    if (this.answers[q.key] && this.answers[q.key].relation !== 'skipped') {
                        criteriaCompleted++;
                    }
                });
                
                dimensionQuestions.forEach(q => {
                    if (this.answers[q.key] && this.answers[q.key].relation !== 'skipped') {
                        dimensionCompleted++;
                    }
                });
                
                // 計算總完成度（5% 基本資料 + 95% 問卷完成度）
                const totalQuestions = criteriaQuestions.length + dimensionQuestions.length;
                const totalCompleted = criteriaCompleted + dimensionCompleted;
                const completionPercentage = totalQuestions > 0 ? (totalCompleted / totalQuestions) * 95 : 0;
                progress = 5 + completionPercentage; // 5% 基本資料 + 實際完成度
                break;
            case 'finish':
                progress = 100;
                break;
        }
        
        const progressBar = document.getElementById('progressBar');
        progressBar.style.setProperty('--percent', progress);
        
        // 更新進度文字
        const progressTextEl = document.getElementById('progressText');
        if (progressTextEl) {
            let progressText = '';
            switch (this.currentPhase) {
                case 'intro':
                    progressText = '說明頁面';
                    break;
                case 'basic':
                    progressText = '基本資料';
                    break;
                case 'criteria':
                case 'dimension':
                    this.updateDetailedProgress();
                    return; // 直接返回，不更新 progressTextEl
                case 'finish':
                    progressText = '完成';
                    break;
                default:
                    progressText = '構面 0/6 題 | 準則 0/21 題 | 完成度 0%';
            }
            progressTextEl.textContent = progressText;
        }
    }

    /**
     * 更新詳細進度顯示
     */
    updateDetailedProgress() {
        const criteriaQuestions = this.getCriteriaQuestions();
        const dimensionQuestions = this.getDimensionQuestions();
        
        // 計算已完成的題目數
        let criteriaCompleted = 0;
        let dimensionCompleted = 0;
        
        criteriaQuestions.forEach(q => {
            if (this.answers[q.key] && this.answers[q.key].relation !== 'skipped') {
                criteriaCompleted++;
            }
        });
        
        dimensionQuestions.forEach(q => {
            if (this.answers[q.key] && this.answers[q.key].relation !== 'skipped') {
                dimensionCompleted++;
            }
        });
        
        // 計算總完成度
        const totalQuestions = criteriaQuestions.length + dimensionQuestions.length;
        const totalCompleted = criteriaCompleted + dimensionCompleted;
        const completionPercentage = totalQuestions > 0 ? Math.round((totalCompleted / totalQuestions) * 100) : 0;
        
        // 更新進度文字
        const progressText = `構面 ${dimensionCompleted}/${dimensionQuestions.length} 題 | 準則 ${criteriaCompleted}/${criteriaQuestions.length} 題 | 完成度 ${completionPercentage}%`;
        document.getElementById('progressText').textContent = progressText;
    }

    /**
     * 顯示視圖
     */
    showView(viewName) {
        // 禁用交互防止連點
        this.disableInteractions();
        
        // 立即將容器滾動到頂部，避免視覺上的滾動效果
        const viewContainer = document.querySelector('.view-container');
        if (viewContainer) {
            viewContainer.scrollTop = 0;
        }
        
        // 同時也將 body 和 window 滾動到頂部（備用方案）
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        window.scrollTo(0, 0);
        
        // 隱藏所有視圖
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
            view.classList.remove('active');
        });
        
        // 同時重置問卷內容的狀態
        const questionContent = document.querySelector('.question-card__content');
        if (questionContent) {
            questionContent.classList.remove('active');
        }
        
        // 顯示指定視圖
        const targetView = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
        
        if (targetView) {
            targetView.style.display = 'block';
            
            setTimeout(() => {
                targetView.classList.add('active');
                
                // 如果是問卷頁面，同時激活問卷內容
                if (viewName === 'question') {
                    const questionContent = document.querySelector('.question-card__content');
                    if (questionContent) {
                        questionContent.classList.add('active');
                    }
                }
                
                // 如果是完成頁面，顯示問卷編號
                if (viewName === 'finish') {
                    const surveyIdDisplay = document.getElementById('surveyIdDisplay');
                    if (surveyIdDisplay) {
                        surveyIdDisplay.textContent = this.surveyId;
                    }
                }
                
                // 動畫完成後重新啟用交互
                setTimeout(() => {
                    this.enableInteractions();
                }, 400);
            }, 50);
        } else {
            console.error('❌ 未找到目標視圖:', `#view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
            // 如果沒有找到目標視圖，立即重新啟用交互
            this.enableInteractions();
        }
        
        // 只有在特定情況下才更新 currentPhase
        if (viewName === 'intro' || viewName === 'basic' || viewName === 'finish') {
            this.currentPhase = viewName;
        }
        // 對於 'question' 視圖，不改變 currentPhase，保持 'criteria' 或 'dimension'
    }

    /**
     * 轉換答案格式為簡化版本 (僅用於下載)
     */
    convertAnswersForDownload(answers) {
        const converted = {};
        
        for (const [key, value] of Object.entries(answers)) {
            // 移除 dimension: 或 criteria: 前綴
            let cleanKey = key;
            if (key.startsWith('dimension:')) {
                cleanKey = key.replace('dimension:', '');
            } else if (key.startsWith('criteria:')) {
                cleanKey = key.replace('criteria:', '');
            }
            
            // 處理分數：null 轉為 0
            const score1 = value.score1 !== null ? value.score1 : 0;
            const score2 = value.score2 !== null ? value.score2 : 0;
            
            // 用 | 分隔分數
            converted[cleanKey] = `${score1}|${score2}`;
        }
        
        return converted;
    }

    /**
     * 統一的原始資料準備函數 - 同時用於下載JSON和QR Code生成
     */
    prepareOriginalData() {
        // 轉換答案格式
        const convertedAnswers = this.convertAnswersForDownload(this.answers);
        
        // 統一的原始資料結構
        const originalData = {
            surveyId: this.surveyId,
            basicInfo: this.basicInfo,
            answers: convertedAnswers,
            configMd5: this.currentMd5,
            startTime: this.startTime,
            endTime: this.endTime
        };
        
        return originalData;
    }

    /**
     * 下載結果
     */
    async downloadResults() {
        // 先驗證配置文件MD5
        const isValid = await this.validateConfigBeforeAction();
        if (!isValid) {
            return;
        }

        // 使用統一的原始資料準備函數
        const originalData = this.prepareOriginalData();

        const results = {
            ...originalData,
            totalQuestions: Object.keys(this.answers).length
        };
        
        const blob = new Blob([JSON.stringify(results, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dematel-survey-${this.surveyId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 產生 QR Code（使用進階壓縮和分段）
     */
    async generateQRCode() {
        // 先驗證配置文件MD5
        try {
            const isValid = await this.validateConfigBeforeAction();
            if (!isValid) {
                return;
            }
        } catch (error) {
            console.error('❌ 配置驗證失敗:', error);
            alert('配置驗證失敗：' + error.message);
            return;
        }

        try {
            // 1. 使用統一的原始資料準備函數
            const originalData = this.prepareOriginalData();
            
            // 添加 totalQuestions 以保持與下載格式一致
            const dataWithTotal = {
                ...originalData,
                totalQuestions: Object.keys(this.answers).length
            };
            
            // 去空白處理
            const compactString = JSON.stringify(dataWithTotal);

            // 2. 自動縮短 - Key 用 a,b,c... Value 用 #0,#1...
            const { vObj, keyMap, valMap } = this.autoShorten(dataWithTotal);

            // 3. 雜湊 - 取 SHA-256 前 8 byte（16 hex）
            const dataForHash = JSON.stringify(vObj);
            const fullHash = await this.calculateSHA256(dataForHash);
            const hash = fullHash.substring(0, 16); // 前 8 byte = 16 hex

            // 4. 封裝格式 - 固定格式：{data: {vObj, keyMap, valMap}, hash, v}
            const finalData = {
                data: {
                    vObj: vObj,
                    keyMap: keyMap,
                    valMap: valMap
                },
                hash: hash,
                v: "1.0"
            };

            const finalString = JSON.stringify(finalData);

            // 檢查 pako 庫
            if (typeof pako === 'undefined') {
                throw new Error('Pako 壓縮庫未載入');
            }

            // 5. 壓縮 - pako.deflate(level:9) → base64
            const compressed = pako.deflate(finalString, { level: 9 });
            const base64 = btoa(String.fromCharCode.apply(null, compressed));
            
            // 計算壓縮率
            const originalSize = JSON.stringify(dataWithTotal).length;
            const compressionRatio = Math.round((1 - base64.length / originalSize) * 100);

            // 6. 分段 - 每段固定 800 個 base64 字元
            const maxSegmentSize = 800; // 按規格：800 字元
            const segments = this.splitIntoSegments(base64, maxSegmentSize);

            // 7. 產生 QR - 錯誤修正等級 L，尺寸 240px
            await this.renderQRCodes(segments);

            console.log(`✅ QR Code 生成完成 - ${segments.length} 個片段，壓縮率 ${compressionRatio}%`);
            
        } catch (error) {
            console.error('❌ QR Code 生成失敗:', error);
            alert('QR Code 生成失敗：' + error.message);
        }
    }

    /**
     * 自動縮短字串演算法
     * @param {Object} obj - 要壓縮的物件
     * @param {number} minLen - 最小字串長度門檻
     * @param {number} minGain - 最小收益門檻
     * @returns {Object} - { vObj: 壓縮後物件, keyMap: 鍵對照表, valMap: 值對照表 }
     */
    autoShorten(obj, minLen = 8, minGain = 2) {
        const keyStat = {}, valStat = {};
        
        // 遞迴掃描所有字串
        const walk = (o) => {
            if (Array.isArray(o)) {
                o.forEach(walk);
            } else if (o && typeof o === 'object') {
                Object.entries(o).forEach(([k, v]) => {
                    keyStat[k] = (keyStat[k] || 0) + 1;
                    walk(v);
                });
            } else if (typeof o === 'string') {
                valStat[o] = (valStat[o] || 0) + 1;
            }
        };
        
        walk(obj);
        
        // 決策：只留真正省空間的
        const pick = (stat, tokenGen, tokLen) => {
            const map = {};
            for (const [str, cnt] of Object.entries(stat)) {
                if (str.length < minLen || cnt < 2) continue;
                const gain = (str.length - tokLen) * cnt - (str.length + tokLen);
                if (gain >= minGain) {
                    map[tokenGen.next().value] = str;
                }
            }
            return map;
        };
        
        // Token 生成器
        function* alpha() { 
            for (const c of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') 
                yield c; 
        }
        function* sharp() { 
            let n = 0; 
            while (true) yield '#' + (n++); 
        }
        
        const keyMap = pick(keyStat, alpha(), 1);
        const valMap = pick(valStat, sharp(), 2);
        
        // 建立反向對照表
        const revKey = Object.fromEntries(Object.entries(keyMap).map(([t, orig]) => [orig, t]));
        const revVal = Object.fromEntries(Object.entries(valMap).map(([t, orig]) => [orig, t]));
        
        // 遞迴替換
        const replace = (o) => {
            if (Array.isArray(o)) return o.map(replace);
            if (o && typeof o === 'object') {
                return Object.fromEntries(Object.entries(o).map(([k, v]) => [
                    revKey[k] || k,
                    replace(v)
                ]));
            }
            return typeof o === 'string' && revVal[o] ? revVal[o] : o;
        };
        
        return { 
            vObj: replace(obj), 
            keyMap: keyMap, 
            valMap: valMap 
        };
    }

    /**
     * 穩定的 JSON 字串化（固定順序）
     */
    /**
     * 計算 SHA-256 雜湊
     */
    async calculateSHA256(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 分割成片段（智慧平均分配）
     */
    splitIntoSegments(data, maxLength = 800) {
        // 預估每個片段的開銷（UUID + 索引 + 總數等）
        const estimatedOverhead = 100; // 預估JSON開銷
        const effectiveMaxLength = maxLength - estimatedOverhead;
        
        // 計算需要的片段數
        const totalSegments = Math.ceil(data.length / effectiveMaxLength);
        
        // 計算每個片段的理想長度（均勻分配）
        const idealLength = Math.floor(data.length / totalSegments);
        
        console.log(`📏 資料總長度: ${data.length}, 分成 ${totalSegments} 片段, 每片理想長度: ${idealLength}`);
        
        const segments = [];
        let currentPosition = 0;
        
        for (let i = 0; i < totalSegments; i++) {
            let segmentLength;
            
            if (i === totalSegments - 1) {
                // 最後一個片段：包含所有剩餘資料
                segmentLength = data.length - currentPosition;
            } else {
                // 其他片段：平均分配，但考慮剩餘資料量
                const remainingData = data.length - currentPosition;
                const remainingSegments = totalSegments - i;
                segmentLength = Math.floor(remainingData / remainingSegments);
                
                // 確保不會超過有效長度限制
                if (segmentLength > effectiveMaxLength) {
                    segmentLength = effectiveMaxLength;
                }
            }
            
            const part = data.substring(currentPosition, currentPosition + segmentLength);
            
            const segment = {
                g: this.surveyId,
                i: i + 1,  // 1-based 索引
                total: totalSegments,
                part: part
            };
            
            // 檢查序列化後的實際長度
            const segmentString = JSON.stringify(segment);
            console.log(`📦 片段 ${i + 1}/${totalSegments}: 原始=${segmentLength}, 序列化=${segmentString.length}`);
            
            segments.push(segment);
            currentPosition += segmentLength;
        }
        
        // 驗證所有資料都被包含
        const totalProcessed = segments.reduce((sum, seg) => sum + seg.part.length, 0);
        if (totalProcessed !== data.length) {
            console.warn(`⚠️ 資料長度不匹配: 原始=${data.length}, 處理後=${totalProcessed}`);
        }
        
        return segments;
    }

    /**
     * 渲染 QR Codes（垂直排列所有QR Code）
     */
    async renderQRCodes(segments) {
        const qrContainer = document.getElementById('qrContainer');
        const qrCodes = document.getElementById('qrCodes');
        const qrNavigation = document.getElementById('qrNavigation');
        
        // 檢查必要元素
        if (!qrContainer || !qrCodes) {
            throw new Error('QR Code 容器元素未找到');
        }
        
        // 檢查 QRCode 庫
        if (typeof QRCode === 'undefined') {
            throw new Error('QRCode 庫未載入');
        }
        
        // 清空容器
        qrCodes.innerHTML = '';
        
        // 隱藏導航按鈕（不再需要分頁）
        if (qrNavigation) {
            qrNavigation.style.display = 'none';
        }
        
        // 直接垂直排列所有 QR Code
        for (let i = 0; i < segments.length; i++) {
            try {
                const qrWrapper = document.createElement('div');
                qrWrapper.style.marginBottom = '30px'; // QR Code 之間的間距
                qrWrapper.style.textAlign = 'center';
                qrWrapper.classList.add('qr-canvas');
                
                // 將整個片段物件轉成字串
                const segmentString = JSON.stringify(segments[i]);
                
                // 添加 QR Code 標題
                const titleDiv = document.createElement('div');
                titleDiv.style.textAlign = 'center';
                titleDiv.style.fontWeight = 'bold';
                titleDiv.style.marginBottom = '15px';
                titleDiv.style.fontSize = '16px';
                titleDiv.style.color = '#333';
                titleDiv.textContent = `QR Code (${i + 1}/${segments.length})`;
                qrWrapper.appendChild(titleDiv);
                
                // 創建 QR Code 容器
                const qrDiv = document.createElement('div');
                qrDiv.style.textAlign = 'center';
                qrWrapper.appendChild(qrDiv);
                
                // 使用 QRCode 庫的正確 API
                new QRCode(qrDiv, {
                    text: segmentString,
                    width: 240,
                    height: 240,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.L
                });
                
                // 添加問卷編號 UUID
                const uuidDiv = document.createElement('div');
                uuidDiv.style.textAlign = 'center';
                uuidDiv.style.marginTop = '10px';
                uuidDiv.style.fontSize = '12px';
                uuidDiv.style.fontFamily = 'monospace';
                uuidDiv.style.color = '#666';
                uuidDiv.textContent = this.surveyId;
                qrWrapper.appendChild(uuidDiv);
                
                qrCodes.appendChild(qrWrapper);
            } catch (error) {
                console.error(`❌ 片段 ${i + 1} QR Code 生成失敗:`, error);
                throw new Error(`片段 ${i + 1} QR Code 生成失敗: ${error.message}`);
            }
        }
        
        // 顯示容器
        qrContainer.style.display = 'block';
    }

    /**
     * 處理鍵盤輸入
     */
    handleKeyboardInput(e) {
        // Modal 中的 Esc 鍵
        if (e.key === 'Escape') {
            const modal = document.getElementById('scoreModal');
            if (modal.classList.contains('show')) {
                this.hideModal();
                return;
            }
        }
        
        // 問卷頁面的方向鍵
        if (this.currentPhase === 'criteria' || this.currentPhase === 'dimension') {
            switch (e.key) {
                case 'ArrowLeft':
                case '1':
                    this.selectDirection('from');
                    break;
                case 'ArrowRight':
                case '2':
                    this.selectDirection('to');
                    break;
                case 'ArrowUp':
                case '3':
                    this.selectDirection('bi');
                    break;
                case 'ArrowDown':
                case '0':
                    this.selectDirection('none');
                    break;
            }
        }
        
        // Modal 中的 Enter 鍵
        if (e.key === 'Enter') {
            const modal = document.getElementById('scoreModal');
            if (modal.classList.contains('show') && this.isModalValid) {
                this.confirmScore();
            }
        }
    }

    /**
     * 儲存到本地儲存（每題都保存，但有防抖處理避免過於頻繁）
     */
    saveToLocal() {
        // 清除之前的保存計時器
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        
        // 延遲保存，避免快速連續操作時的頻繁寫入
        this.saveTimer = setTimeout(() => {
            this.forceSaveToLocal();
        }, 100); // 100ms 防抖，既保證及時保存又避免過於頻繁
    }
    
    /**
     * 強制保存到本地儲存
     */
    forceSaveToLocal() {
        // 清除之前的保存計時器
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        
        try {
            localStorage.setItem('dematel_phase', this.currentPhase);
            localStorage.setItem('dematel_index', this.currentIndex.toString());
            localStorage.setItem('dematel_max_reached_index', this.maxReachedIndex.toString());
            localStorage.setItem('dematel_answers', JSON.stringify(this.answers));
            localStorage.setItem('dematel_survey_id', this.surveyId);
            localStorage.setItem('dematel_start_time', this.startTime ? this.startTime.toString() : '');
            localStorage.setItem('dematel_end_time', this.endTime ? this.endTime.toString() : '');
            
            // 記錄上次保存的狀態
            this.lastSavedIndex = this.currentIndex;
            this.lastSavedPhase = this.currentPhase;
            
            console.log(`💾 資料已保存到本地儲存 (階段: ${this.currentPhase}, 題目: ${this.currentIndex}, 編號: ${this.surveyId})`);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('⚠️ localStorage 容量不足，嘗試清理舊資料');
                // 清理非關鍵資料後重試
                localStorage.removeItem('dematel_shuffle_seed');
                localStorage.removeItem('dematel_data_hash');
                try {
                    localStorage.setItem('dematel_phase', this.currentPhase);
                    localStorage.setItem('dematel_index', this.currentIndex.toString());
                    localStorage.setItem('dematel_answers', JSON.stringify(this.answers));
                    localStorage.setItem('dematel_survey_id', this.surveyId);
                    localStorage.setItem('dematel_start_time', this.startTime ? this.startTime.toString() : '');
                    localStorage.setItem('dematel_end_time', this.endTime ? this.endTime.toString() : '');
                    this.lastSavedIndex = this.currentIndex;
                    this.lastSavedPhase = this.currentPhase;
                    console.log('💾 清理後重新保存成功');
                } catch (retryError) {
                    console.error('❌ localStorage 保存失敗:', retryError);
                    alert('儲存空間不足，請清理瀏覽器資料或使用無痕模式');
                }
            } else {
                console.error('❌ localStorage 保存失敗:', error);
            }
        }
    }

    /**
     * 清除所有資料
     * @param {boolean} keepConfigMD5 - 是否保留設定檔 MD5
     */
    clearAllData(keepConfigMD5 = true) {
        const keys = [
            'dematel_phase',
            'dematel_index',
            'dematel_max_reached_index',
            'dematel_basic_info',
            'dematel_answers',
            'dematel_data_hash',
            'dematel_shuffle_seed',
            'dematel_survey_id',
            'dematel_start_time',
            'dematel_end_time'
        ];
        
        // 如果不保留 MD5，則一併清除
        if (!keepConfigMD5) {
            keys.push('dematel_config_md5');
        }
        
        keys.forEach(key => localStorage.removeItem(key));
        
        // 重置狀態
        this.currentPhase = 'intro';
        this.currentIndex = 0;
        this.maxReachedIndex = 0;
        this.basicInfo = {};
        this.answers = {};
        
        // 生成新的問卷編號
        this.surveyId = this.generateUUID();
    }

    /**
     * 顯示繼續/重新開始 Modal
     */
    showResumeContinueModal(resolve) {
        const modal = document.getElementById('resumeContinueModal');
        const continueBtn = document.getElementById('continueBtn');
        const restartBtn = document.getElementById('restartFromResumeBtn');
        
        // 顯示 Modal
        modal.classList.add('show');
        
        // 設定事件處理器
        const handleContinue = async () => {
            console.log('🔘 handleContinue 開始執行');
            
            modal.classList.remove('show');
            console.log('🚫 Modal show 類別已移除');
            
            continueBtn.removeEventListener('click', handleContinue);
            restartBtn.removeEventListener('click', handleRestart);
            console.log('🗑️ 事件監聽器已清除');
            
            // 確保 Modal 完全隱藏
            setTimeout(async () => {
                // 確保 Modal 完全隱藏
                modal.style.display = 'none';
                console.log('👻 Modal 設為 display: none');
                
                console.log('⏰ 延遲後開始恢復流程');
                
                // 在繼續填寫前，確保資料已正確載入
                console.log('🔄 點擊繼續填寫，確保資料載入...');
                this.checkExistingData();
                console.log('📊 資料載入後，當前階段:', this.currentPhase, '當前索引:', this.currentIndex);
                
                // 繼續填寫問卷 - 恢復到之前的進度
                await this.resumeSurvey();
                console.log('✅ resumeSurvey 完成');
                
                resolve();
            }, 100); // 給 Modal 關閉一點時間
        };

        const handleRestart = () => {
            modal.classList.remove('show');
            continueBtn.removeEventListener('click', handleContinue);
            restartBtn.removeEventListener('click', handleRestart);
            
            // 清除所有資料
            this.clearAllData();
            
            // 重置應用程式狀態到初始狀態
            this.currentPhase = 'intro';
            this.currentQuestionIndex = 0;
            this.responses = {};
            this.basicInfo = {};
            
            // 顯示說明頁面而不是基本資料頁面
            this.showView('intro');
            this.updateProgress();
            
            resolve();
        };        continueBtn.addEventListener('click', handleContinue);
        restartBtn.addEventListener('click', handleRestart);
    }

    /**
     * 顯示設定檔變更 Modal
     */
    showConfigChangedModal(newMD5, resolve) {
        const modal = document.getElementById('configChangedModal');
        const restartBtn = document.getElementById('restartFromConfigChangeBtn');
        
        // 顯示 Modal
        modal.classList.add('show');
        
        // 設定事件處理器
        const handleRestart = () => {
            modal.classList.remove('show');
            restartBtn.removeEventListener('click', handleRestart);
            
            // 清除所有資料並更新 MD5
            this.clearAllData();
            localStorage.setItem('dematel_config_md5', newMD5);
            this.currentMd5 = newMD5;
            
            // 重置應用程式狀態到初始狀態
            this.currentPhase = 'intro';
            this.currentQuestionIndex = 0;
            this.responses = {};
            this.basicInfo = {};
            
            // 顯示說明頁面而不是基本資料頁面
            this.showView('intro');
            this.updateProgress();
            
            resolve();
        };
        
        restartBtn.addEventListener('click', handleRestart);
    }

    /**
     * 顯示錯誤訊息
     */
    showError(message) {
        console.error('DEMATEL Error:', message);
        
        // 嘗試在頁面上顯示錯誤
        const introTitle = document.getElementById('introTitle');
        const introContent = document.getElementById('introContent');
        const startBtn = document.getElementById('startBtn');
        
        if (introTitle && introContent) {
            introTitle.textContent = '系統錯誤';
            introTitle.style.color = '#e63946';
            introContent.innerHTML = `<p style="color: #e63946;">${message}</p><p>請檢查瀏覽器控制台獲取更多資訊。</p>`;
            if (startBtn) {
                startBtn.textContent = '重新載入';
                startBtn.disabled = false;
                startBtn.onclick = () => window.location.reload();
            }
        } else {
            alert(message);
        }
    }

    /**
     * 生成 UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 在執行關鍵操作前驗證配置文件MD5
     */
    async validateConfigBeforeAction() {
        try {
            console.log('🔍 驗證配置文件MD5...');
            
            // 強制重新抓取，禁用快取（與 loadConfig 相同的方式）
            const timestamp = Date.now();
            const url = `dematel-structure.json?t=${timestamp}`;
            
            const response = await fetch(url, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`無法載入設定檔: HTTP ${response.status} ${response.statusText}`);
            }
            
            const currentConfigText = await response.text();
            const currentMd5 = await this.calculateMD5(currentConfigText);
            
            console.log('當前 MD5:', currentMd5);
            console.log('載入時 MD5:', this.currentMd5);
            
            if (currentMd5 !== this.currentMd5) {
                console.warn('⚠️ 配置文件已變更，強制重新填寫');
                alert('問卷配置已更新，請重新開始填寫。');
                this.clearAllData();
                window.location.reload();
                return false;
            }
            
            console.log('✅ 配置文件驗證通過');
            return true;
        } catch (error) {
            console.error('❌ 驗證配置文件時發生錯誤:', error);
            alert('驗證配置文件時發生錯誤，請重新整理頁面。');
            return false;
        }
    }
}

// 初始化應用程式
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 處理移動端視窗高度問題
        function setVH() {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }
        
        // 初始設定和監聽視窗大小變化
        setVH();
        window.addEventListener('resize', setVH);
        window.addEventListener('orientationchange', setVH);
        
        // 等待少許時間讓 Loading 畫面完全渲染
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 載入所有必要的外部資源（CDN 優先，本地容錯）
        console.log('🚀 開始載入外部資源...');
        const resourcesLoaded = await loadAllResources();
        
        if (!resourcesLoaded) {
            throw new Error('外部資源載入失敗，無法繼續執行');
        }
        
        console.log('✅ 所有外部資源載入完成，開始初始化應用...');
        
        // 等待 Loading 畫面完全隱藏後再初始化應用
        setTimeout(() => {
            new DEMATELSurvey();
        }, 600);
        
    } catch (error) {
        console.error('❌ 應用程式啟動失敗:', error);
        
        // 隱藏 Loading 畫面並顯示錯誤
        if (window.loadingManager) {
            window.loadingManager.showError('系統啟動失敗');
            
            // 延遲顯示錯誤頁面
            setTimeout(() => {
                window.loadingManager.hide(0);
                showErrorPage(error);
            }, 2000);
        } else {
            showErrorPage(error);
        }
    }
});

/**
 * 顯示錯誤頁面
 * @param {Error} error - 錯誤物件
 */
function showErrorPage(error) {
    const body = document.body;
    if (body) {
        body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 2rem;
                text-align: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                background: linear-gradient(135deg, #fefae0 0%, #f7f1d1 100%);
            ">
                <div style="
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                    max-width: 500px;
                    border: 1px solid rgba(212, 163, 115, 0.2);
                ">
                    <div style="
                        width: 64px;
                        height: 64px;
                        margin: 0 auto 1.5rem;
                        background: #fee2e2;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 2rem;
                    ">⚠️</div>
                    <h2 style="color: #dc2626; margin-bottom: 1rem; font-size: 1.5rem;">系統載入失敗</h2>
                    <p style="color: #6b7280; margin-bottom: 1.5rem; line-height: 1.6;">
                        ${error.message || '未知錯誤，請檢查網路連線並重試'}
                    </p>
                    <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                        <button 
                            onclick="window.location.reload()" 
                            style="
                                background: #d4a373;
                                color: white;
                                border: none;
                                padding: 0.75rem 1.5rem;
                                border-radius: 8px;
                                cursor: pointer;
                                font-size: 1rem;
                                transition: background-color 0.2s;
                            "
                            onmouseover="this.style.background='#c4956b'"
                            onmouseout="this.style.background='#d4a373'"
                        >
                            🔄 重新載入
                        </button>
                        <button 
                            onclick="console.log('Debug info:', {error: '${error.message}', stack: '${error.stack?.replace(/'/g, "\\'") || 'N/A'}'})" 
                            style="
                                background: #6b7280;
                                color: white;
                                border: none;
                                padding: 0.75rem 1.5rem;
                                border-radius: 8px;
                                cursor: pointer;
                                font-size: 1rem;
                                transition: background-color 0.2s;
                            "
                            onmouseover="this.style.background='#4b5563'"
                            onmouseout="this.style.background='#6b7280'"
                        >
                            🔍 查看詳情
                        </button>
                    </div>
                    <p style="color: #9ca3af; font-size: 0.875rem; margin-top: 1.5rem;">
                        如果問題持續發生，請檢查瀏覽器控制台獲取更多資訊
                    </p>
                </div>
            </div>
        `;
    } else {
        alert(`載入失敗: ${error.message}\n\n請重新整理頁面。`);
    }
}
