/**
 * CDN 資源載入器 - 優先使用 CDN，失敗時容錯到本地檔案
 * 版本: 1.0
 * 功能: 智慧載入外部資源，提供容錯機制
 */

class ResourceLoader {
    constructor() {
        this.loadedResources = new Set();
        this.loadingPromises = new Map();
        this.fallbackTimeout = 5000; // 5秒超時容錯
        this.progressCallback = null; // 進度回調函數
        this.totalResources = 0;
        this.loadedCount = 0;
    }

    /**
     * 設置進度回調函數
     * @param {Function} callback - 進度回調 (progress, status, details)
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    /**
     * 更新載入進度
     * @param {string} status - 狀態訊息
     * @param {string} details - 詳細訊息
     */
    updateProgress(status, details = '') {
        const progress = this.totalResources > 0 ? (this.loadedCount / this.totalResources) * 100 : 0;
        
        if (this.progressCallback) {
            this.progressCallback(progress, status, details);
        }
        
        console.log(`📊 載入進度: ${progress.toFixed(1)}% - ${status}${details ? ` (${details})` : ''}`);
    }

    /**
     * 載入 JavaScript 資源
     * @param {string} name - 資源名稱
     * @param {string} cdnUrl - CDN URL
     * @param {string} fallbackUrl - 本地容錯 URL
     * @param {Function} validator - 驗證函數，檢查資源是否成功載入
     * @returns {Promise} - 載入結果
     */
    async loadScript(name, cdnUrl, fallbackUrl, validator) {
        // 避免重複載入
        if (this.loadedResources.has(name)) {
            return Promise.resolve();
        }

        // 如果正在載入中，返回已存在的 Promise
        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }

        this.updateProgress(`正在載入 ${name}...`, '嘗試連接 CDN');

        const loadPromise = this._loadScriptWithFallback(name, cdnUrl, fallbackUrl, validator);
        this.loadingPromises.set(name, loadPromise);

        try {
            await loadPromise;
            this.loadedResources.add(name);
            this.loadedCount++;
            this.updateProgress(`${name} 載入完成`, '✅ 成功');
            console.log(`✅ ${name} 載入成功`);
        } catch (error) {
            this.updateProgress(`${name} 載入失敗`, `❌ ${error.message}`);
            console.error(`❌ ${name} 載入失敗:`, error);
            throw error;
        } finally {
            this.loadingPromises.delete(name);
        }

