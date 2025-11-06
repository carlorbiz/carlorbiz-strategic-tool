/**
 * RWAV Strategic Workshop PWA - Main Application
 * VERSION 1: Static Intelligence Briefing
 * Australian English spelling throughout
 */

// Application State
const APP_STATE = {
  currentTab: 'overview',
  currentVersion: 'briefing', // 'briefing' or 'workshop'
  expandedCommunity: null,
  map: null,
  charts: {}
};

// ========================================
// INITIALISATION
// ========================================

// Wait for strategic data to load before initializing
function initializeApp() {
  console.log('RWAV Strategic Workshop PWA - Initialising...');
  
  // Check if data is loaded
  if (typeof STRATEGIC_PLAN_DATA === 'undefined' || !STRATEGIC_PLAN_DATA) {
    console.log('Waiting for strategic data to load...');
    setTimeout(initializeApp, 100);
    return;
  }
  
  console.log('Strategic data loaded, initializing components...');
  
  // Initialise all components
  initialiseTabNavigation();
  loadExecutiveOverview();
  loadThreePillarsDashboard();
  loadCommunityPulseSurvey();
  loadPilotCommunities();
  loadFinancialStrategy();
  loadImplementationTimeline();
  initialisePDFExport();
  
  console.log('Application initialised successfully');
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Existing VERSION 1 initialisation
    initializeApp();
    
    // ADD THIS: VERSION 2 initialisation
    initializeVersion2();
});

// Also listen for the strategicDataLoaded event
window.addEventListener('strategicDataLoaded', () => {
  console.log('Strategic data loaded event received');
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeApp();
  }
});

// ========================================
// TAB NAVIGATION
// ========================================
function initialiseTabNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update active states
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
          APP_STATE.currentTab = targetTab;
          
          // Trigger specific initialisations when tab becomes active
          if (targetTab === 'pilots' && !APP_STATE.map) {
            initialiseMap();
          }
        }
      });
    });
  });
}

// ========================================
// EXECUTIVE OVERVIEW
// ========================================
function loadExecutiveOverview() {
  const data = STRATEGIC_PLAN_DATA.EXECUTIVE_SUMMARY;
  
  // Load text content
  document.getElementById('current-state-text').textContent = data.currentState;
  document.getElementById('future-vision-text').textContent = data.futureVision;
  document.getElementById('evidence-summary-text').textContent = data.evidenceSummary;
  
  // Load required decisions
  const decisionsContainer = document.getElementById('required-decisions-list');
  data.requiredDecisions.forEach((decision, index) => {
    const decisionCard = document.createElement('div');
    decisionCard.className = 'card';
    decisionCard.style.marginBottom = '1rem';
    
    const priorityColour = decision.priority === 'critical' ? 'var(--colour-warning)' : 'var(--colour-orange)';
    
    decisionCard.innerHTML = `
      <div style="display: flex; align-items: start; gap: 1rem;">
        <div style="background: ${priorityColour}; colour: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: centre; justify-content: centre; font-weight: bold; flex-shrink: 0;">
          ${index + 1}
        </div>
        <div style="flex: 1;">
          <h4 style="margin-bottom: 0.5rem; colour: var(--colour-grey-900);">${decision.title}</h4>
          <p style="margin-bottom: 0.5rem; colour: var(--colour-grey-700);">${decision.description}</p>
          <div style="display: flex; gap: 1rem; font-size: 0.875rem; colour: var(--colour-grey-600);">
            <span><i class="fas fa-exclamation-circle"></i> Priority: <strong>${decision.priority.toUpperCase()}</strong></span>
            ${decision.dependencies.length > 0 ? `<span><i class="fas fa-link"></i> Dependencies: ${decision.dependencies.length}</span>` : ''}
          </div>
        </div>
      </div>
    `;
    
    decisionsContainer.appendChild(decisionCard);
  });
  
  // Load post-approval actions
  const actionsList = document.getElementById('post-approval-actions-list');
  data.postApprovalActions.forEach(action => {
    const li = document.createElement('li');
    li.textContent = action;
    li.style.marginBottom = '0.5rem';
    actionsList.appendChild(li);
  });
}

