/**
 * RWAV Workshop Decision Engine
 * Real-time impact modelling and decision consequence analysis
 * Integrates with rwav-decision-logic.js
 * Australian English spelling throughout
 */

import { 
  decisionCategories,
  calculateDecisionImpact,
  calculatePillarImpact,
  calculateResourceRequirements,
  workshopSequence,
  validationChecklist
} from './logic/rwav-decision-logic.js';

class DecisionEngine {
  constructor() {
    this.currentDecisions = {};
    this.impactAnalysis = null;
    this.pillarScores = null;
    this.resourceRequirements = null;
    this.history = [];
  }
  
  /**
   * Initialize decision engine
   */
  initialize() {
    // Set default decisions (all undecided)
    Object.keys(decisionCategories).forEach(categoryKey => {
      this.currentDecisions[categoryKey] = null;
    });
    
    // Calculate initial state
    this.recalculateImpact();
    
    return {
      success: true,
      categories: decisionCategories,
      sequence: workshopSequence
    };
  }
  
  /**
   * Make a decision
   */
  makeDecision(categoryId, optionId) {
    // Validate decision
    const category = decisionCategories[categoryId];
    if (!category) {
      return {
        success: false,
        error: `Invalid category: ${categoryId}`
      };
    }
    
    const option = category.options.find(opt => opt.id === optionId);
    if (!option) {
      return {
        success: false,
        error: `Invalid option: ${optionId} for category ${categoryId}`
      };
    }
    
    // Check dependencies
    const dependencyCheck = this.checkDependencies(categoryId);
    if (!dependencyCheck.met) {
      return {
        success: false,
        error: `Dependencies not met: ${dependencyCheck.missing.join(', ')}`,
        dependencies: dependencyCheck
      };
    }
    
    // Record previous state for history
    const previousState = { ...this.currentDecisions };
    
    // Make the decision
    this.currentDecisions[categoryId] = optionId;
    
    // Add to history
    this.history.push({
      timestamp: new Date().toISOString(),
      categoryId,
      optionId,
      previousValue: previousState[categoryId],
      label: `${category.title}: ${option.label}`
    });
    
    // Recalculate impact
    this.recalculateImpact();
    
    return {
      success: true,
      decision: {
        category: category.title,
        option: option.label
      },
      impact: this.impactAnalysis,
      pillarScores: this.pillarScores
    };
  }
  
  /**
   * Check if dependencies are met for a decision
   */
  checkDependencies(categoryId) {
    const category = decisionCategories[categoryId];
    const dependencies = category.dependencies || [];
    
    const missing = dependencies.filter(depId => {
      return !this.currentDecisions[depId];
    });
    
    return {
      met: missing.length === 0,
      missing: missing.map(depId => {
        const depCategory = Object.values(decisionCategories).find(cat => cat.id === depId);
        return depCategory ? depCategory.title : depId;
      })
    };
  }
  
  /**
   * Recalculate impact analysis based on current decisions
   */
  recalculateImpact() {
    // Calculate overall impact
    this.impactAnalysis = calculateDecisionImpact(this.currentDecisions);
    
    // Calculate pillar-specific impact
    this.pillarScores = calculatePillarImpact(this.currentDecisions);
    
    // Calculate resource requirements
    this.resourceRequirements = calculateResourceRequirements(this.currentDecisions);
  }
  
  /**
   * Get current impact analysis
   */
  getImpactAnalysis() {
    return {
      overall: this.impactAnalysis,
      pillars: this.pillarScores,
      resources: this.resourceRequirements
    };
  }
  
  /**
   * Get decision summary for display
   */
  getDecisionSummary() {
    const summary = {
      decisions: [],
      undecided: [],
      totalScore: this.impactAnalysis?.overallScore || 0
    };
    
    Object.keys(decisionCategories).forEach(categoryKey => {
      const category = decisionCategories[categoryKey];
      const selectedOptionId = this.currentDecisions[categoryKey];
      
      if (selectedOptionId) {
        const option = category.options.find(opt => opt.id === selectedOptionId);
        summary.decisions.push({
          category: category.title,
          option: option.label,
          impact: option.impact
        });
      } else {
        summary.undecided.push(category.title);
      }
    });
    
    return summary;
  }
  
  /**
   * Validate all decisions before export
   */
  validateDecisions() {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      completeness: 0
    };
    
    // Check completeness
    const totalCategories = Object.keys(decisionCategories).length;
    const decidedCategories = Object.values(this.currentDecisions).filter(d => d !== null).length;
    validation.completeness = Math.round((decidedCategories / totalCategories) * 100);
    