        return loadPromise;
    }

    /**
     * 載入 CSS 資源
     * @param {string} name - 資源名稱
     * @param {string} cdnUrl - CDN URL
     * @param {string} fallbackUrl - 本地容錯 URL
     * @returns {Promise} - 載入結果
     */
    async loadCSS(name, cdnUrl, fallbackUrl) {
        // 避免重複載入
        if (this.loadedResources.has(name)) {
            return Promise.resolve();
        }

        // 如果正在載入中，返回已存在的 Promise
        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }

        this.updateProgress(`正在載入 ${name} 字體...`, '正在連接字體服務');

        const loadPromise = this._loadCSSWithFallback(name, cdnUrl, fallbackUrl);
        this.loadingPromises.set(name, loadPromise);

        try {
            await loadPromise;
            this.loadedResources.add(name);
            this.loadedCount++;
            this.updateProgress(`${name} 字體載入完成`, '✅ 字體可用');
            console.log(`✅ ${name} CSS 載入成功`);
        } catch (error) {
            this.updateProgress(`${name} 字體載入失敗`, `❌ ${error.message}`);
            console.error(`❌ ${name} CSS 載入失敗:`, error);
            throw error;
        } finally {
            this.loadingPromises.delete(name);
        }

        return loadPromise;
    }

    /**
     * 內部方法：帶容錯的 Script 載入
     */
    async _loadScriptWithFallback(name, cdnUrl, fallbackUrl, validator) {
        console.log(`🔄 開始載入 ${name}...`);

        // 首先嘗試 CDN
        try {
            console.log(`📡 嘗試從 CDN 載入 ${name}: ${cdnUrl}`);
            this.updateProgress(`正在從 CDN 載入 ${name}...`, 'CDN 連線中');
            await this._loadSingleScript(cdnUrl, validator);
            this.updateProgress(`${name} CDN 載入成功`, '🚀 高速載入完成');
            console.log(`🚀 ${name} CDN 載入成功`);
            return;
        } catch (cdnError) {
            this.updateProgress(`${name} CDN 載入失敗`, '⚠️ 嘗試本地容錯');
            console.warn(`⚠️ ${name} CDN 載入失敗，嘗試本地容錯:`, cdnError.message);
        }

        // CDN 失敗，嘗試本地檔案
        try {
            console.log(`💾 嘗試從本地載入 ${name}: ${fallbackUrl}`);
            this.updateProgress(`正在從本地載入 ${name}...`, '💾 本地容錯載入中');
            await this._loadSingleScript(fallbackUrl, validator);
            this.updateProgress(`${name} 本地載入成功`, '🏠 容錯載入完成');
            console.log(`🏠 ${name} 本地載入成功`);
        } catch (fallbackError) {
            console.error(`💥 ${name} 本地載入也失敗:`, fallbackError.message);
            throw new Error(`${name} 載入完全失敗: CDN 和本地都無法載入`);
        }
    }

    /**
     * 內部方法：帶容錯的 CSS 載入
     */
    async _loadCSSWithFallback(name, cdnUrl, fallbackUrl) {
        console.log(`🔄 開始載入 CSS ${name}...`);

        // 首先嘗試 CDN
        try {
            console.log(`📡 嘗試從 CDN 載入 CSS ${name}: ${cdnUrl}`);
            this.updateProgress(`正在從 CDN 載入字體...`, 'Google Fonts 連線中');
            await this._loadSingleCSS(cdnUrl);
            this.updateProgress(`${name} CDN 載入成功`, '🚀 Google Fonts 載入完成');
            console.log(`🚀 ${name} CSS CDN 載入成功`);
            return;
        } catch (cdnError) {
            this.updateProgress(`${name} CDN 載入失敗`, '⚠️ 使用本地字體');
            console.warn(`⚠️ ${name} CSS CDN 載入失敗，嘗試本地容錯:`, cdnError.message);
        }

        // CDN 失敗，嘗試本地檔案
        try {
            console.log(`💾 嘗試從本地載入 CSS ${name}: ${fallbackUrl}`);
            this.updateProgress(`正在載入本地字體...`, '💾 本地字體載入中');
            await this._loadSingleCSS(fallbackUrl);
            this.updateProgress(`${name} 本地載入成功`, '🏠 本地字體載入完成');
            console.log(`🏠 ${name} CSS 本地載入成功`);
        } catch (fallbackError) {
            console.error(`💥 ${name} CSS 本地載入也失敗:`, fallbackError.message);
            throw new Error(`${name} CSS 載入完全失敗: CDN 和本地都無法載入`);
        }
    }

    /**
     * 載入單個 Script
     */
    _loadSingleScript(url, validator) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;

            // 設置超時
            const timeout = setTimeout(() => {
                reject(new Error(`載入超時: ${url}`));
            }, this.fallbackTimeout);

            script.onload = () => {
                clearTimeout(timeout);
                
                // 如果有驗證器，檢查資源是否真的可用
                if (validator && !validator()) {
                    reject(new Error(`資源驗證失敗: ${url}`));
                    return;
                }
                
                resolve();
            };

            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`載入錯誤: ${url}`));
            };

            // 添加到頁面
            document.head.appendChild(script);
        });
    }

    /**
     * 載入單個 CSS
     */
    _loadSingleCSS(url) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;

            // 設置超時
            const timeout = setTimeout(() => {
                reject(new Error(`CSS 載入超時: ${url}`));
            }, this.fallbackTimeout);

            link.onload = () => {
                clearTimeout(timeout);
                resolve();
            };

            link.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`CSS 載入錯誤: ${url}`));
            };

            // 添加到頁面
            document.head.appendChild(link);
        });
    }

    /**
     * 批量載入資源
     * @param {Array} resources - 資源配置陣列
     * @returns {Promise} - 所有資源載入結果
     */
    async loadMultiple(resources) {
        this.totalResources = resources.length;
        this.loadedCount = 0;
        
        this.updateProgress('開始載入外部資源...', `共 ${this.totalResources} 個資源`);

        const loadPromises = resources.map(resource => {
            if (resource.type === 'script') {
                return this.loadScript(resource.name, resource.cdnUrl, resource.fallbackUrl, resource.validator);
            } else if (resource.type === 'css') {
                return this.loadCSS(resource.name, resource.cdnUrl, resource.fallbackUrl);
            }
        });

        try {
            await Promise.all(loadPromises);
            this.updateProgress('所有資源載入完成！', '🎉 系統準備就緒');
            console.log('🎉 所有資源載入完成！');
        } catch (error) {
            this.updateProgress('資源載入失敗', `❌ ${error.message}`);
            console.error('💥 批量資源載入失敗:', error);
            throw error;
        }
    }

    /**
     * 檢查資源是否已載入
     */
    isLoaded(name) {
        return this.loadedResources.has(name);
    }

    /**
     * 取得載入統計
     */
    getStats() {
        return {
            loaded: Array.from(this.loadedResources),
            loading: Array.from(this.loadingPromises.keys()),
            total: this.loadedResources.size
        };
    }
}

