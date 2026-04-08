/**
 * RWAV Workshop OCR Engine
 * UID-based sticky note detection and column position recognition
 * Uses Tesseract.js for optical character recognition
 * Australian English spelling throughout
 */

class OCREngine {
  constructor() {
    this.tesseractWorker = null;
    this.initialized = false;
    
    // UID patterns for each pillar
    this.uidPatterns = {
      doers: /D[1-9]/gi,      // D1, D2, D3, etc.
      drivers: /R[1-9]/gi,     // R1, R2, R3, etc.
      enablers: /E[1-9]/gi     // E1, E2, E3, etc.
    };
    
    // Column detection thresholds (percentage of image width)
    this.columnThresholds = {
      high: { min: 0, max: 0.33 },      // Left third
      medium: { min: 0.33, max: 0.67 }, // Middle third
      low: { min: 0.67, max: 1.0 }      // Right third
    };
  }
  
  /**
   * Initialize Tesseract.js worker
   */
  async initialize() {
    try {
      // Create Tesseract worker
      this.tesseractWorker = await Tesseract.createWorker({
        logger: (m) => {
          // Log progress for debugging
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      // Load English language
      await this.tesseractWorker.loadLanguage('eng');
      await this.tesseractWorker.initialize('eng');
      
      // Set parameters for better UID recognition
      await this.tesseractWorker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', // Only uppercase letters and numbers
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT // Sparse text mode for sticky notes
      });
      
      this.initialized = true;
      
      return {
        success: true,
        message: 'OCR Engine initialized successfully'
      };
      
    } catch (error) {
      console.error('OCR initialization error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Process workshop photo and extract UIDs with positions
   */
  async processWorkshopPhoto(imageDataUrl, pillarType = 'auto') {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Perform OCR on the image
      const result = await this.tesseractWorker.recognize(imageDataUrl);
      
      // Extract text and bounding boxes
      const { data } = result;
      
      // Detect pillar type from QR code or text if auto
      if (pillarType === 'auto') {
        pillarType = this.detectPillarType(data.text);
      }
      
      // Extract UIDs and their positions
      const detectedUIDs = this.extractUIDs(data, pillarType);
      
      // Categorise UIDs by column position
      const categorisedUIDs = this.categoriseByColumn(detectedUIDs, data);
      
      // Map UIDs to initiative names
      const initiatives = this.mapUIDsToInitiatives(categorisedUIDs, pillarType);
      
      return {
        success: true,
        pillar: pillarType,
        rawText: data.text,
        detectedUIDs: detectedUIDs,
        priorities: initiatives,
        confidence: this.calculateConfidence(detectedUIDs)
      };
      
    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Detect pillar type from image text
   */
  detectPillarType(text) {
    const textLower = text.toLowerCase();
    
    if (textLower.includes('doers') || textLower.includes('frontline impact')) {
      return 'doers';
    } else if (textLower.includes('drivers') || textLower.includes('systems change')) {
      return 'drivers';
    } else if (textLower.includes('enablers') || textLower.includes('sustainability')) {
      return 'enablers';
    }
    
    // Default to doers if can't detect
    return 'doers';
  }
  
  /**
   * Extract UIDs from OCR data
   */
  extractUIDs(ocrData, pillarType) {
    const pattern = this.uidPatterns[pillarType];
    const detectedUIDs = [];
    
    // Search through all text words
    ocrData.words.forEach(word => {
      const matches = word.text.match(pattern);
      
      if (matches) {
        matches.forEach(uid => {
          detectedUIDs.push({
            uid: uid.toUpperCase(),
            text: word.text,
            bbox: word.bbox,
            confidence: word.confidence
          });
        });
      }
    });
    
    return detectedUIDs;
  }
  
  /**
   * Categorise UIDs by column position (HIGH/MEDIUM/LOW)
   */
  categoriseByColumn(detectedUIDs, ocrData) {
    const imageWidth = ocrData.imageWidth || 1000; // Default if not available
    
    const categorised = {
      high: [],
      medium: [],
      low: []
    };
    
    detectedUIDs.forEach(uidData => {
      // Calculate center X position of the UID
      const centerX = (uidData.bbox.x0 + uidData.bbox.x1) / 2;
      const relativeX = centerX / imageWidth;
      
      // Determine column based on position
      if (relativeX >= this.columnThresholds.high.min && relativeX < this.columnThresholds.high.max) {
        categorised.high.push(uidData);
      } else if (relativeX >= this.columnThresholds.medium.min && relativeX < this.columnThresholds.medium.max) {
        categorised.medium.push(uidData);
      } else if (relativeX >= this.columnThresholds.low.min && relativeX <= this.columnThresholds.low.max) {
        categorised.low.push(uidData);
      }
    });
    
    return categorised;
  }
  
  /**
   * Map UIDs to initiative names
   */
  mapUIDsToInitiatives(categorisedUIDs, pillarType) {
    const initiativeMap = this.getInitiativeMap(pillarType);
    
    const priorities = {
      high: [],
      medium: [],
      low: []
    };
    
    // Map each priority level
    Object.keys(categorisedUIDs).forEach(priority => {
      categorisedUIDs[priority].forEach(uidData => {
        const initiativeName = initiativeMap[uidData.uid] || `Unknown Initiative (${uidData.uid})`;
        
        priorities[priority].push({
          uid: uidData.uid,
          name: initiativeName,
          confidence: uidData.confidence
        });
      });
    });
    
    return priorities;
  }
  
  /**
   * Get initiative map for pillar
   */
  getInitiativeMap(pillarType) {
    const maps = {
      doers: {
        'D1': 'Retention Excellence Hubs',
        'D2': 'Community Map Platform',
        'D3': 'Cultural Safety Integration',
        'D4': 'Rural Health Innovation Partnerships'
      },
      drivers: {
        'R1': 'Rural Health Coalition Leadership',
        'R2': 'Evidence-Based Policy Advocacy',
        'R3': 'Multi-Regional Coordination',
        'R4': 'Innovation Facilitation'
      },
      enablers: {
        'E1': 'Revenue Diversification',
        'E2': 'Data Intelligence Capability',
        'E3': 'Partnership Infrastructure',
        'E4': 'Cultural Transformation'
      }
    };
    
    return maps[pillarType] || {};
  }
  
  /**
   * Calculate overall confidence score
   */
  calculateConfidence(detectedUIDs) {
    if (detectedUIDs.length === 0) {
      return 0;
    }
    
    const totalConfidence = detectedUIDs.reduce((sum, uid) => sum + uid.confidence, 0);
    return Math.round(totalConfidence / detectedUIDs.length);
  }
  
  /**
   * Process multiple photos (batch processing)
   */
  async processBatch(photos) {
    const results = [];
    
    for (const photo of photos) {
      const result = await this.processWorkshopPhoto(photo.dataUrl, photo.pillarType || 'auto');
      results.push({
        photoId: photo.id,
        ...result
      });
    }
    
    return results;
  }
  
  /**
   * Validate extracted priorities (check for errors)
   */
  validatePriorities(priorities) {
    const warnings = [];
    
    // Check if any UIDs are duplicated across priority levels
    const allUIDs = [
      ...priorities.high.map(p => p.uid),
      ...priorities.medium.map(p => p.uid),
      ...priorities.low.map(p => p.uid)
    ];
    
    const duplicates = allUIDs.filter((uid, index) => allUIDs.indexOf(uid) !== index);
    
    if (duplicates.length > 0) {
      warnings.push({
        type: 'duplicate',
        message: `Duplicate UIDs detected: ${duplicates.join(', ')}`,
        severity: 'high'
      });
    }
    
    // Check if confidence is low
    const lowConfidenceItems = [
      ...priorities.high,
      ...priorities.medium,
      ...priorities.low
    ].filter(p => p.confidence < 70);
    
    if (lowConfidenceItems.length > 0) {
      warnings.push({
        type: 'low_confidence',
        message: `${lowConfidenceItems.length} items have low confidence (<70%). Please review manually.`,
        severity: 'medium',
        items: lowConfidenceItems
      });
    }
    
    return {
      valid: warnings.filter(w => w.severity === 'high').length === 0,
      warnings: warnings
    };
  }
  
  /**
   * Export OCR results for review
   */
  exportResults(results) {
    return {
      timestamp: new Date().toISOString(),
      results: results,
      summary: {
        totalPhotos: results.length,
        totalUIDs: results.reduce((sum, r) => {
          return sum + (r.priorities?.high?.length || 0) + 
                       (r.priorities?.medium?.length || 0) + 
                       (r.priorities?.low?.length || 0);
        }, 0)
      }
    };
  }
  
  /**
   * Clean up resources
   */
  async destroy() {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
      this.initialized = false;
    }
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OCREngine;
}