// ========================================
// THREE PILLARS DASHBOARD
// ========================================
function loadThreePillarsDashboard() {
  const pillarsData = STRATEGIC_PLAN_DATA.THREE_PILLARS;
  const container = document.getElementById('pillars-container');
  
  Object.values(pillarsData).forEach(pillar => {
    const pillarColumn = createPillarColumn(pillar);
    container.appendChild(pillarColumn);
  });
}

function createPillarColumn(pillar) {
  const column = document.createElement('div');
  column.className = 'pillar-column';
  
  column.innerHTML = `
    <div class="pillar-header ${pillar.id}">
      <div class="pillar-icon">
        <i class="fas ${pillar.icon}"></i>
      </div>
      <h3 class="pillar-title">${pillar.title}</h3>
      <p class="pillar-objective">${pillar.objective}</p>
    </div>
    <div class="pillar-body">
      <div class="initiatives-list" id="${pillar.id}-initiatives"></div>
      <div class="success-metrics">
        <div class="metrics-title">Success Metrics (2030)</div>
        <div id="${pillar.id}-metrics"></div>
      </div>
    </div>
  `;
  
  // Populate initiatives
  const initiativesList = column.querySelector(`#${pillar.id}-initiatives`);
  pillar.initiatives.forEach(initiative => {
    const initiativeCard = document.createElement('div');
    initiativeCard.className = `initiative-card ${pillar.id}`;
    initiativeCard.innerHTML = `
      <div class="initiative-name">${initiative.name}</div>
      <div class="initiative-description">${initiative.description}</div>
      <div class="initiative-meta">
        <span><i class="fas fa-calendar"></i> ${initiative.timeline}</span>
        <span><i class="fas fa-chart-line"></i> ${initiative.impact} impact</span>
      </div>
    `;
    
    // Add hover tooltip showing connections
    if (initiative.connections && initiative.connections.length > 0) {
      initiativeCard.title = `Connected to: ${initiative.connections.join(', ')}`;
    }
    
    initiativesList.appendChild(initiativeCard);
  });
  
  // Populate success metrics
  const metricsList = column.querySelector(`#${pillar.id}-metrics`);
  pillar.successMetrics.forEach(metric => {
    const metricItem = document.createElement('div');
    metricItem.className = 'metric-item';
    metricItem.innerHTML = `
      <span>${metric.metric}</span>
      <span class="metric-value">${metric.target}</span>
    `;
    metricsList.appendChild(metricItem);
  });
  
  return column;
}

// ========================================
// COMMUNITY PULSE SURVEY
// ========================================
function loadCommunityPulseSurvey() {
  const data = STRATEGIC_PLAN_DATA.EVIDENCE_BASE;
  
  // Load stat cards
  loadStatCards(data.surveyStats);
  
  // Load willingness chart
  loadWillingnessChart(data.communityWillingness);
  
  // Load stakeholder quotes
  loadStakeholderQuotes(data.stakeholderQuotes);
}

function loadStatCards(stats) {
  const container = document.getElementById('stat-cards-grid');
  
  Object.values(stats).forEach(stat => {
    const card = document.createElement('div');
    card.className = `stat-card ${stat.indicator}`;
    card.innerHTML = `
      <div class="stat-value ${stat.indicator}">${stat.value}%</div>
      <div class="stat-label">${stat.label}</div>
    `;
    container.appendChild(card);
  });
}

