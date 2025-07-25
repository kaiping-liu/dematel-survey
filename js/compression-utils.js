// Phase 5: 壓縮分段與資料完整性工具
// 統一壓縮介面，支援 LZ-String 和 Pako，自動 QR 分段

class CompressionUtils {
  constructor() {
    this.maxQRLength = 2900; // QR Code 安全容量
    this.useLZString = true;  // 預設使用 LZ-String (輕量級)
  }

  // 壓縮資料
  compress(data) {
    try {
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
      
      if (this.useLZString && window.LZString) {
        console.log('=== Phase 5: 使用 LZ-String 壓縮 ===');
        return LZString.compressToBase64(jsonString);
      } else if (window.pako) {
        console.log('=== Phase 5: 使用 Pako 壓縮 ===');
        const compressed = pako.deflate(jsonString, { to: 'string' });
        return btoa(compressed);
      } else {
        console.warn('無可用壓縮庫，返回原始資料');
        return btoa(unescape(encodeURIComponent(jsonString)));
      }
    } catch (error) {
      console.error('壓縮失敗:', error);
      throw new Error('資料壓縮失敗: ' + error.message);
    }
  }

  // 解壓縮資料
  decompress(compressedData) {
    try {
      if (this.useLZString && window.LZString) {
        console.log('=== Phase 5: 使用 LZ-String 解壓縮 ===');
        return LZString.decompressFromBase64(compressedData);
      } else if (window.pako) {
        console.log('=== Phase 5: 使用 Pako 解壓縮 ===');
        const binaryString = atob(compressedData);
        const decompressed = pako.inflate(binaryString, { to: 'string' });
        return decompressed;
      } else {
        console.warn('無可用壓縮庫，嘗試直接解碼');
        return decodeURIComponent(escape(atob(compressedData)));
      }
    } catch (error) {
      console.error('解壓縮失敗:', error);
      throw new Error('資料解壓縮失敗: ' + error.message);
    }
  }

  // 計算資料的 MD5 校驗和
  calculateChecksum(data) {
    try {
      if (!window.SparkMD5) {
        console.warn('SparkMD5 不可用，跳過校驗和計算');
        return null;
      }
      
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
      return SparkMD5.hash(jsonString);
    } catch (error) {
      console.error('校驗和計算失敗:', error);
      return null;
    }
  }

  // 分段處理長字串
  splitIntoSegments(data) {
    const segments = [];
    const segmentSize = this.maxQRLength;
    
    for (let i = 0; i < data.length; i += segmentSize) {
      segments.push(data.slice(i, i + segmentSize));
    }
    
    console.log(`=== Phase 5: 分段處理 ===`);
    console.log(`原始長度: ${data.length} bytes`);
    console.log(`分段數量: ${segments.length}`);
    console.log(`每段大小: ≤ ${segmentSize} bytes`);
    
    return segments;
  }

  // 組合分段資料
  combineSegments(segments) {
    if (!Array.isArray(segments)) {
      throw new Error('segments 必須是陣列');
    }
    
    console.log(`=== Phase 5: 組合分段 ===`);
    console.log(`分段數量: ${segments.length}`);
    
    return segments.join('');
  }

  // 完整的壓縮和分段流程
  compressAndSegment(data) {
    try {
      // 1. 計算原始資料校驗和
      const originalChecksum = this.calculateChecksum(data);
      
      // 2. 在資料中加入校驗和
      const dataWithChecksum = {
        ...data,
        _metadata: {
          checksum: originalChecksum,
          timestamp: new Date().toISOString(),
          version: '1.0',
          compression: this.useLZString ? 'lz-string' : 'pako'
        }
      };
      
      // 3. 壓縮資料
      const compressed = this.compress(dataWithChecksum);
      
      // 4. 檢查是否需要分段
      if (compressed.length <= this.maxQRLength) {
        console.log(`=== Phase 5: 資料無需分段 ===`);
        console.log(`壓縮後大小: ${compressed.length} bytes`);
        return {
          segments: [compressed],
          totalSegments: 1,
          checksum: originalChecksum,
          needsSegmentation: false
        };
      }
      
      // 5. 分段處理
      const segments = this.splitIntoSegments(compressed);
      
      // 6. 檢查分段數量是否過多
      if (segments.length > 10) {
        console.warn('分段數量過多，建議簡化問卷內容');
      }
      
      return {
        segments: segments,
        totalSegments: segments.length,
        checksum: originalChecksum,
        needsSegmentation: true
      };
      
    } catch (error) {
      console.error('壓縮分段流程失敗:', error);
      throw error;
    }
  }

  // 完整的組合和解壓縮流程
  combineAndDecompress(segments) {
    try {
      console.log(`=== Phase 5: 開始組合解壓縮流程 ===`);
      
      // 1. 組合分段
      const combined = this.combineSegments(segments);
      
      // 2. 解壓縮
      const decompressed = this.decompress(combined);
      const data = JSON.parse(decompressed);
      
      // 3. 驗證校驗和
      if (data._metadata && data._metadata.checksum) {
        const { _metadata, ...originalData } = data;
        const calculatedChecksum = this.calculateChecksum(originalData);
        
        if (calculatedChecksum !== _metadata.checksum) {
          console.error('校驗和不符:', {
            original: _metadata.checksum,
            calculated: calculatedChecksum
          });
          throw new Error('資料完整性驗證失敗');
        }
        
        console.log('=== Phase 5: 資料完整性驗證通過 ===');
        console.log('壓縮方式:', _metadata.compression);
        console.log('時間戳記:', _metadata.timestamp);
        
        return originalData;
      }
      
      console.warn('無校驗和資訊，跳過完整性驗證');
      return data;
      
    } catch (error) {
      console.error('組合解壓縮流程失敗:', error);
      throw error;
    }
  }

  // 效能測試
  performanceTest(testData) {
    console.log('=== Phase 5: 壓縮效能測試 ===');
    
    const originalSize = JSON.stringify(testData).length;
    console.log(`原始大小: ${originalSize} bytes`);
    
    // 測試 LZ-String
    if (window.LZString) {
      const startTime = performance.now();
      this.useLZString = true;
      const lzCompressed = this.compress(testData);
      const lzTime = performance.now() - startTime;
      
      console.log(`LZ-String: ${lzCompressed.length} bytes (${Math.round((1 - lzCompressed.length/originalSize) * 100)}% 壓縮) - ${lzTime.toFixed(2)}ms`);
    }
    
    // 測試 Pako
    if (window.pako) {
      const startTime = performance.now();
      this.useLZString = false;
      const pakoCompressed = this.compress(testData);
      const pakoTime = performance.now() - startTime;
      
      console.log(`Pako: ${pakoCompressed.length} bytes (${Math.round((1 - pakoCompressed.length/originalSize) * 100)}% 壓縮) - ${pakoTime.toFixed(2)}ms`);
    }
    
    // 恢復預設
    this.useLZString = true;
  }
}

// 建立全域實例
window.compressionUtils = new CompressionUtils();

// Phase 5: 向後相容的 API
window.compressData = function(data) {
  return window.compressionUtils.compress(data);
};

window.decompressData = function(compressedData) {
  return window.compressionUtils.decompress(compressedData);
};

console.log('=== Phase 5: 壓縮分段工具已初始化 ===');
