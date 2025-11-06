/**
 * RWAV Workshop QR Code Photo Upload System
 * Facilitator uploads photos from phone to laptop via QR code
 * Australian English spelling throughout
 */

class QRUploadSystem {
  constructor() {
    this.uploadEndpoint = null;
    this.qrCode = null;
    this.uploadedPhotos = [];
    this.websocket = null;
    this.sessionId = this.generateSessionId();
  }
  
  /**
   * Generate unique session ID for this workshop
   */
  generateSessionId() {
    return 'rwav-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
  
  /**
   * Initialize QR upload system
   * Creates a local upload endpoint and generates QR code
   */
  async initialize() {
    try {
      // Create upload endpoint URL (using current page URL + session ID)
      const baseUrl = window.location.origin + window.location.pathname;
      this.uploadEndpoint = `${baseUrl}?upload=${this.sessionId}`;
      
      // Generate QR code
      await this.generateQRCode();
      
      // Set up photo receiver (using localStorage for simple implementation)
      this.setupPhotoReceiver();
      
      return {
        success: true,
        sessionId: this.sessionId,
        uploadUrl: this.uploadEndpoint
      };
      
    } catch (error) {
      console.error('QR Upload initialization error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Generate QR code for upload URL
   */
  async generateQRCode() {
    return new Promise((resolve, reject) => {
      const qrContainer = document.getElementById('qr-code-container');
      
      if (!qrContainer) {
        reject(new Error('QR code container not found'));
        return;
      }
      
      // Clear existing QR code
      qrContainer.innerHTML = '';
      
      // Generate new QR code using QRCode.js library
      try {
        this.qrCode = new QRCode(qrContainer, {
          text: this.uploadEndpoint,
          width: 256,
          height: 256,
          colorDark: '#0c558c', // RWAV Blue
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Set up photo receiver using localStorage and polling
   * (Simple implementation - in production, use WebSockets or WebRTC)
   */
  setupPhotoReceiver() {
    // Check for uploaded photos every 2 seconds
    this.receiverInterval = setInterval(() => {
      this.checkForNewPhotos();
    }, 2000);
    
    // Also listen for storage events (works across tabs)
    window.addEventListener('storage', (e) => {
      if (e.key === `rwav-upload-${this.sessionId}`) {
        this.processUploadedPhoto(e.newValue);
      }
    });
  }
  
  /**
   * Check localStorage for new photos
   */
  checkForNewPhotos() {
    const uploadKey = `rwav-upload-${this.sessionId}`;
    const photoData = localStorage.getItem(uploadKey);
    
    if (photoData) {
      this.processUploadedPhoto(photoData);
      // Clear after processing
      localStorage.removeItem(uploadKey);
    }
  }
  
  /**
   * Process uploaded photo
   */
  processUploadedPhoto(photoDataUrl) {
    try {
      const photo = {
        id: 'photo-' + Date.now(),
        dataUrl: photoDataUrl,
        timestamp: new Date().toISOString(),
        processed: false
      };
      
      this.uploadedPhotos.push(photo);
      
      // Trigger custom event for app to handle
      const event = new CustomEvent('photoUploaded', {
        detail: photo
      });
      window.dispatchEvent(event);
      
      // Show notification
      this.showNotification('Photo uploaded successfully!');
      
    } catch (error) {
      console.error('Photo processing error:', error);
      this.showNotification('Error processing photo', 'error');
    }
  }
  
  /**
   * Display QR code in modal for scanning
   */
  showQRCodeModal() {
    const modal = document.getElementById('qr-upload-modal');
    if (!modal) {
      this.createQRCodeModal();
    }
    
    const modal2 = document.getElementById('qr-upload-modal');
    modal2.style.display = 'flex';
    
    // Update instructions
    const instructions = document.getElementById('qr-instructions');
    if (instructions) {
      instructions.innerHTML = `
        <h3>Upload Workshop Photos</h3>
        <ol>
          <li>Open camera app on your phone</li>
          <li>Scan this QR code</li>
          <li>Select photos from your camera roll</li>
          <li>Photos will appear here automatically</li>
        </ol>
        <p class="session-id">Session ID: ${this.sessionId}</p>
      `;
    }
  }
  
  /**
   * Create QR code modal if it doesn't exist
   */
  createQRCodeModal() {
    const modal = document.createElement('div');
    modal.id = 'qr-upload-modal';
    modal.className = 'qr-modal';
    modal.innerHTML = `
      <div class="qr-modal-content">
        <button class="qr-modal-close" onclick="qrUploadSystem.hideQRCodeModal()">&times;</button>
        <div id="qr-instructions"></div>
        <div id="qr-code-container" class="qr-code-display"></div>
        <div class="qr-alternative">
          <p>Or manually upload photos:</p>
          <input type="file" id="manual-photo-upload" accept="image/*" multiple>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up manual upload handler
    const fileInput = modal.querySelector('#manual-photo-upload');
    fileInput.addEventListener('change', (e) => {
      this.handleManualUpload(e.target.files);
    });
  }
  
  /**
   * Hide QR code modal
   */
  hideQRCodeModal() {
    const modal = document.getElementById('qr-upload-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
  
  /**
   * Handle manual file upload (fallback)
   */
  async handleManualUpload(files) {
    for (const file of files) {
      try {
        const dataUrl = await this.fileToDataUrl(file);
        this.processUploadedPhoto(dataUrl);
      } catch (error) {
        console.error('Manual upload error:', error);
        this.showNotification('Error uploading file: ' + file.name, 'error');
      }
    }
  }
  
  /**
   * Convert file to data URL
   */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Get all uploaded photos
   */
  getUploadedPhotos() {
    return this.uploadedPhotos;
  }
  
  /**
   * Clear uploaded photos
   */
  clearUploadedPhotos() {
    this.uploadedPhotos = [];
  }
  
  /**
   * Mark photo as processed
   */
  markPhotoProcessed(photoId) {
    const photo = this.uploadedPhotos.find(p => p.id === photoId);
    if (photo) {
      photo.processed = true;
    }
  }
  
  /**
   * Show notification to user
   */
  showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.add('notification-show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('notification-show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.receiverInterval) {
      clearInterval(this.receiverInterval);
    }
    
    // Clear localStorage
    localStorage.removeItem(`rwav-upload-${this.sessionId}`);
  }
}

/**
 * QR Upload Page Handler
 * This runs on the upload page (opened from QR code scan)
 */
class QRUploadPage {
  constructor() {
    this.sessionId = this.getSessionIdFromUrl();
  }
  
  /**
   * Get session ID from URL parameter
   */
  getSessionIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('upload');
  }
  
  /**
   * Initialize upload page
   */
  initialize() {
    if (!this.sessionId) {
      this.showError('Invalid upload session');
      return;
    }
    
    this.createUploadInterface();
  }
  
  /**
   * Create upload interface
   */
  createUploadInterface() {
    document.body.innerHTML = `
      <div class="upload-page">
        <div class="upload-header">
          <img src="assets/images/rwav-logo.png" alt="RWAV" class="upload-logo">
          <h1>Workshop Photo Upload</h1>
          <p>Session: ${this.sessionId}</p>
        </div>
        
        <div class="upload-area">
          <input type="file" id="photo-input" accept="image/*" multiple capture="environment">
          <label for="photo-input" class="upload-button">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span>Select Photos</span>
          </label>
        </div>
        
        <div id="upload-status" class="upload-status"></div>
        
        <div class="upload-instructions">
          <h3>Instructions:</h3>
          <ol>
            <li>Tap "Select Photos" button above</li>
            <li>Choose photos of workshop posters/boards</li>
            <li>Photos will be sent to facilitator's laptop automatically</li>
            <li>You can close this page when done</li>
          </ol>
        </div>
      </div>
    `;
    
    // Set up file input handler
    const fileInput = document.getElementById('photo-input');
    fileInput.addEventListener('change', (e) => {
      this.handlePhotoSelection(e.target.files);
    });
  }
  
  /**
   * Handle photo selection
   */
  async handlePhotoSelection(files) {
    const statusDiv = document.getElementById('upload-status');
    statusDiv.innerHTML = '<p>Uploading photos...</p>';
    
    for (const file of files) {
      try {
        const dataUrl = await this.fileToDataUrl(file);
        await this.sendPhoto(dataUrl);
        statusDiv.innerHTML += `<p class="success">✓ ${file.name} uploaded</p>`;
      } catch (error) {
        console.error('Upload error:', error);
        statusDiv.innerHTML += `<p class="error">✗ ${file.name} failed</p>`;
      }
    }
    
    statusDiv.innerHTML += '<p class="complete">All photos uploaded! You can close this page.</p>';
  }
  
  /**
   * Convert file to data URL
   */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Send photo to facilitator's laptop via localStorage
   */
  async sendPhoto(dataUrl) {
    return new Promise((resolve) => {
      const uploadKey = `rwav-upload-${this.sessionId}`;
      localStorage.setItem(uploadKey, dataUrl);
      
      // Wait a bit to ensure it's saved
      setTimeout(resolve, 500);
    });
  }
  
  /**
   * Show error message
   */
  showError(message) {
    document.body.innerHTML = `
      <div class="upload-error">
        <h1>Upload Error</h1>
        <p>${message}</p>
        <p>Please scan the QR code again or contact the facilitator.</p>
      </div>
    `;
  }
}

// Initialize based on context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QRUploadSystem, QRUploadPage };
}