function loadWillingnessChart(willingnessData) {
  const ctx = document.getElementById('willingness-chart').getContext('2d');
  
  const labels = willingnessData.map(item => item.activity);
  const values = willingnessData.map(item => item.percentage);
  
  // Colour coding - green for positive, red for negative
  const backgroundColours = values.map(val => 
    val >= 20 ? 'rgba(5, 150, 105, 0.8)' : 'rgba(220, 38, 38, 0.8)'
  );
  
  APP_STATE.charts.willingness = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Percentage Willing',
        data: values,
        backgroundColor: backgroundColours,
        borderColor: backgroundColours.map(colour => colour.replace('0.8', '1')),
        borderWidth: 2
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.parsed.x}% of respondents`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          },
          title: {
            display: true,
            text: 'Percentage of Respondents'
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

function loadStakeholderQuotes(quotes) {
  const container = document.getElementById('stakeholder-quotes');
  
  quotes.forEach(quote => {
    const callout = document.createElement('div');
    callout.className = 'insight-callout';
    callout.innerHTML = `
      <div class="insight-quote">"${quote.quote}"</div>
      <div class="insight-attribution">— ${quote.source} | Theme: ${quote.theme}</div>
    `;
    container.appendChild(callout);
  });
}

// ========================================
// PILOT COMMUNITIES
// ========================================
function loadPilotCommunities() {
  const data = STRATEGIC_PLAN_DATA.PILOT_PROGRAM;
  
  // Load overview text
  document.getElementById('pilot-overview-text').textContent = 
    `${data.overview.purpose} Timeline: ${data.overview.timeline}. ${data.overview.investment}`;
  
  // Load community cards
  const container = document.getElementById('communities-grid');
  data.communities.forEach(community => {
    const card = createCommunityCard(community);
    container.appendChild(card);
  });
}

function createCommunityCard(community) {
  const card = document.createElement('div');
  card.className = 'community-card';
  card.dataset.communityId = community.id;
  
  card.innerHTML = `
    <div class="community-header">
      <h3 class="community-name">${community.name}</h3>
      <div class="community-meta">
        <span><i class="fas fa-map-marker-alt"></i> ${community.classification}</span>
        <span><i class="fas fa-users"></i> Population: ${community.population.toLocaleString()}</span>
      </div>
    </div>
    <div class="community-body">
      <div class="community-section">
        <h4>First Nations Context</h4>
        <p>${community.firstNationsContext}</p>
      </div>
      
      <div class="community-section">
        <h4>Focus Areas</h4>
        <ul>
          ${community.focusAreas.map(area => `<li>${area}</li>`).join('')}
        </ul>
      </div>
      
      <div class="community-section">
        <h4>Strengths</h4>
        <ul>
          ${community.strengths.slice(0, 3).map(strength => `<li>${strength}</li>`).join('')}
        </ul>
      </div>
      
      <div class="community-section">
        <h4>Challenges</h4>
        <ul>
          ${community.challenges.slice(0, 3).map(challenge => `<li>${challenge}</li>`).join('')}
        </ul>
      </div>
      
      <button class="btn btn-primary" onclick="expandCommunity('${community.id}')" style="width: 100%; margin-top: 1rem;">
        <i class="fas fa-expand"></i> View Full Details
      </button>
    </div>
  `;
  
  return card;
}

function expandCommunity(communityId) {
  // This will be enhanced in VERSION 2 with full expansion view
  alert(`Detailed view for ${communityId} will be available in Workshop Mode`);
}

function initialiseMap() {
  if (APP_STATE.map) return; // Already initialised
  
  const mapElement = document.getElementById('map');
  if (!mapElement) return;
  
  // Centre on Victoria
  APP_STATE.map = L.map('map').setView([-37.0, 144.5], 6);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(APP_STATE.map);
  
  // Add markers for pilot communities
  const communities = STRATEGIC_PLAN_DATA.PILOT_PROGRAM.communities;
  communities.forEach(community => {
    const marker = L.marker([community.coordinates.lat, community.coordinates.lng])
      .addTo(APP_STATE.map);
    
    marker.bindPopup(`
      <strong>${community.name}</strong><br>
      ${community.classification}<br>
      Population: ${community.population.toLocaleString()}
    `);
    
    marker.on('click', () => {
      // Scroll to community card
      const card = document.querySelector(`[data-community-id="${community.id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'centre' });
        card.style.boxShadow = '0 0 20px rgba(37, 99, 235, 0.5)';
        setTimeout(() => {
          card.style.boxShadow = '';
        }, 2000);
      }
    });
  });
}

