/**
 * RWAV Workshop Facilitator Interface
 * Control panel for running the workshop
 * Projection-optimised display mode
 * Australian English spelling throughout
 */

import { DecisionEngine, ImpactDashboard } from './decision-engine.js';
import { QRUploadSystem } from './qr-upload.js';
import { OCREngine } from './ocr-engine.js';
import { RWAVChatbot } from './ai-chatbot.js';

class FacilitatorInterface {
  constructor() {
    this.decisionEngine = new DecisionEngine();
    this.qrUpload = new QRUploadSystem();
    this.ocrEngine = new OCREngine();
    this.chatbot = null;
    
    this.mode = 'setup'; // setup, workshop, review
    this.currentPhase = null;
    this.projectionMode = false;
  }
  
  /**
   * Initialize facilitator interface
   */
  async initialize() {
    try {
      // Initialize all systems
      await this.decisionEngine.initialize();
      await this.qrUpload.initialize();
      await this.ocrEngine.initialize();
      
      // Initialize chatbot if API key available
      const apiKey = localStorage.getItem('openai_api_key');
      if (apiKey) {
        // Load strategic data
        const strategicData = await this.loadStrategicData();
        this.chatbot = new RWAVChatbot(strategicData);
        await this.chatbot.initialize();
      }
      
      // Set up UI
      this.setupUI();
      this.setupEventListeners();
      
      return {
        success: true,
        message: 'Facilitator interface initialized'
      };
      
    } catch (error) {
      console.error('Facilitator interface initialization error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Load strategic data from JSON
   */
  async loadStrategicData() {
    try {
      const response = await fetch('./js/data/rwav-strategic-data.json');
      return await response.json();
    } catch (error) {
      console.error('Error loading strategic data:', error);
      return {};
    }
  }
  
  /**
   * Set up facilitator UI
   */
  setupUI() {
    const container = document.getElementById('facilitator-interface');
    if (!container) return;
    
    container.innerHTML = `
      <div class="facilitator-container">
        <!-- Header with mode controls -->
        <div class="facilitator-header">
          <div class="facilitator-logo">
            <img src="assets/images/rwav-logo.png" alt="RWAV">
            <h1>Workshop Facilitator</h1>
          </div>
          
          <div class="facilitator-controls">
            <button id="toggle-projection" class="btn-projection">
              <span class="icon">📺</span>
              <span class="label">Projection Mode</span>
            </button>
            
            <button id="show-qr-upload" class="btn-upload">
              <span class="icon">📸</span>
              <span class="label">Upload Photos</span>
            </button>
            
            <button id="toggle-chatbot" class="btn-chatbot">
              <span class="icon">💬</span>
              <span class="label">AI Assistant</span>
            </button>
            
            <button id="export-decisions" class="btn-export">
              <span class="icon">📄</span>
              <span class="label">Export Strategy</span>
            </button>
          </div>
        </div>
        
        <!-- Main workspace -->
        <div class="facilitator-workspace">
          <!-- Left panel: Decision controls -->
          <div class="facilitator-panel facilitator-decisions">
            <h2>Workshop Decisions</h2>
            <div id="decision-controls"></div>
          </div>
          
          <!-- Center panel: Impact dashboard -->
          <div class="facilitator-panel facilitator-impact">
            <h2>Real-Time Impact Analysis</h2>
            <div id="impact-dashboard"></div>
          </div>
          
          <!-- Right panel: Workshop progress -->
          <div class="facilitator-panel facilitator-progress">
            <h2>Workshop Progress</h2>
            <div id="workshop-progress"></div>
          </div>
        </div>
        
        <!-- Photo processing panel (hidden by default) -->
        <div id="photo-processing-panel" class="photo-panel" style="display: none;">
          <div class="photo-panel-header">
            <h3>Photo Processing</h3>
            <button id="close-photo-panel" class="btn-close">&times;</button>
          </div>
          <div id="photo-processing-content"></div>
        </div>
        
        <!-- Chatbot panel (hidden by default) -->
        <div id="chatbot-panel" class="chatbot-panel" style="display: none;">
          <div class="chatbot-header">
            <h3>AI Strategic Advisor</h3>
            <button id="close-chatbot-panel" class="btn-close">&times;</button>
          </div>
          <div id="chatbot-messages" class="chatbot-messages"></div>
          <div class="chatbot-input">
            <input type="text" id="chatbot-input-field" placeholder="Ask a question about the strategic plan...">
            <button id="send-chatbot-message" class="btn-send">Send</button>
          </div>
        </div>
      </div>
    `;
    
    // Render initial state
    this.renderDecisionControls();
    this.renderImpactDashboard();
    this.renderWorkshopProgress();
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Projection mode toggle
    document.getElementById('toggle-projection')?.addEventListener('click', () => {
      this.toggleProjectionMode();
    });
    
    // QR upload
    document.getElementById('show-qr-upload')?.addEventListener('click', () => {
      this.qrUpload.showQRCodeModal();
    });
    
    // Chatbot toggle
    document.getElementById('toggle-chatbot')?.addEventListener('click', () => {
      this.toggleChatbot();
    });
    
    // Export decisions
    document.getElementById('export-decisions')?.addEventListener('click', () => {
      this.exportDecisions();
    });
    
    // Photo upload event
    window.addEventListener('photoUploaded', (e) => {
      this.handlePhotoUpload(e.detail);
    });
    
    // Chatbot send message
    document.getElementById('send-chatbot-message')?.addEventListener('click', () => {
      this.sendChatbotMessage();
    });
    
    document.getElementById('chatbot-input-field')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendChatbotMessage();
      }
    });
  }
  
