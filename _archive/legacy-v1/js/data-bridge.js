/**
 * Data Bridge - Connects Jan's JSON data structure to existing app.js
 * Transforms rwav-strategic-data.json into STRATEGIC_PLAN_DATA format
 * Australian English spelling throughout
 */

// Global variable to store transformed data
window.STRATEGIC_PLAN_DATA = null;

// Load strategic data and transform to expected format
async function loadStrategicData() {
  try {
    const response = await fetch('./js/data/rwav-strategic-data.json');
    const data = await response.json();
    
    // Transform to STRATEGIC_PLAN_DATA format expected by app.js
    window.STRATEGIC_PLAN_DATA = transformData(data);
    
    console.log('Strategic data loaded and transformed successfully', window.STRATEGIC_PLAN_DATA);
    
    // Dispatch event to notify app.js that data is ready
    window.dispatchEvent(new CustomEvent('strategicDataLoaded', { detail: window.STRATEGIC_PLAN_DATA }));
    
    return window.STRATEGIC_PLAN_DATA;
    
  } catch (error) {
    console.error('Error loading strategic data:', error);
    
    // Provide fallback empty data structure
    window.STRATEGIC_PLAN_DATA = createFallbackData();
    return window.STRATEGIC_PLAN_DATA;
  }
}

/**
 * Transform Jan's data structure to match app.js expectations
 */
function transformData(rawData) {
  return {
    EXECUTIVE_SUMMARY: {
      currentState: rawData.executiveSummary?.currentState?.description || 
                    rawData.executiveSummary?.currentState || '',
      futureVision: rawData.executiveSummary?.futureVision?.description || 
                    rawData.executiveSummary?.futureVision || '',
      evidenceSummary: rawData.executiveSummary?.evidenceSummary || 
                       'The Community Pulse Survey reveals strong community support for coordination and partnership-based solutions.',
      requiredDecisions: (rawData.executiveSummary?.requiredDecisions || []).map((decision, index) => ({
        title: decision.title || decision,
        description: decision.description || '',
        priority: decision.urgency || decision.priority || 'high',
        dependencies: decision.dependencies || []
      })),
      postApprovalActions: rawData.executiveSummary?.postApprovalActions || [
        'Establish pilot program governance structure',
        'Recruit additional staff for coordination roles',
        'Develop data intelligence platform specifications',
        'Begin stakeholder engagement for pilot communities'
      ]
    },
    
    THREE_PILLARS: {
      doers: transformPillar(rawData.threePillars?.doers, 'doers', 'DOERS', 'fa-bullseye'),
      drivers: transformPillar(rawData.threePillars?.drivers, 'drivers', 'DRIVERS', 'fa-rocket'),
      enablers: transformPillar(rawData.threePillars?.enablers, 'enablers', 'ENABLERS', 'fa-cogs')
    },
    
    EVIDENCE_BASE: {
      surveyStats: transformSurveyStats(rawData.evidenceBase?.surveyStats),
      communityWillingness: transformCommunityWillingness(rawData.evidenceBase?.communityWillingness),
      stakeholderQuotes: transformStakeholderQuotes(rawData.evidenceBase?.stakeholderQuotes)
    },
    
    PILOT_PROGRAM: {
      overview: {
        purpose: rawData.pilotProgram?.overview?.purpose || 'Test the three-pillar framework in diverse rural contexts',
        timeline: rawData.pilotProgram?.overview?.timeline || '2026-2027 (18 months)',
        investment: rawData.pilotProgram?.overview?.investment || '$500,000 allocated across three communities'
      },
      communities: (rawData.pilotProgram?.communities || []).map(transformCommunity)
    },
    
    FINANCIAL_STRATEGY: transformFinancialStrategy(rawData.financialStrategy),
    
    IMPLEMENTATION_TIMELINE: transformTimeline(rawData.implementationTimeline)
  };
}

/**
 * Transform pillar data
 */