// ========================================
// FINANCIAL STRATEGY
// ========================================
function loadFinancialStrategy() {
  const data = STRATEGIC_PLAN_DATA.FINANCIAL_STRATEGY;
  
  // Load ethical framework text
  document.getElementById('ethical-framework-text').textContent = data.ethicalFramework;
  
  // Load ethical principles
  const principlesList = document.getElementById('ethical-principles-list');
  data.riskMitigation.principles.forEach(principle => {
    const li = document.createElement('li');
    li.textContent = principle;
    li.style.marginBottom = '0.5rem';
    principlesList.appendChild(li);
  });
  
  // Load charts
  loadRevenueGaugeChart(data);
  loadRevenueBreakdownChart(data);
  loadRevenueTimelineChart(data);
}

function loadRevenueGaugeChart(data) {
  const ctx = document.getElementById('revenue-gauge-chart').getContext('2d');
  
  APP_STATE.charts.revenueGauge = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Target Revenue (25-30%)', 'Government Funding (70-75%)'],
      datasets: [{
        data: [27.5, 72.5], // Midpoint of target range
        backgroundColor: [
          'rgba(5, 150, 105, 0.8)',
          'rgba(209, 213, 219, 0.5)'
        ],
        borderColor: [
          'rgba(5, 150, 105, 1)',
          'rgba(209, 213, 219, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.parsed}%`;
            }
          }
        }
      }
    }
  });
}

function loadRevenueBreakdownChart(data) {
  const ctx = document.getElementById('revenue-breakdown-chart').getContext('2d');
  
  const labels = data.revenueStreams.map(stream => stream.name);
  const values = data.revenueStreams.map(stream => {
    const range = stream.target.match(/(\d+)-(\d+)/);
    return range ? (parseInt(range[1]) + parseInt(range[2])) / 2 : parseInt(stream.target);
  });
  const colours = data.revenueStreams.map(stream => stream.colour);
  
  APP_STATE.charts.revenueBreakdown = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Target Revenue Contribution (%)',
        data: values,
        backgroundColor: colours.map(c => c + 'CC'),
        borderColor: colours,
        borderWidth: 2
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const stream = data.revenueStreams[context.dataIndex];
              return `Target: ${stream.target} of total revenue`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 15,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });
}

function loadRevenueTimelineChart(data) {
  const ctx = document.getElementById('revenue-timeline-chart').getContext('2d');
  
  const years = [2026, 2027, 2028, 2029, 2030];
  const datasets = data.revenueStreams.map(stream => {
    const streamData = years.map(year => {
      if (year < stream.launchYear) return 0;
      if (stream.rampUpYears.includes(year)) {
        const index = stream.rampUpYears.indexOf(year);
        const targetMid = stream.target.match(/(\d+)-(\d+)/) 
          ? (parseInt(RegExp.$1) + parseInt(RegExp.$2)) / 2 
          : parseInt(stream.target);
        return (targetMid / stream.rampUpYears.length) * (index + 1);
      }
      return 0;
    });
    
    return {
      label: stream.name,
      data: streamData,
      backgroundColor: stream.colour + 'CC',
      borderColor: stream.colour,
      borderWidth: 2
    };
  });
  
  APP_STATE.charts.revenueTimeline = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          },
          title: {
            display: true,
            text: 'Revenue Contribution (%)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Year'
          }
        }
      }
    }
  });
}

// ========================================
// IMPLEMENTATION TIMELINE
// ========================================
function loadImplementationTimeline() {
  const data = STRATEGIC_PLAN_DATA.IMPLEMENTATION_TIMELINE;
  const container = document.getElementById('timeline-container');
  
  Object.values(data).forEach(yearData => {
    const yearSection = createTimelineYear(yearData);
    container.appendChild(yearSection);
  });
}

function createTimelineYear(yearData) {
  const section = document.createElement('div');
  section.className = 'timeline-year';
  
  const yearLabel = yearData.years || yearData.year;
  
  section.innerHTML = `
    <div class="timeline-header">
      <div class="timeline-year-badge">${yearLabel}</div>
      <h3 class="timeline-year-title">${yearData.title}</h3>
    </div>
    <div class="timeline-milestones" id="milestones-${yearLabel}"></div>
  `;
  
  const milestonesContainer = section.querySelector(`#milestones-${yearLabel}`);
  yearData.milestones.forEach(milestone => {
    const node = document.createElement('div');
    node.className = 'milestone-node';
    node.innerHTML = `
      <div class="milestone-quarter">${milestone.quarter}</div>
      <div class="milestone-title">${milestone.title}</div>
      <div class="milestone-description">${milestone.description}</div>
    `;
    
    // Add click handler for detail view (VERSION 2 feature)
    node.addEventListener('click', () => {
      node.style.background = 'white';
      node.style.boxShadow = 'var(--shadow-md)';
      setTimeout(() => {
        node.style.background = '';
        node.style.boxShadow = '';
      }, 1000);
    });
    
    milestonesContainer.appendChild(node);
  });
  
  return section;
}

