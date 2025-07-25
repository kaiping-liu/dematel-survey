// Phase 3: Lazy Render 模組 - 實現性能優化的漸進式渲染
// 目標：同時存在 DOM 元素 ≤ 30，確保千題卷不卡頓

class LazyRenderer {
  constructor(container, maxVisibleItems = 30) {
    this.container = container;
    this.maxVisibleItems = maxVisibleItems;
    this.items = [];
    this.visibleItems = new Map(); // 當前可見項目
    this.currentIndex = 0;
    this.renderBuffer = 5; // 預渲染緩衝區
    
    console.log(`=== Phase 3: Lazy Renderer 初始化 (最大可見項目: ${maxVisibleItems}) ===`);
  }

  // 設置資料源
  setData(items) {
    this.items = items;
    this.currentIndex = 0;
    this.clearAllItems();
    console.log(`Lazy Renderer: 載入 ${items.length} 個項目`);
  }

  // 渲染當前項目
  renderCurrent() {
    const startTime = performance.now();
    
    this.clearAllItems();
    
    if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
      const item = this.items[this.currentIndex];
      const element = this.renderItem(item, this.currentIndex);
      
      if (element) {
        this.container.appendChild(element);
        this.visibleItems.set(this.currentIndex, element);
        
        // 預渲染相鄰項目（如果有空間）
        this.preRenderAdjacent();
      }
    }
    
    const endTime = performance.now();
    console.log(`Lazy Render: 渲染項目 ${this.currentIndex + 1}/${this.items.length} (耗時: ${(endTime - startTime).toFixed(2)}ms)`);
    
    this.updateMemoryStatus();
  }

  // 預渲染相鄰項目（性能優化）
  preRenderAdjacent() {
    const maxPreRender = Math.min(this.renderBuffer, this.maxVisibleItems - 1);
    let preRendered = 0;
    
    // 向前預渲染
    for (let i = 1; i <= maxPreRender && (this.currentIndex + i) < this.items.length && preRendered < maxPreRender; i++) {
      const index = this.currentIndex + i;
      if (!this.visibleItems.has(index)) {
        const item = this.items[index];
        const element = this.renderItem(item, index);
        if (element) {
          element.style.display = 'none'; // 預渲染但隱藏
          this.container.appendChild(element);
          this.visibleItems.set(index, element);
          preRendered++;
        }
      }
    }
    
    // 向後預渲染
    for (let i = 1; i <= maxPreRender && (this.currentIndex - i) >= 0 && preRendered < maxPreRender * 2; i++) {
      const index = this.currentIndex - i;
      if (!this.visibleItems.has(index)) {
        const item = this.items[index];
        const element = this.renderItem(item, index);
        if (element) {
          element.style.display = 'none'; // 預渲染但隱藏
          this.container.appendChild(element);
          this.visibleItems.set(index, element);
          preRendered++;
        }
      }
    }
  }

  // 渲染單個項目（使用安全渲染）
  renderItem(item, index) {
    if (!window.secureRenderer) {
      console.error('SecureRenderer not available');
      return null;
    }
    
    // 根據項目類型選擇不同的渲染方式
    if (item.type === 'question') {
      return window.secureRenderer.renderQuestion(item, index);
    } else if (item.type === 'basicInfo') {
      return window.secureRenderer.renderBasicInfoForm(item.fields);
    }
    
    return null;
  }

  // 導航到指定項目
  goTo(index) {
    if (index < 0 || index >= this.items.length) {
      console.warn(`Invalid index: ${index}`);
      return false;
    }
    
    this.currentIndex = index;
    this.renderCurrent();
    return true;
  }

  // 下一項
  next() {
    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
      this.renderCurrent();
      return true;
    }
    return false;
  }

  // 上一項
  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderCurrent();
      return true;
    }
    return false;
  }

  // 清空所有項目
  clearAllItems() {
    this.visibleItems.forEach((element, index) => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.visibleItems.clear();
    
    // 確保容器完全清空
    if (window.secureRenderer) {
      window.secureRenderer.clearContainer(this.container);
    }
  }

  // 記憶體狀態監控
  updateMemoryStatus() {
    const visibleCount = this.visibleItems.size;
    const totalElements = this.container.querySelectorAll('*').length;
    
    if (visibleCount > this.maxVisibleItems) {
      console.warn(`⚠️ 可見項目超限: ${visibleCount}/${this.maxVisibleItems}`);
      this.cleanup();
    }
    
    console.log(`DOM 狀態: 可見項目 ${visibleCount}, 總元素 ${totalElements}`);
  }

  // 清理過多的預渲染項目
  cleanup() {
    const toRemove = [];
    const keepRange = this.renderBuffer;
    
    this.visibleItems.forEach((element, index) => {
      const distance = Math.abs(index - this.currentIndex);
      if (distance > keepRange && index !== this.currentIndex) {
        toRemove.push(index);
      }
    });
    
    toRemove.forEach(index => {
      const element = this.visibleItems.get(index);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.visibleItems.delete(index);
    });
    
    console.log(`清理完成: 移除 ${toRemove.length} 個項目`);
  }

  // 獲取當前狀態
  getStatus() {
    return {
      currentIndex: this.currentIndex,
      totalItems: this.items.length,
      visibleItems: this.visibleItems.size,
      progress: this.items.length > 0 ? ((this.currentIndex + 1) / this.items.length * 100).toFixed(1) : 0
    };
  }

  // 性能測試
  performanceTest() {
    console.log('=== Phase 3: Lazy Render 性能測試 ===');
    
    const testData = [];
    for (let i = 0; i < 1000; i++) {
      testData.push({
        type: 'question',
        question: `測試問題 ${i + 1}`,
        description: `這是第 ${i + 1} 個測試問題的描述`,
        factorA: `因子A${i + 1}`,
        factorB: `因子B${i + 1}`
      });
    }
    
    this.setData(testData);
    
    const startTime = performance.now();
    
    // 測試快速導航
    for (let i = 0; i < 50; i++) {
      const randomIndex = Math.floor(Math.random() * testData.length);
      this.goTo(randomIndex);
    }
    
    const endTime = performance.now();
    console.log(`性能測試完成: 1000題 x 50次隨機導航 耗時 ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`平均每次導航: ${((endTime - startTime) / 50).toFixed(2)}ms`);
    
    return endTime - startTime;
  }
}

// 導出供其他模組使用
window.LazyRenderer = LazyRenderer;