    // Check for undecided critical decisions
    Object.keys(decisionCategories).forEach(categoryKey => {
      const category = decisionCategories[categoryKey];
      const decision = this.currentDecisions[categoryKey];
      
      if (!decision && category.weight >= 9) {
        validation.errors.push({
          category: category.title,
          message: 'Critical decision not made',
          severity: 'high'
        });
        validation.valid = false;
      } else if (!decision) {
        validation.warnings.push({
          category: category.title,
          message: 'Decision not made',
          severity: 'medium'
        });
      }
    });
    
    // Run validation checklist
    validationChecklist.forEach(check => {
      const checkResult = check.validate(this.currentDecisions);
      if (!checkResult.passed) {
        validation.warnings.push({
          check: check.name,
          message: checkResult.message,
          severity: 'low'
        });
      }
    });
    
    // Check for critical alerts
    if (this.impactAnalysis?.alerts) {
      const criticalAlerts = this.impactAnalysis.alerts.filter(a => a.severity === 'high');
      if (criticalAlerts.length > 0) {
        validation.warnings.push({
          check: 'Impact Analysis',
          message: `${criticalAlerts.length} critical alert(s) detected`,
          severity: 'high',
          details: criticalAlerts
        });
      }
    }
    
    return validation;
  }
  
  /**
   * Undo last decision
   */
  undoLastDecision() {
    if (this.history.length === 0) {
      return {
        success: false,
        error: 'No decisions to undo'
      };
    }
    
    const lastEntry = this.history.pop();
    this.currentDecisions[lastEntry.categoryId] = lastEntry.previousValue;
    
    this.recalculateImpact();
    
    return {
      success: true,
      undone: lastEntry.label,
      impact: this.impactAnalysis
    };
  }
  
  /**
   * Clear all decisions (start over)
   */
  clearAllDecisions() {
    Object.keys(this.currentDecisions).forEach(key => {
      this.currentDecisions[key] = null;
    });
    
    this.history = [];
    this.recalculateImpact();
    
    return {
      success: true,
      message: 'All decisions cleared'
    };
  }
  
  /**
   * Export decisions for Board-approved strategy document
   */
  exportDecisions() {
    return {
      timestamp: new Date().toISOString(),
      decisions: this.currentDecisions,
      summary: this.getDecisionSummary(),
      impact: this.getImpactAnalysis(),
      validation: this.validateDecisions(),
      history: this.history
    };
  }
  
  /**
   * Load decisions from saved state
   */
  loadDecisions(savedDecisions) {
    this.currentDecisions = { ...savedDecisions };
    this.recalculateImpact();
    
    return {
      success: true,
      loaded: Object.keys(savedDecisions).length,
      impact: this.impactAnalysis
    };
  }
}

/**
 * Impact Dashboard Renderer
 * Visualises impact analysis in real-time
 */
class ImpactDashboard {
  constructor(containerElement) {
    this.container = containerElement;
    this.decisionEngine = null;
  }
  
  /**
   * Connect to decision engine
   */
  connect(decisionEngine) {
    this.decisionEngine = decisionEngine;
    this.render();
  }
  
  /**
   * Render dashboard
   */
  render() {
    if (!this.decisionEngine) return;
    
    const impact = this.decisionEngine.getImpactAnalysis();
    
    this.container.innerHTML = `
      <div class="impact-dashboard">
        ${this.renderOverallScore(impact.overall)}
        ${this.renderPillarScores(impact.pillars)}
        ${this.renderAlerts(impact.overall?.alerts || [])}
        ${this.renderOpportunities(impact.overall?.opportunities || [])}
        ${this.renderResourceRequirements(impact.resources)}
      </div>
    `;
  }
  