/**
 * Loading 畫面管理器
 */
class LoadingManager {
    constructor() {
        this.loaderElement = null;
        this.statusElement = null;
        this.progressElement = null;
        this.detailsElement = null;
    }

    /**
     * 初始化 Loading 元素
     */
    init() {
        this.loaderElement = document.getElementById('resourceLoader');
        this.statusElement = document.getElementById('loadingStatus');
        this.progressElement = document.getElementById('loadingProgress');
        this.detailsElement = document.getElementById('loadingDetails');
        
        if (!this.loaderElement) {
            console.warn('Loading 元素未找到');
            return false;
        }
        
        console.log('✅ Loading 管理器初始化完成');
        return true;
    }

    /**
     * 更新 Loading 狀態
     * @param {number} progress - 進度百分比 (0-100)
     * @param {string} status - 狀態訊息
     * @param {string} details - 詳細訊息
     */
    updateProgress(progress, status, details = '') {
        if (!this.loaderElement) return;

        if (this.statusElement) {
            this.statusElement.textContent = status;
        }

        if (this.progressElement) {
            this.progressElement.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }

        if (this.detailsElement) {
            this.detailsElement.textContent = details;
        }
    }

    /**
     * 隱藏 Loading 畫面
     * @param {number} delay - 延遲時間（毫秒）
     */
    hide(delay = 500) {
        if (!this.loaderElement) return;

        // 最終狀態顯示
        this.updateProgress(100, '載入完成！', '🎉 正在進入系統...');

        setTimeout(() => {
            this.loaderElement.classList.add('hidden');
            
            // 完全隱藏後移除元素
            setTimeout(() => {
                if (this.loaderElement && this.loaderElement.parentNode) {
                    this.loaderElement.parentNode.removeChild(this.loaderElement);
                }
            }, 500);
        }, delay);
    }

    /**
     * 顯示錯誤狀態
     * @param {string} message - 錯誤訊息
     */
    showError(message) {
        if (!this.loaderElement) return;

        this.updateProgress(0, '載入失敗', `❌ ${message}`);
        
        // 修改樣式顯示錯誤狀態
        if (this.progressElement) {
            this.progressElement.style.background = 'linear-gradient(90deg, #e63946 0%, #dc3545 100%)';
        }
    }
}

// 創建全域 Loading 管理器
window.loadingManager = new LoadingManager();

// 資源配置
window.RESOURCE_CONFIG = {
    qrcode: {
        name: 'QRCode',
        type: 'script',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
        fallbackUrl: 'lib/qrcode.min.js',
        validator: () => typeof QRCode !== 'undefined'
    },
    pako: {
        name: 'Pako',
        type: 'script',
        cdnUrl: 'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js',
        fallbackUrl: 'lib/pako.min.js',
        validator: () => typeof pako !== 'undefined'
    },
    notoSansTC: {
        name: 'Noto Sans TC',
        type: 'css',
        cdnUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap',
        fallbackUrl: 'lib/fonts/noto-sans-tc.css'
    }
};

// 創建全域實例
window.resourceLoader = new ResourceLoader();

/**
 * 便捷函數：載入所有必要資源（帶 Loading 畫面）
 */
async function loadAllResources() {
    const resources = Object.values(window.RESOURCE_CONFIG);
    
    // 初始化 Loading 管理器
    const loadingInitialized = window.loadingManager.init();
    
    // 設置進度回調
    if (loadingInitialized) {
        window.resourceLoader.setProgressCallback((progress, status, details) => {
            window.loadingManager.updateProgress(progress, status, details);
        });
    }
    
    try {
        console.log('🚀 開始載入所有外部資源...');
        
        // 初始狀態
        if (loadingInitialized) {
            window.loadingManager.updateProgress(0, '正在初始化...', '檢查網路連線');
        }
        
        await window.resourceLoader.loadMultiple(resources);
        
        console.log('✅ 所有外部資源載入完成！');
        
        // 隱藏 Loading 畫面
        if (loadingInitialized) {
            window.loadingManager.hide(800);
        }
        
        return true;
    } catch (error) {
        console.error('❌ 資源載入失敗:', error);
        
        // 顯示錯誤狀態
        if (loadingInitialized) {
            window.loadingManager.showError('資源載入失敗，請檢查網路連線');
        }
        
        return false;
    }
}

// 匯出到全域
window.loadAllResources = loadAllResources;