  /**
   * Render decision controls
   */
  renderDecisionControls() {
    const container = document.getElementById('decision-controls');
    if (!container) return;
    
    const categories = this.decisionEngine.initialize().categories;
    
    let html = '<div class="decision-categories">';
    
    Object.values(categories).forEach(category => {
      html += `
        <div class="decision-category" data-category="${category.id}">
          <h3>${category.title}</h3>
          <p class="decision-description">${category.description}</p>
          
          <div class="decision-options">
            ${category.options.map(option => `
              <label class="decision-option">
                <input type="radio" 
                       name="${category.id}" 
                       value="${option.id}"
                       data-category="${category.id}"
                       data-option="${option.id}">
                <span class="option-label">${option.label}</span>
                <span class="option-impact impact-${option.impact}">${option.impact}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Add change listeners
    container.querySelectorAll('input[type="radio"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const categoryId = e.target.dataset.category;
        const optionId = e.target.dataset.option;
        this.makeDecision(categoryId, optionId);
      });
    });
  }
  
  /**
   * Make a decision
   */
  makeDecision(categoryId, optionId) {
    const result = this.decisionEngine.makeDecision(categoryId, optionId);
    
    if (result.success) {
      // Update impact dashboard
      this.renderImpactDashboard();
      this.renderWorkshopProgress();
      
      // Show notification
      this.showNotification(`Decision recorded: ${result.decision.category}`, 'success');
    } else {
      this.showNotification(result.error, 'error');
    }
  }
  
  /**
   * Render impact dashboard
   */
  renderImpactDashboard() {
    const container = document.getElementById('impact-dashboard');
    if (!container) return;
    
    const dashboard = new ImpactDashboard(container);
    dashboard.connect(this.decisionEngine);
  }
  
  /**
   * Render workshop progress
   */
  renderWorkshopProgress() {
    const container = document.getElementById('workshop-progress');
    if (!container) return;
    
    const summary = this.decisionEngine.getDecisionSummary();
    const validation = this.decisionEngine.validateDecisions();
    
    container.innerHTML = `
      <div class="progress-summary">
        <div class="progress-stat">
          <div class="stat-value">${summary.decisions.length}</div>
          <div class="stat-label">Decisions Made</div>
        </div>
        
        <div class="progress-stat">
          <div class="stat-value">${validation.completeness}%</div>
          <div class="stat-label">Complete</div>
        </div>
        
        <div class="progress-stat">
          <div class="stat-value">${summary.totalScore}</div>
          <div class="stat-label">Overall Score</div>
        </div>
      </div>
      
      ${summary.undecided.length > 0 ? `
        <div class="progress-undecided">
          <h4>Pending Decisions:</h4>
          <ul>
            ${summary.undecided.map(title => `<li>${title}</li>`).join('')}
          </ul>
        </div>
      ` : '<div class="progress-complete">✓ All decisions complete!</div>'}
      
      ${validation.warnings.length > 0 ? `
        <div class="progress-warnings">
          <h4>Warnings:</h4>
          <ul>
            ${validation.warnings.map(w => `<li class="warning-${w.severity}">${w.message}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  }
  
  /**
   * Toggle projection mode
   */
  toggleProjectionMode() {
    this.projectionMode = !this.projectionMode;
    
    const body = document.body;
    if (this.projectionMode) {
      body.classList.add('projection-mode');
      this.showNotification('Projection mode enabled', 'info');
    } else {
      body.classList.remove('projection-mode');
      this.showNotification('Projection mode disabled', 'info');
    }
  }
  
  /**
   * Handle photo upload
   */
  async handlePhotoUpload(photo) {
    // Show photo processing panel
    const panel = document.getElementById('photo-processing-panel');
    panel.style.display = 'block';
    
    const content = document.getElementById('photo-processing-content');
    content.innerHTML = `
      <div class="photo-processing">
        <img src="${photo.dataUrl}" alt="Workshop photo" class="photo-preview">
        <div class="processing-status">
          <p>Processing photo with OCR...</p>
          <div class="spinner"></div>
        </div>
      </div>
    `;
    
    // Process with OCR
    try {
      const result = await this.ocrEngine.processWorkshopPhoto(photo.dataUrl);
      
      if (result.success) {
        this.displayOCRResults(result);
      } else {
        content.innerHTML += `<div class="error">OCR failed: ${result.error}</div>`;
      }
    } catch (error) {
      content.innerHTML += `<div class="error">Error processing photo: ${error.message}</div>`;
    }
  }
  
  /**
   * Display OCR results for confirmation
   */
  displayOCRResults(result) {
    const content = document.getElementById('photo-processing-content');
    
    content.innerHTML = `
      <div class="ocr-results">
        <h4>Detected Priorities - ${result.pillar.toUpperCase()}</h4>
        <p class="confidence">Confidence: ${result.confidence}%</p>
        
        <div class="priorities-grid">
          ${['high', 'medium', 'low'].map(priority => `
            <div class="priority-column priority-${priority}">
              <h5>${priority.toUpperCase()}</h5>
              <ul>
                ${result.priorities[priority].map(item => `
                  <li>
                    <span class="uid">${item.uid}</span>
                    <span class="name">${item.name}</span>
                    <span class="confidence">${Math.round(item.confidence)}%</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
        
        <div class="ocr-actions">
          <button id="confirm-ocr" class="btn-primary">Confirm & Apply</button>
          <button id="edit-ocr" class="btn-secondary">Edit Results</button>
          <button id="cancel-ocr" class="btn-secondary">Cancel</button>
        </div>
      </div>
    `;
    
    // Add event listeners
    document.getElementById('confirm-ocr')?.addEventListener('click', () => {
      this.applyOCRResults(result);
    });
    
    document.getElementById('cancel-ocr')?.addEventListener('click', () => {
      document.getElementById('photo-processing-panel').style.display = 'none';
    });
  }
  
  /**
   * Apply OCR results to decision engine
   */
  applyOCRResults(result) {
    // Store OCR results
    localStorage.setItem('ocr-results-' + result.pillar, JSON.stringify(result.priorities));
    
    this.showNotification(`Priorities recorded for ${result.pillar.toUpperCase()} pillar`, 'success');
    document.getElementById('photo-processing-panel').style.display = 'none';
  }
  
  /**
   * Toggle chatbot panel
   */
  toggleChatbot() {
    const panel = document.getElementById('chatbot-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    
    if (panel.style.display === 'block' && !this.chatbot) {
      this.showNotification('AI Chatbot not available (API key not configured)', 'warning');
    }
  }
  
  /**
   * Send message to chatbot
   */
  async sendChatbotMessage() {
    const input = document.getElementById('chatbot-input-field');
    const message = input.value.trim();
    
    if (!message || !this.chatbot) return;
    
    // Add user message to chat
    this.addChatMessage('user', message);
    input.value = '';
    
    // Show typing indicator
    this.addChatMessage('assistant', '...', true);
    
    // Send to chatbot
    const response = await this.chatbot.sendMessage(message, {
      webSearch: true,
      swotAnalysis: true
    });
    
    // Remove typing indicator
    const messages = document.getElementById('chatbot-messages');
    const typingIndicator = messages.querySelector('.message-typing');
    if (typingIndicator) {
      typingIndicator.remove();
    }
    
    // Add assistant response
    if (response.success) {
      this.addChatMessage('assistant', response.message);
    } else {
      this.addChatMessage('assistant', response.fallback?.message || 'Error: ' + response.error);
    }
  }
  
  /**
   * Add message to chat
   */
  addChatMessage(role, content, isTyping = false) {
    const messages = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message message-${role}${isTyping ? ' message-typing' : ''}`;
    messageDiv.textContent = content;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
  }
  
  /**
   * Export decisions
   */
  async exportDecisions() {
    const validation = this.decisionEngine.validateDecisions();
    
    if (!validation.valid) {
      const proceed = confirm('Not all critical decisions have been made. Export anyway?');
      if (!proceed) return;
    }
    
    // Export decisions
    const exportData = this.decisionEngine.exportDecisions();
    
    // Generate PDF (placeholder - will implement full PDF generation)
    this.showNotification('Generating Board-approved strategy document...', 'info');
    
    // For now, download as JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RWAV-Strategy-Decisions-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    this.showNotification('Strategy decisions exported', 'success');
  }
  
  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('notification-show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('notification-show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FacilitatorInterface;
}

export default FacilitatorInterface;