// ========================================
// PDF EXPORT
// ========================================
function initialisePDFExport() {
  document.getElementById('btn-export-pdf').addEventListener('click', exportToPDF);
}

async function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Add cover page
  pdf.setFontSize(28);
  pdf.setTextColor(37, 99, 235);
  pdf.text('RWAV Strategic Plan', 105, 100, { align: 'centre' });
  
  pdf.setFontSize(18);
  pdf.setTextColor(107, 114, 128);
  pdf.text('2026-2030', 105, 115, { align: 'centre' });
  
  pdf.setFontSize(12);
  pdf.text('Preparing a Bold Agenda for Rural Workforce Transformation', 105, 130, { align: 'centre' });
  
  // Add footer
  pdf.setFontSize(10);
  pdf.setTextColor(156, 163, 175);
  pdf.text('Rural Workforce Agency Victoria', 105, 280, { align: 'centre' });
  
  // Add new page for executive summary
  pdf.addPage();
  pdf.setFontSize(16);
  pdf.setTextColor(17, 24, 39);
  pdf.text('Executive Summary', 20, 20);
  
  pdf.setFontSize(10);
  pdf.setTextColor(55, 65, 81);
  const summaryText = STRATEGIC_PLAN_DATA.EXECUTIVE_SUMMARY.futureVision;
  const splitText = pdf.splitTextToSize(summaryText, 170);
  pdf.text(splitText, 20, 35);
  
  // Save the PDF
  pdf.save('RWAV-Strategic-Plan-2026-2030.pdf');
  
  // Show success message
  alert('PDF exported successfully!');
}

// ========================================
// VERSION TOGGLE (Placeholder for VERSION 2)
// ========================================
document.getElementById('btn-version-toggle').addEventListener('click', () => {
  alert('Workshop Mode (VERSION 2) with AI photo upload and impact modelling will be available soon!');
});

/**
 * Initialise VERSION 2 (Workshop Tool) components
 */
function initializeVersion2() {
    console.log('Initialising VERSION 2 components...');
    
    // Mode toggle
    const toggleBtn = document.getElementById('btn-version-toggle');
    const workshopInterface = document.getElementById('workshopInterface');
    const mainContent = document.querySelector('.main-content');
    let isWorkshopMode = false;
    
    toggleBtn.addEventListener('click', function() {
        isWorkshopMode = !isWorkshopMode;
        
        if (isWorkshopMode) {
            // Switch to Workshop Mode
            mainContent.style.display = 'none';
            workshopInterface.style.display = 'block';
            document.getElementById('version-label').textContent = 'Switch to Briefing Mode';
            
            // Initialise workshop components
            initWorkshopComponents();
        } else {
            // Switch back to Briefing Mode
            mainContent.style.display = 'block';
            workshopInterface.style.display = 'none';
            document.getElementById('version-label').textContent = 'Switch to Workshop Mode';
        }
    });
}

/**
 * Initialise all workshop components when entering Workshop Mode
 */
