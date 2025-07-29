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
        
        this.initializeApp();
    }

    /**
     * 初始化應用程式
     */
    async initializeApp() {
        try {
            console.log('開始初始化 DEMATEL Survey...');
            
            // 載入設定檔
            console.log('正在載入設定檔...');
            await this.loadConfig();
            console.log('設定檔載入完成');
            
            // 初始化 UI
            console.log('正在初始化 UI...');
            this.initializeUI();
            console.log('UI 初始化完成');
            
            // 設置事件監聽器
            console.log('正在設置事件監聽器...');
            this.setupEventListeners();
            console.log('事件監聽器設置完成');
            
            // 初始化進度顯示
            this.updateProgress();
            
            console.log('DEMATEL Survey 初始化完成');
            
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
            console.log('正在載入 dematel-structure.json...');
            
            // 強制重新抓取，禁用快取
            const timestamp = Date.now();
            const url = `dematel-structure.json?t=${timestamp}`;
            console.log('請求 URL:', url);
            
            const response = await fetch(url, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            if (!response.ok) {
                throw new Error(`無法載入設定檔: HTTP ${response.status} ${response.statusText}`);
            }
            
            console.log('正在解析 JSON...');
            const configText = await response.text();
            this.config = JSON.parse(configText);
            console.log('JSON 解析完成，config:', this.config);
            
            // 計算新的 MD5
            const newMD5 = await this.calculateMD5(configText);
            console.log('新檔案 MD5:', newMD5);
            
            // 驗證設定檔
            console.log('正在驗證設定檔...');
            this.validateConfig();
            console.log('設定檔驗證完成');
            
            // 計算資料雜湊
            console.log('正在計算資料雜湊...');
            this.calculateDataHash();
            console.log('資料雜湊計算完成');
            
            // 產生問卷
            console.log('正在產生問卷題目...');
            await this.generateQuestions();
            console.log('問卷題目產生完成');
            
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
            console.log('第一次載入設定檔，儲存 MD5');
            localStorage.setItem('dematel_config_md5', newMD5);
            this.currentMd5 = newMD5;
            this.showView('intro');
            return;
        }
        
        if (storedMD5 === newMD5) {
            // MD5 相同，檢查是否有未完成的問卷
            console.log('設定檔未變更');
            this.currentMd5 = newMD5;
            await this.showConfigUnchangedDialog();
        } else {
            // MD5 不同，設定檔已變更
            console.log('設定檔已變更');
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
        
        // 隨機排序（如果需要）
        // this.shuffleQuestions();
        
        // 設定題庫完成旗標
        this.isQuestionGenerationComplete = true;
        console.log('✅ 問卷題目生成完成，共', this.questions.length, '題');
        
        console.log(`產生 ${this.questions.length} 道題目`);
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
        
        console.log(`收集到 ${allCriteria.length} 個準則`);
        
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
                
                console.log(`${type} 問題生成完成，共 ${questions.length} 題`);
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
                        description: dimensionA.說明
                    },
                    itemB: {
                        id: dimensionB.代碼,
                        name: dimensionB.構面,
                        description: dimensionB.說明
                    }
                };
            }
        }
    }

    /**
     * 隨機排序題目
     */
    shuffleQuestions() {
        // Fisher-Yates 洗牌演算法
        let seed = parseInt(localStorage.getItem('dematel_shuffle_seed')) || Date.now();
        const rng = this.seededRandom(seed);
        
        for (let i = this.questions.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [this.questions[i], this.questions[j]] = [this.questions[j], this.questions[i]];
        }
        
        localStorage.setItem('dematel_shuffle_seed', seed.toString());
    }

    /**
     * 種子隨機數產生器
     */
    seededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

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
                    } else if (line.startsWith('•')) {
                        return `<li>${line.substring(1).trim()}</li>`;
                    } else {
                        return `<p>${line}</p>`;
                    }
                }).join('');
            } else {
                contentEl.innerHTML = `<p>${content}</p>`;
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
        const storedBasicInfo = localStorage.getItem('dematel_basic_info');
        const storedAnswers = localStorage.getItem('dematel_answers');
        const storedSurveyId = localStorage.getItem('dematel_survey_id');
        const storedConfigMd5 = localStorage.getItem('dematel_config_md5');
        
        console.log('🔍 檢查現有資料:');
        console.log('存儲的階段:', storedPhase);
        console.log('存儲的索引:', storedIndex);
        console.log('存儲的基本資料:', storedBasicInfo ? '存在' : '不存在');
        console.log('存儲的答案:', storedAnswers ? '存在' : '不存在');
        console.log('存儲的問卷編號:', storedSurveyId);
        console.log('存儲的配置 MD5:', storedConfigMd5);
        
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
        
        if (storedPhase && storedBasicInfo) {
            // 載入已存資料，但不顯示 UI（由 Modal 系統處理）
            this.currentPhase = storedPhase;
            this.currentIndex = parseInt(storedIndex) || 0;
            this.basicInfo = JSON.parse(storedBasicInfo);
            this.answers = storedAnswers ? JSON.parse(storedAnswers) : {};
            
            console.log('✅ 資料載入完成:');
            console.log('當前階段:', this.currentPhase);
            console.log('當前索引:', this.currentIndex);
            console.log('問卷編號:', this.surveyId);
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
        
        if (!button) return;
        
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
        } else if (id === 'closeModalBtn') {
            this.hideModal();
        } else if (id === 'downloadBtn') {
            this.downloadResults();
        } else if (id === 'generateQRBtn') {
            this.generateQRCode();
        } else if (id === 'restartSurveyBtn') {
            this.restartSurvey();
        } else if (id === 'debugToggle') {
            this.toggleDebugPanel();
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
        this.currentPhase = 'basic';
        this.currentIndex = 0;
        this.showView('basic');
        this.updateProgress();
    }

    /**
     * 繼續填寫問卷
     */
    async resumeSurvey() {
        console.log('📍 resumeSurvey 開始執行');
        console.log('當前階段:', this.currentPhase);
        console.log('當前題目索引:', this.currentIndex);
        
        // 確保題庫生成完成
        if (!this.isQuestionGenerationComplete) {
            console.log('⏳ 等待題庫生成完成...');
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (this.isQuestionGenerationComplete) {
                        clearInterval(checkInterval);
                        console.log('✅ 題庫生成完成，繼續恢復問卷');
                        resolve();
                    }
                }, 50);
            });
        }
        
        // 載入基本資料到表單
        this.loadBasicInfoToForm();
        
        // 跳轉到對應頁面
        if (this.currentPhase === 'intro') {
            console.log('當前階段為 intro，但有儲存資料，應該恢復到實際進度');
            // 如果 currentPhase 是 intro 但有儲存的資料，說明資料載入有問題
            // 重新載入一次資料
            this.checkExistingData();
            console.log('重新載入後，當前階段:', this.currentPhase, '當前索引:', this.currentIndex);
            
            // 根據重新載入的資料決定顯示哪個頁面
            if (this.currentPhase === 'basic') {
                console.log('顯示基本資料頁面');
                this.showView('basic');
            } else if (this.currentPhase === 'criteria' || this.currentPhase === 'dimension') {
                console.log('顯示問卷頁面，階段:', this.currentPhase, '題目:', this.currentIndex);
                this.showView('question');
                this.updateQuestionView();
            } else if (this.currentPhase === 'finish') {
                console.log('顯示完成頁面');
                this.showView('finish');
            }
        } else if (this.currentPhase === 'basic') {
            console.log('顯示基本資料頁面');
            this.showView('basic');
        } else if (this.currentPhase === 'criteria' || this.currentPhase === 'dimension') {
            console.log('顯示問卷頁面，階段:', this.currentPhase, '題目:', this.currentIndex);
            this.showView('question');
            this.updateQuestionView();
        } else if (this.currentPhase === 'finish') {
            console.log('顯示完成頁面');
            this.showView('finish');
        }
        
        this.updateProgress();
        console.log('📍 resumeSurvey 執行完成');
    }

    /**
     * 重新開始問卷
     */
    restartSurvey() {
        if (confirm('確定要重新開始嗎？所有已填寫的資料將會清除。')) {
            // 清除所有資料
            this.clearAllData();
            
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
        
        console.log(`開始 ${this.currentPhase} 階段，共 ${this.getCurrentQuestions().length} 題`);
        
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
                this.nextQuestion();
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
        const currentQuestions = this.getCurrentQuestions();
        
        if (this.currentIndex < currentQuestions.length - 1) {
            this.currentIndex++;
        } else {
            // 當前階段完成
            if (this.currentPhase === 'dimension') {
                // 進入準則比較階段
                this.currentPhase = 'criteria';
                this.currentIndex = 0;
            } else {
                // 完成所有題目
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
        if (this.currentIndex > 0) {
            this.currentIndex--;
        } else if (this.currentPhase === 'criteria') {
            // 回到構面比較的最後一題
            this.currentPhase = 'dimension';
            this.currentIndex = this.getDimensionQuestions().length - 1;
        } else if (this.currentPhase === 'dimension') {
            // 構面比較是第一階段，無法再往前
            console.log('已經是第一題，無法再往前');
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
    }

    /**
     * 更新問卷視圖
     */
    updateQuestionView() {
        console.log('📋 updateQuestionView 開始');
        console.log('當前階段:', this.currentPhase);
        console.log('當前索引:', this.currentIndex);
        
        // 💡 每次題目載入就強制重置所有按鈕狀態 - 這是根本解決方案
        this.resetAllButtonStates();
        
        // 調試：檢查當前階段的題目列表
        const currentQuestions = this.getCurrentQuestions();
        console.log('🔍 當前階段題目總數:', currentQuestions.length);
        console.log('🔍 要顯示的題目索引:', this.currentIndex);
        
        if (currentQuestions.length > 0) {
            console.log('🔍 前5題預覽:');
            currentQuestions.slice(0, Math.min(5, currentQuestions.length)).forEach((q, idx) => {
                console.log(`  ${idx}: ${q.itemA.name} vs ${q.itemB.name}${idx === this.currentIndex ? ' ← 當前' : ''}`);
            });
        }
        
        const question = this.getCurrentQuestion();
        if (!question) {
            console.error('❌ 無法獲取當前題目');
            console.log('currentPhase:', this.currentPhase);
            console.log('currentIndex:', this.currentIndex);
            console.log('criteriaQuestions length:', this.getCriteriaQuestions()?.length);
            console.log('dimensionQuestions length:', this.getDimensionQuestions()?.length);
            console.log('isQuestionGenerationComplete:', this.isQuestionGenerationComplete);
            console.log('total questions length:', this.questions?.length);
            
            // 如果題庫還沒生成完成，等待一下再重試
            if (!this.isQuestionGenerationComplete) {
                console.log('⏳ 題庫尚未完成，等待後重試...');
                setTimeout(() => {
                    this.updateQuestionView();
                }, 100);
                return;
            }
            
            // 如果題庫已完成但還是沒有題目，顯示錯誤
            console.error('🚨 題庫已完成但無法獲取題目，可能存在嚴重錯誤');
            alert('載入題目時發生錯誤，請重新整理頁面');
            return;
        }
        
        console.log('✅ 當前題目:', question.itemA.name, 'vs', question.itemB.name);
        
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
        
        console.log('✅ updateQuestionView 完成');
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
        
        console.log('✅ 所有按鈕狀態已重置');
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
        
        console.log('📊 updateProgress 開始');
        console.log('當前階段:', this.currentPhase);
        console.log('當前索引:', this.currentIndex);
        
        switch (this.currentPhase) {
            case 'intro':
                progress = 0;
                break;
            case 'basic':
                progress = 5;
                break;
            case 'dimension':
                const dimensionQuestions = this.getDimensionQuestions();
                console.log('📊 dimension題目總數:', dimensionQuestions.length);
                if (dimensionQuestions.length > 0) {
                    const dimensionProgress = (this.currentIndex / dimensionQuestions.length) * 20;
                    progress = 10 + dimensionProgress;
                    console.log('📊 dimension進度計算: currentIndex=', this.currentIndex, '/ total=', dimensionQuestions.length, '* 20 + 10 =', progress);
                } else {
                    progress = 30;
                }
                break;
            case 'criteria':
                const criteriaQuestions = this.getCriteriaQuestions();
                console.log('📊 criteria題目總數:', criteriaQuestions.length);
                if (criteriaQuestions.length > 0) {
                    const criteriaProgress = (this.currentIndex / criteriaQuestions.length) * 70;
                    progress = 30 + criteriaProgress;
                    console.log('📊 criteria進度計算: currentIndex=', this.currentIndex, '/ total=', criteriaQuestions.length, '* 70 + 30 =', progress);
                } else {
                    progress = 100;
                }
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
        console.log('🔄 showView 被調用，目標視圖:', viewName);
        
        // 禁用交互防止連點
        this.disableInteractions();
        
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
        console.log('🎯 目標視圖元素:', targetView ? '找到' : '未找到', `#view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
        
        if (targetView) {
            targetView.style.display = 'block';
            console.log('📱 設定 display: block');
            
            setTimeout(() => {
                targetView.classList.add('active');
                console.log('✨ 添加 active 類別');
                
                // 如果是問卷頁面，同時激活問卷內容
                if (viewName === 'question') {
                    const questionContent = document.querySelector('.question-card__content');
                    if (questionContent) {
                        questionContent.classList.add('active');
                        console.log('📝 激活問卷內容');
                    }
                }
                
                // 如果是完成頁面，顯示問卷編號
                if (viewName === 'finish') {
                    const surveyIdDisplay = document.getElementById('surveyIdDisplay');
                    if (surveyIdDisplay) {
                        surveyIdDisplay.textContent = this.surveyId;
                        console.log('🆔 顯示問卷編號:', this.surveyId);
                    }
                }
                
                // 動畫完成後重新啟用交互
                setTimeout(() => {
                    this.enableInteractions();
                    console.log('🔓 重新啟用交互');
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
     * 下載結果
     */
    async downloadResults() {
        // 先驗證配置文件MD5
        const isValid = await this.validateConfigBeforeAction();
        if (!isValid) {
            return;
        }

        const results = {
            surveyId: this.surveyId,
            basicInfo: this.basicInfo,
            answers: this.answers,
            configMd5: this.currentMd5,
            timestamp: new Date().toISOString()
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
        console.log('🔄 開始產生 QR Code...');
        
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
            // 1. 使用高度優化的數據結構
            console.log('📦 開始優化資料結構...');
            const optimizedData = this.createOptimizedData();
            console.log('� 優化後大小:', JSON.stringify(optimizedData).length, '字元');

            // 2. 計算數據完整性雜湊
            console.log('🔐 開始計算雜湊...');
            const dataString = JSON.stringify(optimizedData);
            const hash = await this.calculateSHA256(dataString);
            console.log('🔐 資料雜湊:', hash.substring(0, 16) + '...');

            // 3. 最終封裝
            const finalData = {
                data: optimizedData,
                hash: hash.substring(0, 16), // 只使用前16位節省空間
                v: "1.0" // 版本號
            };

            const finalString = JSON.stringify(finalData);
            console.log('📦 最終封裝大小:', finalString.length, '字元');

            // 檢查 pako 庫
            if (typeof pako === 'undefined') {
                throw new Error('Pako 壓縮庫未載入');
            }

            // 使用最高級別壓縮
            console.log('🗜️ 開始壓縮...');
            const compressed = pako.deflate(finalString, { 
                level: 9,
                windowBits: 15,
                memLevel: 8,
                strategy: pako.constants.Z_DEFAULT_STRATEGY
            });
            const base64 = btoa(String.fromCharCode.apply(null, compressed));
            
            console.log('🗜️ 壓縮後大小:', base64.length, '字元');
            console.log('📊 總壓縮率:', Math.round((1 - base64.length / JSON.stringify({
                surveyId: this.surveyId,
                basicInfo: this.basicInfo,
                answers: this.answers,
                configMd5: this.currentMd5,
                timestamp: new Date().toISOString()
            }).length) * 100) + '%');

            // 5. 分段切片 (優化 QR Code 容量限制)
            console.log('🔪 開始分段...');
            const maxSegmentSize = 300; // QR Code 安全容量限制
            const segments = this.splitIntoSegments(base64, maxSegmentSize);
            console.log('🔪 分割成', segments.length, '個片段 (每片最大', maxSegmentSize, '字元)');

            // 6. 把每片做成 QR
            console.log('🎯 開始生成 QR Code...');
            await this.renderQRCodes(segments);
            
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
    stableStringify(obj) {
        return JSON.stringify(obj, Object.keys(obj).sort(), 0);
    }

    /**
     * 創建高度優化的數據結構（使用自動縮短演算法）
     */
    createOptimizedData() {
        // 1. 準備完整的原始數據
        const fullData = {
            surveyId: this.surveyId,
            basicInfo: this.basicInfo,
            answers: this.answers,
            configMd5: this.currentMd5,
            timestamp: new Date().toISOString()
        };

        console.log('📊 原始數據統計:');
        console.log('- surveyId:', this.surveyId);
        console.log('- basicInfo 欄位數:', Object.keys(this.basicInfo).length);
        console.log('- answers 項目數:', Object.keys(this.answers).length);
        console.log('- 原始 JSON 大小:', this.stableStringify(fullData).length, '字元');

        // 2. 執行自動縮短
        const { vObj, keyMap, valMap } = this.autoShorten(fullData);
        
        console.log('🔤 自動縮短結果:');
        console.log('- 縮短的鍵數量:', Object.keys(keyMap).length);
        console.log('- 縮短的值數量:', Object.keys(valMap).length);
        console.log('- 壓縮後 JSON 大小:', this.stableStringify(vObj).length, '字元');

        return { vObj, keyMap, valMap };
    }



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
     * 分割成片段
     */
    splitIntoSegments(data, maxLength = 300) {
        const segments = [];
        const totalParts = Math.ceil(data.length / maxLength);
        
        for (let i = 0; i < totalParts; i++) {
            const start = i * maxLength;
            const end = Math.min(start + maxLength, data.length);
            const part = data.substring(start, end);
            
            segments.push({
                i: i,           // 序號
                total: totalParts,  // 總片數
                part: part      // 資料片段
            });
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
        
        console.log('🎯 開始渲染', segments.length, '個 QR Code (垂直排列模式)...');
        
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
                
                // 添加 QR Code 標題
                const titleDiv = document.createElement('div');
                titleDiv.style.textAlign = 'center';
                titleDiv.style.fontWeight = 'bold';
                titleDiv.style.marginBottom = '15px';
                titleDiv.style.fontSize = '16px';
                titleDiv.style.color = '#333';
                titleDiv.textContent = `QR Code(${i + 1}/${segments.length})`;
                qrWrapper.appendChild(titleDiv);
                
                // 創建 QR Code 容器
                const qrDiv = document.createElement('div');
                qrDiv.style.textAlign = 'center';
                qrWrapper.appendChild(qrDiv);
                
                // 將整個片段物件轉成字串
                const segmentString = JSON.stringify(segments[i]);
                console.log(`🔍 片段 ${i + 1} 內容:`, segmentString.substring(0, 100) + '...');
                console.log(`🔍 片段 ${i + 1} 大小:`, segmentString.length, '字元');
                
                // 使用 QRCode 庫的正確 API
                new QRCode(qrDiv, {
                    text: segmentString,
                    width: 240,
                    height: 240,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
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
                console.log(`✅ 片段 ${i + 1} QR Code 生成成功`);
            } catch (error) {
                console.error(`❌ 片段 ${i + 1} QR Code 生成失敗:`, error);
                throw new Error(`片段 ${i + 1} QR Code 生成失敗: ${error.message}`);
            }
        }
        
        // 顯示容器
        qrContainer.style.display = 'block';
        console.log('🎉 QR Code 渲染完成 - 所有QR Code已垂直排列');
    }

    /**
     * 切換 Debug 面板
     */
    toggleDebugPanel() {
        const content = document.getElementById('debugContent');
        const debugData = document.getElementById('debugData');
        
        if (content.style.display === 'none') {
            // 更新 Debug 資料
            const data = {
                phase: this.currentPhase,
                index: this.currentIndex,
                dataHash: this.dataHash,
                questionsCount: this.questions.length,
                answersCount: Object.keys(this.answers).length,
                basicInfo: this.basicInfo,
                answers: this.answers
            };
            
            debugData.textContent = JSON.stringify(data, null, 2);
            content.style.display = 'block';
            content.classList.add('show');
        } else {
            content.style.display = 'none';
            content.classList.remove('show');
        }
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
            localStorage.setItem('dematel_answers', JSON.stringify(this.answers));
            localStorage.setItem('dematel_survey_id', this.surveyId);
            
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
            'dematel_basic_info',
            'dematel_answers',
            'dematel_data_hash',
            'dematel_shuffle_seed',
            'dematel_survey_id'
        ];
        
        // 如果不保留 MD5，則一併清除
        if (!keepConfigMD5) {
            keys.push('dematel_config_md5');
        }
        
        keys.forEach(key => localStorage.removeItem(key));
        
        // 重置狀態
        this.currentPhase = 'intro';
        this.currentIndex = 0;
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

// 檢查必要庫是否已載入
async function waitForLibraries() {
    console.log('🔍 檢查必要函式庫載入狀態...');
    
    // 驗證庫是否正確載入
    const libraries = [
        { name: 'QRCode', description: 'QR Code 生成庫' },
        { name: 'pako', description: '資料壓縮庫' }
    ];
    
    for (const lib of libraries) {
        if (typeof window[lib.name] === 'undefined') {
            throw new Error(`${lib.description} 載入失敗，請檢查 lib/${lib.name.toLowerCase()}.min.js 文件是否存在`);
        }
        console.log(`✅ ${lib.description} 驗證完成`);
    }
    
    console.log('✅ 所有必要函式庫載入並驗證完成');
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
        
        // 先等待所有必要的庫載入完成
        await waitForLibraries();
        
        // 然後初始化應用
        new DEMATELSurvey();
        
    } catch (error) {
        console.error('❌ 應用程式啟動失敗:', error);
        
        // 顯示錯誤訊息
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
                    font-family: Arial, sans-serif;
                    background: #f8f9fa;
                ">
                    <div style="
                        background: white;
                        padding: 2rem;
                        border-radius: 8px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        max-width: 500px;
                    ">
                        <h2 style="color: #dc3545; margin-bottom: 1rem;">載入失敗</h2>
                        <p style="color: #6c757d; margin-bottom: 1.5rem;">${error.message}</p>
                        <button 
                            onclick="window.location.reload()" 
                            style="
                                background: #007bff;
                                color: white;
                                border: none;
                                padding: 0.75rem 1.5rem;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 1rem;
                            "
                        >
                            重新載入
                        </button>
                    </div>
                </div>
            `;
        } else {
            alert(`載入失敗: ${error.message}\n\n請重新整理頁面。`);
        }
    }
});