function transformPillar(pillar, id, title, icon) {
  if (!pillar) {
    return {
      id,
      title,
      subtitle: '',
      objective: '',
      icon,
      initiatives: [],
      successMetrics: []
    };
  }
  
  return {
    id,
    title,
    subtitle: pillar.subtitle || pillar.tagline || '',
    objective: pillar.objective || '',
    icon,
    initiatives: (pillar.initiatives || []).map((init, index) => ({
      name: typeof init === 'string' ? init : (init.name || init.title || `Initiative ${index + 1}`),
      description: typeof init === 'string' ? '' : (init.description || ''),
      timeline: typeof init === 'string' ? 'Year 1-2' : (init.timeline || 'Year 1-2'),
      impact: typeof init === 'string' ? 'High' : (init.impact || 'High'),
      connections: typeof init === 'string' ? [] : (init.connections || init.relatedInitiatives || [])
    })),
    successMetrics: (pillar.successMetrics || []).map(metric => ({
      metric: typeof metric === 'string' ? metric : (metric.metric || metric.name || ''),
      target: typeof metric === 'string' ? '' : (metric.target || metric.value || '')
    }))
  };
}

/**
 * Transform survey stats to match expected format
 */
function transformSurveyStats(stats) {
  if (!stats) {
    return {
      coordinationBarrier: { value: 91, label: 'See coordination as barrier', indicator: 'warning' },
      trustRWA: { value: 74, label: 'Trust Rural Workforce Agencies', indicator: 'success' },
      coordinationImpact: { value: 66, label: 'Believe coordination solves problems', indicator: 'info' },
      partnershipsPositive: { value: 92, label: 'See partnerships as positive', indicator: 'success' },
      communityInputBarrier: { value: 72, label: 'Cite lack of community input', indicator: 'warning' },
      willingContribute: { value: 95, label: 'Willing to contribute solutions', indicator: 'success' }
    };
  }
  
  return {
    coordinationBarrier: {
      value: stats.coordinationBarrier || 91,
      label: 'See coordination as barrier',
      indicator: 'warning'
    },
    trustRWA: {
      value: stats.trustRWA || 74,
      label: 'Trust Rural Workforce Agencies',
      indicator: 'success'
    },
    coordinationImpact: {
      value: stats.coordinationImpact || 66,
      label: 'Believe coordination solves problems',
      indicator: 'info'
    },
    partnershipsPositive: {
      value: stats.partnershipsPositive || 92,
      label: 'See partnerships as positive',
      indicator: 'success'
    },
    communityInputBarrier: {
      value: stats.communityInputBarrier || 72,
      label: 'Cite lack of community input',
      indicator: 'warning'
    },
    willingContribute: {
      value: 95,
      label: 'Willing to contribute solutions',
      indicator: 'success'
    }
  };
}

/**
 * Transform community willingness data
 */
function transformCommunityWillingness(willingness) {
  if (!willingness || !Array.isArray(willingness)) {
    return [
      { activity: 'Talk to family/friends', percentage: 65 },
      { activity: 'Advocate for policy', percentage: 50 },
      { activity: 'Pursue health career', percentage: 40 },
      { activity: 'Participate in local programs', percentage: 38 },
      { activity: 'Volunteer', percentage: 35 },
      { activity: 'Donate', percentage: 25 },
      { activity: 'Host events', percentage: 20 },
      { activity: 'Not willing', percentage: 5 }
    ];
  }
  
  return willingness.map(item => ({
    activity: item.activity || item.name || '',
    percentage: item.percentage || item.value || 0
  }));
}

/**
 * Transform stakeholder quotes
 */
function transformStakeholderQuotes(quotes) {
  if (!quotes || !Array.isArray(quotes)) {
    return [
      {
        quote: 'We need someone to bring everyone together. Right now, everyone is working in silos.',
        source: 'Rural GP',
        theme: 'Coordination'
      },
      {
        quote: 'The data exists, but nobody is connecting the dots across the region.',
        source: 'Health Service Manager',
        theme: 'Data Intelligence'
      },
      {
        quote: 'RWAV is trusted by everyone—they should be leading this coordination.',
        source: 'Community Health Worker',
        theme: 'Trust & Leadership'
      }
    ];
  }
  
  return quotes.map(q => ({
    quote: q.quote || q.text || '',
    source: q.source || q.attribution || 'Anonymous',
    theme: q.theme || q.category || ''
  }));
}