function initWorkshopComponents() {
    console.log('Initialising workshop components...');
    
    // 1. QR Upload System
    if (typeof QRUploadSystem !== 'undefined') {
        const qrUpload = new QRUploadSystem();
        
        document.getElementById('generateQRBtn').addEventListener('click', function() {
            qrUpload.generateQRCode();
            document.getElementById('qrCodeDisplay').style.display = 'block';
        });
        
        document.getElementById('manualUploadBtn').addEventListener('click', function() {
            document.getElementById('manualPhotoUpload').click();
        });
        
        document.getElementById('manualPhotoUpload').addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                qrUpload.handlePhotoUpload(e.target.files[0]);
            }
        });
        
        // Listen for photo uploads
        window.addEventListener('photoUploaded', function(e) {
            processPhoto(e.detail.photoData);
        });
    }
    
    // 2. AI Chatbot
    if (typeof AIChatbot !== 'undefined') {
        const chatbot = new AIChatbot({
            apiKey: window.OPENAI_API_KEY || '', // Set via environment or prompt user
            strategicPlanData: window.STRATEGIC_PLAN_DATA
        });
        
        document.getElementById('chatSendBtn').addEventListener('click', function() {
            const input = document.getElementById('chatInput');
            const message = input.value.trim();
            if (message) {
                sendChatMessage(chatbot, message);
                input.value = '';
            }
        });
        
        document.getElementById('chatInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('chatSendBtn').click();
            }
        });
    }
    
    // 3. Decision Engine
    if (typeof DecisionEngine !== 'undefined') {
        window.decisionEngine = new DecisionEngine(window.STRATEGIC_PLAN_DATA);
        console.log('Decision engine initialised');
    }
    
    // 4. Facilitator Interface
    if (typeof FacilitatorInterface !== 'undefined') {
        window.facilitatorInterface = new FacilitatorInterface({
            decisionEngine: window.decisionEngine,
            strategicData: window.STRATEGIC_PLAN_DATA
        });
        console.log('Facilitator interface initialised');
    }
}

/**
 * Process uploaded photo with OCR
 */
function processPhoto(photoData) {
    console.log('Processing photo with OCR...');
    document.getElementById('ocrStatus').textContent = 'Processing...';
    
    if (typeof OCREngine !== 'undefined') {
        const ocr = new OCREngine();
        
        ocr.processImage(photoData).then(results => {
            console.log('OCR results:', results);
            displayOCRResults(results);
            
            // Pass to decision engine
            if (window.decisionEngine) {
                window.decisionEngine.updateFromOCR(results);
                updateImpactDashboard();
            }
        }).catch(error => {
            console.error('OCR error:', error);
            document.getElementById('ocrStatus').textContent = 'Error processing image';
        });
    }
}

/**
 * Display OCR results for user confirmation
 */
function displayOCRResults(results) {
    const container = document.getElementById('ocrResults');
    container.innerHTML = '<h4>Detected Priorities:</h4>';
    
    const list = document.createElement('ul');
    results.detectedUIDs.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.uid}: ${item.priority} priority`;
        list.appendChild(li);
    });
    
    container.appendChild(list);
    document.getElementById('ocrStatus').textContent = 'Processing complete';
}

/**
 * Send message to AI chatbot
 */
function sendChatMessage(chatbot, message) {
    const messagesDiv = document.getElementById('chatMessages');
    
    // Display user message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user-message';
    userMsg.textContent = message;
    messagesDiv.appendChild(userMsg);
    
    // Get AI response
    chatbot.sendMessage(message).then(response => {
        const aiMsg = document.createElement('div');
        aiMsg.className = 'chat-message ai-message';
        aiMsg.textContent = response;
        messagesDiv.appendChild(aiMsg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }).catch(error => {
        console.error('Chatbot error:', error);
        const errorMsg = document.createElement('div');
        errorMsg.className = 'chat-message error-message';
        errorMsg.textContent = 'Error: Could not get response';
        messagesDiv.appendChild(errorMsg);
    });
}

/**
 * Update impact dashboard with latest decisions
 */
function updateImpactDashboard() {
    if (!window.decisionEngine) return;
    
    const impacts = window.decisionEngine.calculateImpacts();
    const container = document.getElementById('impactDisplay');
    
    container.innerHTML = '<h3>Impact Analysis:</h3>';
    
    // Display impacts
    Object.keys(impacts).forEach(pillar => {
        const pillarDiv = document.createElement('div');
        pillarDiv.className = 'impact-pillar';
        pillarDiv.innerHTML = `
            <h4>${pillar}</h4>
            <p>Score: ${impacts[pillar].score}/100</p>
            <p>Status: ${impacts[pillar].status}</p>
        `;
        container.appendChild(pillarDiv);
    });
}
