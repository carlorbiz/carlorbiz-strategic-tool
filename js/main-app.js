/**
 * RWAV Strategic Workshop PWA - Main Application
 * Integrates VERSION 1 (Static Briefing) and VERSION 2 (Workshop Tool)
 * Australian English spelling throughout
 */

import FacilitatorInterface from './facilitator-interface.js';
import { DecisionEngine, ImpactDashboard } from './decision-engine.js';

class RWAVWorkshopApp {
  constructor() {
    this.strategicData = null;
    this.chartData = null;
    this.currentView = 'version1';
    this.facilitatorInterface = null;
    this.decisionEngine = null;
    
    this.charts = {};
  }
  
  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Show loading overlay
      this.showLoading(true);
      
      // Load data
      await this.loadData();
      
      // Initialize components based on view
      this.setupNavigation();
      this.setupOnlineStatus();
      
      // Render VERSION 1 by default
      await this.renderVersion1();
      
      // Hide loading overlay
      this.showLoading(false);
      
      console.log('RWAV Workshop App initialized successfully');
      
    } catch (error) {
      console.error('App initialization error:', error);
      this.showError('Failed to initialize application: ' + error.message);
    }
  }
  
  /**
   * Load strategic data and chart configurations
   */
  async loadData() {
    try {
      // Load strategic data
      const dataResponse = await fetch('./js/data/rwav-strategic-data.json');
      this.strategicData = await dataResponse.json();
      
      // Load chart data
      const chartResponse = await fetch('./js/charts/rwav-chart-data.js');
      const chartModule = await import('./charts/rwav-chart-data.js');
      this.chartData = chartModule.default || chartModule;
      
      console.log('Data loaded successfully');
      
    } catch (error) {
      console.error('Data loading error:', error);
      throw new Error('Failed to load strategic plan data');
    }
  }
  
  /**
   * Set up navigation between views
   */
  setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchView(view);
        
        // Update active state
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }
  
  /**
   * Switch between views
   */
  async switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.app-view').forEach(view => {
      view.classList.remove('active');
    });
    
    // Show selected view
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.classList.add('active');
      this.currentView = viewName;
      
      // Initialize view-specific content
      if (viewName === 'version1' && !this.version1Rendered) {
        await this.renderVersion1();
        this.version1Rendered = true;
      } else if (viewName === 'version2' && !this.version2Rendered) {
        await this.renderVersion2();
        this.version2Rendered = true;
      } else if (viewName === 'facilitator' && !this.facilitatorInterface) {
        await this.renderFacilitator();
      }
    }
  }
  
  /**
   * Render VERSION 1: Static Intelligence Briefing
   */
  async renderVersion1() {
    if (!this.strategicData) return;
    
    // Executive Summary
    this.renderExecutiveSummary();
    
    // Evidence Base
    this.renderEvidenceBase();
    
    // Three Pillars
    this.renderThreePillars();
    
    // Pilot Program
    this.renderPilotProgram();
    
    // Financial Strategy
    this.renderFinancialStrategy();
    
    // Implementation Timeline
    this.renderImplementationTimeline();
  }
  
  /**
   * Render Executive Summary
   */
  renderExecutiveSummary() {
    const { executiveSummary } = this.strategicData;
    
    // Current State
    const currentStateEl = document.getElementById('current-state-content');
    if (currentStateEl) {
      currentStateEl.innerHTML = `<p>${executiveSummary.currentState}</p>`;
    }
    
    // Future Vision
    const futureVisionEl = document.getElementById('future-vision-content');
    if (futureVisionEl) {
      futureVisionEl.innerHTML = `<p>${executiveSummary.futureVision}</p>`;
    }
    
    // Required Decisions
    const decisionsEl = document.getElementById('required-decisions-content');
    if (decisionsEl && executiveSummary.requiredDecisions) {
      decisionsEl.innerHTML = `
        <ul class="decisions-list">
          ${executiveSummary.requiredDecisions.map(decision => `
            <li class="decision-item">${decision}</li>
          `).join('')}
        </ul>
      `;
    }
  }
  
  /**
   * Render Evidence Base (Survey Results)
   */
  renderEvidenceBase() {
    const { evidenceBase } = this.strategicData;
    
    // Survey Stats Cards
    const statsGrid = document.getElementById('survey-stats');
    if (statsGrid && evidenceBase.surveyStats) {
      const stats = evidenceBase.surveyStats;
      const statsData = [
        { value: stats.coordinationBarrier, label: 'See coordination as barrier', colour: 'var(--colour-alert)', icon: '⚠️' },
        { value: stats.trustRWA, label: 'Trust Rural Workforce Agencies', colour: 'var(--colour-success)', icon: '✓' },
        { value: stats.coordinationImpact, label: 'Believe coordination solves problems', colour: 'var(--pillar-drivers)', icon: '🎯' },
        { value: stats.partnershipsPositive, label: 'See partnerships as positive', colour: 'var(--colour-success)', icon: '🤝' },
        { value: stats.communityInputBarrier, label: 'Cite lack of community input', colour: 'var(--colour-warning)', icon: '💬' },
        { value: 95, label: 'Willing to contribute solutions', colour: 'var(--colour-success)', icon: '✨' }
      ];
      
      statsGrid.innerHTML = statsData.map(stat => `
        <div class="stat-card" style="border-left: 4px solid ${stat.colour}">
          <div class="stat-icon">${stat.icon}</div>
          <div class="stat-value">${stat.value}%</div>
          <div class="stat-label">${stat.label}</div>
        </div>
      `).join('');
    }
    
    // Community Willingness Chart
    if (this.chartData && this.chartData.communityWillingnessChartData) {
      const canvas = document.getElementById('community-willingness-chart');
      if (canvas) {
        this.charts.willingness = new Chart(canvas, this.chartData.communityWillingnessChartData);
      }
    }
    
    // Stakeholder Quotes
    const quotesEl = document.getElementById('stakeholder-quotes');
    if (quotesEl && evidenceBase.stakeholderQuotes) {
      quotesEl.innerHTML = evidenceBase.stakeholderQuotes.map(quote => `
        <blockquote class="stakeholder-quote">
          <p>"${quote.quote}"</p>
          <cite>— ${quote.source}</cite>
        </blockquote>
      `).join('');
    }
  }
  
  /**
   * Render Three Pillars Framework
   */
  renderThreePillars() {
    const { threePillars } = this.strategicData;
    
    ['doers', 'drivers', 'enablers'].forEach(pillarKey => {
      const pillar = threePillars[pillarKey];
      const contentEl = document.getElementById(`${pillarKey}-content`);
      
      if (contentEl && pillar) {
        contentEl.innerHTML = `
          <div class="pillar-objective">
            <h4>Objective</h4>
            <p>${pillar.objective}</p>
          </div>
          
          <div class="pillar-initiatives">
            <h4>Key Initiatives</h4>
            <ul>
              ${pillar.initiatives.map(init => `<li>${init}</li>`).join('')}
            </ul>
          </div>
          
          <div class="pillar-metrics">
            <h4>Success Metrics</h4>
            <ul>
              ${pillar.successMetrics.map(metric => `<li>${metric}</li>`).join('')}
            </ul>
          </div>
        `;
      }
    });
  }
  
  /**
   * Render Pilot Program
   */
  renderPilotProgram() {
    const { pilotProgram } = this.strategicData;
    
    const communitiesEl = document.getElementById('pilot-communities');
    if (communitiesEl && pilotProgram.communities) {
      communitiesEl.innerHTML = pilotProgram.communities.map(community => `
        <div class="community-card">
          <div class="community-header">
            <h3>${community.name}</h3>
            <span class="community-classification">${community.classification}</span>
          </div>
          
          <div class="community-details">
            <div class="detail-item">
              <span class="detail-label">Population:</span>
              <span class="detail-value">${community.population.toLocaleString()}</span>
            </div>
            
            <div class="detail-section">
              <h4>Focus Areas</h4>
              <ul>
                ${community.focusAreas.map(area => `<li>${area}</li>`).join('')}
              </ul>
            </div>
            
            <div class="detail-section">
              <h4>Strengths</h4>
              <ul>
                ${community.strengths.map(strength => `<li>${strength}</li>`).join('')}
              </ul>
            </div>
            
            <div class="detail-section">
              <h4>Challenges</h4>
              <ul>
                ${community.challenges.map(challenge => `<li>${challenge}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      `).join('');
    }
  }
  
  /**
   * Render Financial Strategy
   */
  renderFinancialStrategy() {
    const { financialStrategy } = this.strategicData;
    
    // Revenue Target Gauge
    const gaugeEl = document.getElementById('revenue-gauge');
    if (gaugeEl && financialStrategy) {
      gaugeEl.innerHTML = `
        <div class="gauge-display">
          <div class="gauge-value">${financialStrategy.targetRange}</div>
          <div class="gauge-label">Non-Government Revenue by 2030</div>
        </div>
      `;
    }
    
    // Revenue Streams Chart
    if (this.chartData && this.chartData.revenueStreamsStackedData) {
      const canvas = document.getElementById('revenue-streams-chart');
      if (canvas) {
        this.charts.revenueStreams = new Chart(canvas, this.chartData.revenueStreamsStackedData);
      }
    }
    
    // Revenue Details
    const detailsEl = document.getElementById('revenue-details');
    if (detailsEl && financialStrategy.revenueStreams) {
      detailsEl.innerHTML = `
        <div class="revenue-streams-grid">
          ${financialStrategy.revenueStreams.map(stream => `
            <div class="revenue-stream-card">
              <h4>${stream.name}</h4>
              <div class="stream-target">${stream.target}</div>
              <p>${stream.description}</p>
            </div>
          `).join('')}
        </div>
      `;
    }
  }
  
  /**
   * Render Implementation Timeline
   */
  renderImplementationTimeline() {
    const { implementationTimeline } = this.strategicData;
    
    const timelineEl = document.getElementById('timeline-visual');
    if (timelineEl && implementationTimeline) {
      const years = ['year1', 'year2', 'year3', 'year4', 'year5'];
      
      timelineEl.innerHTML = years.map((yearKey, index) => {
        const year = implementationTimeline[yearKey];
        if (!year) return '';
        
        return `
          <div class="timeline-year">
            <div class="timeline-marker">
              <span class="year-number">${2026 + index}</span>
            </div>
            <div class="timeline-content">
              <h3>${year.title}</h3>
              <ul class="timeline-milestones">
                ${year.milestones.map(milestone => `
                  <li class="milestone-item">${milestone}</li>
                `).join('')}
              </ul>
            </div>
          </div>
        `;
      }).join('');
    }
  }
  
  /**
   * Render VERSION 2: Interactive Workshop Tool
   */
  async renderVersion2() {
    // Initialize decision engine if not already done
    if (!this.decisionEngine) {
      this.decisionEngine = new DecisionEngine();
      await this.decisionEngine.initialize();
    }
    
    // Render decision controls
    const controlsEl = document.getElementById('workshop-decision-controls');
    if (controlsEl) {
      this.renderWorkshopDecisions(controlsEl);
    }
    
    // Render impact dashboard
    const dashboardEl = document.getElementById('workshop-impact-dashboard');
    if (dashboardEl) {
      const dashboard = new ImpactDashboard(dashboardEl);
      dashboard.connect(this.decisionEngine);
    }
    
    // Set up export button
    const exportBtn = document.getElementById('export-strategy-v2');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportStrategy();
      });
    }
  }
  
  /**
   * Render workshop decision controls
   */
  renderWorkshopDecisions(container) {
    // This will use the decision engine's categories
    const init = this.decisionEngine.initialize();
    const categories = init.categories;
    
    let html = '<div class="workshop-decisions-list">';
    
    Object.values(categories).forEach(category => {
      html += `
        <div class="workshop-decision-category">
          <h3>${category.title}</h3>
          <p class="decision-description">${category.description}</p>
          
          <div class="decision-options-list">
            ${category.options.map(option => `
              <label class="workshop-option">
                <input type="radio" 
                       name="workshop-${category.id}" 
                       value="${option.id}"
                       data-category="${category.id}"
                       data-option="${option.id}">
                <span class="option-content">
                  <span class="option-label">${option.label}</span>
                  <span class="option-impact impact-${option.impact}">${option.impact} impact</span>
                </span>
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
        this.handleWorkshopDecision(categoryId, optionId);
      });
    });
  }
  
  /**
   * Handle workshop decision
   */
  handleWorkshopDecision(categoryId, optionId) {
    const result = this.decisionEngine.makeDecision(categoryId, optionId);
    
    if (result.success) {
      // Update impact dashboard
      const dashboardEl = document.getElementById('workshop-impact-dashboard');
      if (dashboardEl) {
        const dashboard = new ImpactDashboard(dashboardEl);
        dashboard.connect(this.decisionEngine);
      }
      
      this.showNotification(`Decision recorded: ${result.decision.category}`, 'success');
    } else {
      this.showNotification(result.error, 'error');
    }
  }
  
  /**
   * Render Facilitator View
   */
  async renderFacilitator() {
    if (!this.facilitatorInterface) {
      this.facilitatorInterface = new FacilitatorInterface();
      await this.facilitatorInterface.initialize();
    }
  }
  
  /**
   * Export strategy document
   */
  async exportStrategy() {
    const exportData = this.decisionEngine.exportDecisions();
    
    // Create JSON download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RWAV-Strategy-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    this.showNotification('Strategy exported successfully', 'success');
  }
  
  /**
   * Set up online/offline status indicator
   */
  setupOnlineStatus() {
    const updateStatus = () => {
      const indicator = document.getElementById('online-indicator');
      const text = document.getElementById('online-text');
      
      if (navigator.onLine) {
        indicator?.classList.add('status-online');
        indicator?.classList.remove('status-offline');
        if (text) text.textContent = 'Online';
      } else {
        indicator?.classList.add('status-offline');
        indicator?.classList.remove('status-online');
        if (text) text.textContent = 'Offline';
      }
    };
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }
  
  /**
   * Show/hide loading overlay
   */
  showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none';
    }
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
  
  /**
   * Show error message
   */
  showError(message) {
    this.showLoading(false);
    alert('Error: ' + message);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new RWAVWorkshopApp();
  app.initialize();
  
  // Make app globally accessible for debugging
  window.rwavApp = app;
});

export default RWAVWorkshopApp;