  /**
   * Render overall impact score
   */
  renderOverallScore(overall) {
    if (!overall) return '';
    
    const scoreColour = this.getScoreColour(overall.overallScore);
    
    return `
      <div class="impact-overall">
        <h3>Overall Strategic Coherence</h3>
        <div class="score-gauge">
          <div class="score-value" style="colour: ${scoreColour}">
            ${overall.overallScore}
            <span class="score-max">/100</span>
          </div>
          <div class="score-bar">
            <div class="score-fill" style="width: ${overall.overallScore}%; background-colour: ${scoreColour}"></div>
          </div>
        </div>
        
        <div class="score-breakdown">
          <div class="score-item">
            <span class="score-label">Strategic Coherence</span>
            <span class="score-number">${overall.strategicCoherence || 0}/100</span>
          </div>
          <div class="score-item">
            <span class="score-label">Resource Feasibility</span>
            <span class="score-number">${overall.resourceFeasibility || 0}/100</span>
          </div>
          <div class="score-item">
            <span class="score-label">Stakeholder Alignment</span>
            <span class="score-number">${overall.stakeholderAlignment || 0}/100</span>
          </div>
          <div class="score-item">
            <span class="score-label">Timeline Feasibility</span>
            <span class="score-number">${overall.timelineFeasibility || 0}/100</span>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Render pillar scores
   */
  renderPillarScores(pillars) {
    if (!pillars) return '';
    
    return `
      <div class="impact-pillars">
        <h3>Pillar Impact Scores</h3>
        <div class="pillar-scores">
          <div class="pillar-score pillar-doers">
            <div class="pillar-icon">🎯</div>
            <div class="pillar-name">DOERS</div>
            <div class="pillar-value">${pillars.doers || 0}/100</div>
            <div class="pillar-bar">
              <div class="pillar-fill" style="width: ${pillars.doers || 0}%; background-colour: var(--pillar-doers)"></div>
            </div>
          </div>
          
          <div class="pillar-score pillar-drivers">
            <div class="pillar-icon">🚀</div>
            <div class="pillar-name">DRIVERS</div>
            <div class="pillar-value">${pillars.drivers || 0}/100</div>
            <div class="pillar-bar">
              <div class="pillar-fill" style="width: ${pillars.drivers || 0}%; background-colour: var(--pillar-drivers)"></div>
            </div>
          </div>
          
          <div class="pillar-score pillar-enablers">
            <div class="pillar-icon">⚡</div>
            <div class="pillar-name">ENABLERS</div>
            <div class="pillar-value">${pillars.enablers || 0}/100</div>
            <div class="pillar-bar">
              <div class="pillar-fill" style="width: ${pillars.enablers || 0}%; background-colour: var(--pillar-enablers)"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Render alerts (conflicts/warnings)
   */
  renderAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      return `
        <div class="impact-alerts impact-alerts-none">
          <div class="alert-icon">✓</div>
          <p>No conflicts detected</p>
        </div>
      `;
    }
    
    const alertsHtml = alerts.map(alert => `
      <div class="alert alert-${alert.severity}">
        <div class="alert-icon">${this.getAlertIcon(alert.severity)}</div>
        <div class="alert-content">
          <div class="alert-message">${alert.message}</div>
          ${alert.affectedAreas ? `<div class="alert-areas">Affects: ${alert.affectedAreas.join(', ')}</div>` : ''}
        </div>
      </div>
    `).join('');
    
    return `
      <div class="impact-alerts">
        <h3>Alerts & Conflicts</h3>
        ${alertsHtml}
      </div>
    `;
  }
  
  /**
   * Render opportunities (synergies)
   */
  renderOpportunities(opportunities) {
    if (!opportunities || opportunities.length === 0) return '';
    
    const opportunitiesHtml = opportunities.map(opp => `
      <div class="opportunity opportunity-${opp.type}">
        <div class="opportunity-icon">✨</div>
        <div class="opportunity-content">
          <div class="opportunity-message">${opp.message}</div>
          ${opp.pillar ? `<div class="opportunity-pillar">Strengthens: ${opp.pillar.toUpperCase()}</div>` : ''}
        </div>
      </div>
    `).join('');
    
    return `
      <div class="impact-opportunities">
        <h3>Opportunities & Synergies</h3>
        ${opportunitiesHtml}
      </div>
    `;
  }
  
  /**
   * Render resource requirements
   */
  renderResourceRequirements(resources) {
    if (!resources) return '';
    
    return `
      <div class="impact-resources">
        <h3>Resource Requirements</h3>
        
        <div class="resource-section">
          <h4>Staffing</h4>
          <div class="resource-timeline">
            <div class="resource-year">
              <span class="resource-label">Year 1</span>
              <span class="resource-value">${resources.staffing?.year1 || 0} FTE</span>
            </div>
            <div class="resource-year">
              <span class="resource-label">Year 2</span>
              <span class="resource-value">${resources.staffing?.year2 || 0} FTE</span>
            </div>
            <div class="resource-year">
              <span class="resource-label">Year 3</span>
              <span class="resource-value">${resources.staffing?.year3 || 0} FTE</span>
            </div>
          </div>
        </div>
        
        ${resources.criticalHires && resources.criticalHires.length > 0 ? `
          <div class="resource-section">
            <h4>Critical Hires</h4>
            <ul class="resource-list">
              ${resources.criticalHires.map(hire => `<li>${hire}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${resources.infrastructureNeeds && resources.infrastructureNeeds.length > 0 ? `
          <div class="resource-section">
            <h4>Infrastructure Needs</h4>
            <ul class="resource-list">
              ${resources.infrastructureNeeds.map(need => `<li>${need}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  /**
   * Get colour for score
   */
  getScoreColour(score) {
    if (score >= 80) return 'var(--colour-success)';
    if (score >= 60) return 'var(--colour-warning)';
    return 'var(--colour-alert)';
  }
  
  /**
   * Get icon for alert severity
   */
  getAlertIcon(severity) {
    const icons = {
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️'
    };
    return icons[severity] || 'ℹ️';
  }
  
  /**
   * Update dashboard (call when decisions change)
   */
  update() {
    this.render();
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DecisionEngine, ImpactDashboard };
}

export { DecisionEngine, ImpactDashboard };