/**
 * Transform community data
 */
function transformCommunity(community) {
  return {
    name: community.name || '',
    classification: community.classification || community.type || '',
    population: community.population || 0,
    focusAreas: community.focusAreas || community.priorities || [],
    strengths: community.strengths || [],
    challenges: community.challenges || [],
    coordinates: community.coordinates || community.location || { lat: -37, lng: 144 }
  };
}

/**
 * Transform financial strategy
 */
function transformFinancialStrategy(strategy) {
  if (!strategy) {
    return {
      targetRange: '25-30%',
      revenueStreams: []
    };
  }
  
  return {
    targetRange: strategy.targetRange || strategy.target || '25-30%',
    revenueStreams: (strategy.revenueStreams || []).map(stream => ({
      name: stream.name || stream.title || '',
      target: stream.target || stream.percentage || '',
      description: stream.description || ''
    }))
  };
}

/**
 * Transform timeline data
 */
function transformTimeline(timeline) {
  if (!timeline) {
    return {
      year1: { title: 'Foundation Building (2026)', milestones: [] },
      year2: { title: 'Coalition Development (2027)', milestones: [] },
      year3: { title: 'System Integration (2028)', milestones: [] },
      year4: { title: 'Leadership Consolidation (2029)', milestones: [] },
      year5: { title: 'Sustainable Impact (2030)', milestones: [] }
    };
  }
  
  return {
    year1: transformYear(timeline.year1 || timeline['2026']),
    year2: transformYear(timeline.year2 || timeline['2027']),
    year3: transformYear(timeline.year3 || timeline['2028']),
    year4: transformYear(timeline.year4 || timeline['2029']),
    year5: transformYear(timeline.year5 || timeline['2030'])
  };
}

/**
 * Transform year data
 */
function transformYear(year) {
  if (!year) {
    return { title: '', milestones: [] };
  }
  
  return {
    title: year.title || year.name || '',
    milestones: year.milestones || year.activities || []
  };
}

/**
 * Create fallback data structure
 */
function createFallbackData() {
  return {
    EXECUTIVE_SUMMARY: {
      currentState: 'Loading strategic plan data...',
      futureVision: 'Loading strategic plan data...',
      evidenceSummary: 'Loading strategic plan data...',
      requiredDecisions: [],
      postApprovalActions: []
    },
    THREE_PILLARS: {
      doers: { id: 'doers', title: 'DOERS', subtitle: '', objective: '', icon: 'fa-bullseye', initiatives: [], successMetrics: [] },
      drivers: { id: 'drivers', title: 'DRIVERS', subtitle: '', objective: '', icon: 'fa-rocket', initiatives: [], successMetrics: [] },
      enablers: { id: 'enablers', title: 'ENABLERS', subtitle: '', objective: '', icon: 'fa-cogs', initiatives: [], successMetrics: [] }
    },
    EVIDENCE_BASE: {
      surveyStats: {},
      communityWillingness: [],
      stakeholderQuotes: []
    },
    PILOT_PROGRAM: {
      overview: { purpose: '', timeline: '', investment: '' },
      communities: []
    },
    FINANCIAL_STRATEGY: {
      targetRange: '25-30%',
      revenueStreams: []
    },
    IMPLEMENTATION_TIMELINE: {
      year1: { title: '', milestones: [] },
      year2: { title: '', milestones: [] },
      year3: { title: '', milestones: [] },
      year4: { title: '', milestones: [] },
      year5: { title: '', milestones: [] }
    }
  };
}

// Auto-load data when script is included
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadStrategicData);
} else {
  loadStrategicData();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadStrategicData, transformData };
}
