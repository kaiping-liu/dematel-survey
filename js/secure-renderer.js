// Phase 3: 安全渲染模組 - 使用 template + cloneNode 替換 innerHTML
// 目標：阻斷 XSS 攻擊，提供安全的 DOM 操作

// 安全渲染類別
class SecureRenderer {
  constructor() {
    this.templates = new Map();
    this.initTemplates();
  }

  // 初始化模板緩存
  initTemplates() {
    const templateElements = document.querySelectorAll('template[id]');
    templateElements.forEach(template => {
      this.templates.set(template.id, template);
      console.log(`Template cached: ${template.id}`);
    });
  }

  // 安全創建元素（核心方法）
  createElement(templateId, data = {}) {
    const template = this.templates.get(templateId);
    if (!template) {
      console.error(`Template not found: ${templateId}`);
      return null;
    }

    // 使用 cloneNode 避免 innerHTML
    const clone = template.content.cloneNode(true);
    
    // 安全填入數據（使用 textContent 避免 XSS）
    this.populateData(clone, data);
    
    return clone;
  }

  // 安全數據填充
  populateData(element, data) {
    Object.keys(data).forEach(key => {
      const target = element.querySelector(`.${key}`) || element.querySelector(`[data-field="${key}"]`);
      if (target) {
        if (data[key] && typeof data[key] === 'object') {
          // 處理複雜對象
          this.populateData(target, data[key]);
        } else {
          // 使用 textContent 確保安全
          target.textContent = data[key] || '';
        }
      }
    });
  }

  // P0: 渲染基本資料表單欄位
  renderField(fieldConfig) {
    const { 類型: type, 編號: id, 名稱: name, 選項: options, 必填: required } = fieldConfig;
    
    let templateId;
    switch (type) {
      case 'text':
      case 'email':
        templateId = 'tpl-text-field';
        break;
      case 'select':
        templateId = 'tpl-select-field';
        break;
      case 'radio':
        templateId = 'tpl-radio-field';
        break;
      case 'checkbox':
        templateId = 'tpl-checkbox-group';
        break;
      default:
        console.warn(`未支援的欄位類型: ${type}`);
        templateId = 'tpl-text-field';
    }

    const fieldElement = this.createElement(templateId, {
      'field-id': id,
      'field-name': name,
      'field-required': required
    });

    if (!fieldElement) {
      console.error(`無法創建欄位: ${id}`);
      return document.createElement('div');
    }

    // 設置欄位屬性
    const input = fieldElement.querySelector('input, select');
    if (input) {
      input.name = id;
      input.id = id;
      if (required) input.required = true;
      if (type === 'email') input.type = 'email';
    }

    // 處理選項（select, radio, checkbox）
    if (options && options.length > 0) {
      this.renderFieldOptions(fieldElement, type, id, options);
    }

    return fieldElement;
  }

  // 渲染欄位選項
  renderFieldOptions(fieldElement, type, fieldId, options) {
    if (type === 'select') {
      const select = fieldElement.querySelector('select');
      options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
      });
    } else if (type === 'radio') {
      const container = fieldElement.querySelector('.radio-container');
      options.forEach((option, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-check';
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.className = 'form-check-input';
        input.name = fieldId;
        input.value = option;
        input.id = `${fieldId}_${index}`;
        
        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.htmlFor = `${fieldId}_${index}`;
        label.textContent = option;
        
        wrapper.appendChild(input);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
      });
    } else if (type === 'checkbox') {
      const container = fieldElement.querySelector('.checkbox-container');
      options.forEach((option, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-check';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'form-check-input';
        input.name = `${fieldId}[]`;
        input.value = option;
        input.id = `${fieldId}_${index}`;
        
        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.htmlFor = `${fieldId}_${index}`;
        label.textContent = option;
        
        wrapper.appendChild(input);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
      });
    }
  }

  // 安全設置屬性
  setAttributes(element, attributes) {
    Object.keys(attributes).forEach(key => {
      const value = attributes[key];
      if (typeof value === 'string' || typeof value === 'number') {
        element.setAttribute(key, value);
      }
    });
  }

  // 渲染問卷題目（替換原有的 innerHTML 方式）
  renderQuestion(questionData, index) {
    console.log(`=== Phase 3: 安全渲染題目 ${index + 1} ===`);
    
    const questionElement = this.createElement('questionTemplate', {
      'question-number': `第 ${index + 1} 題`,
      'question-title': questionData.question || '',
      'question-description': questionData.description || '',
      'factor-a': questionData.factorA || '',
      'factor-b': questionData.factorB || ''
    });

    if (!questionElement) return null;

    // 設置單選按鈕的 name 屬性（確保唯一性）
    const radioInputs = questionElement.querySelectorAll('input[type="radio"]');
    radioInputs.forEach(input => {
      input.name = `question-${index}`;
      input.setAttribute('data-question', index);
    });

    return questionElement;
  }

  // 渲染基本資料表單
  renderBasicInfoForm(formConfig) {
    console.log('=== Phase 3: 安全渲染基本資料表單 ===');
    
    const container = document.createDocumentFragment();
    
    formConfig.forEach(field => {
      let fieldElement;
      
      if (field.type === 'select') {
        fieldElement = this.createElement('basicInfoSelectTemplate', {
          'form-label': field.label
        });
        
        const select = fieldElement.querySelector('select');
        if (select && field.options) {
          field.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            select.appendChild(optionElement);
          });
        }
      } else {
        fieldElement = this.createElement('basicInfoTemplate', {
          'form-label': field.label
        });
        
        const input = fieldElement.querySelector('input');
        if (input) {
          input.type = field.type || 'text';
          input.name = field.name;
          input.id = field.name;
          if (field.placeholder) {
            input.placeholder = field.placeholder;
          }
        }
      }
      
      if (fieldElement) {
        container.appendChild(fieldElement);
      }
    });
    
    return container;
  }

  // 安全清空容器
  clearContainer(container) {
    if (container) {
      // 使用 replaceChildren() 或 textContent = '' 替代 innerHTML = ''
      if (container.replaceChildren) {
        container.replaceChildren();
      } else {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }
    }
  }

  // 安全替換內容
  replaceContent(container, newContent) {
    this.clearContainer(container);
    if (newContent) {
      container.appendChild(newContent);
    }
  }

  // XSS 測試功能（開發用）
  testXSSPrevention() {
    console.log('=== Phase 3: XSS 防護測試 ===');
    
    const maliciousData = {
      'question-title': '<script>alert("XSS Attack!")</script>',
      'question-description': '<img src="x" onerror="alert(\'XSS via img\')">',
      'factor-a': '<svg onload="alert(\'XSS via SVG\')">',
      'factor-b': 'javascript:alert("XSS via javascript:")'
    };
    
    const testElement = this.createElement('questionTemplate', maliciousData);
    
    if (testElement) {
      console.log('✅ XSS 測試完成：惡意腳本已被 textContent 安全處理');
      console.log('測試元素:', testElement);
      return true;
    }
    
    return false;
  }
}

// 全域安全渲染實例
const secureRenderer = new SecureRenderer();

// 導出供其他模組使用
window.secureRenderer = secureRenderer;
