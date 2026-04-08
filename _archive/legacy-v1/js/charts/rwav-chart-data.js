/**
 * RWAV Strategic Plan - Chart Data Arrays
 * Ready-to-use data structures for Chart.js visualizations
 * Australian English spelling throughout
 */

// ============================================================================
// SURVEY INSIGHTS VISUALISATIONS
// ============================================================================

/**
 * Community Willingness to Contribute - Horizontal Bar Chart
 */
export const communityWillingnessChartData = {
  type: 'horizontalBar',
  data: {
    labels: [
      'Talk to family & friends about health workforce',
      'Advocate for funding & policy changes',
      'Pursue a career in health care',
      'Participate in local health worker program',
      'Volunteer to support health workforce',
      'Donate to organisations',
      'Host community awareness event',
      'Not willing to do anything'
    ],
    datasets: [{
      label: 'Percentage Willing (%)',
      data: [65, 50, 40, 38, 35, 25, 20, 5],
      backgroundColor: [
        '#3498DB', '#3498DB', '#9B59B6', '#9B59B6', 
        '#9B59B6', '#27AE60', '#3498DB', '#95A5A6'
      ],
      borderColor: 'rgba(255, 255, 255, 0.8)',
      borderWidth: 2
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Community Willingness to Contribute (n=120)',
        font: { size: 18, weight: 'bold', family: 'Segoe UI' }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.x}% of respondents`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 70,
        ticks: {
          callback: (value) => `${value}%`
        },
        title: {
          display: true,
          text: 'Percentage of Respondents'
        }
      }
    }
  }
};

/**
 * Key Survey Statistics - Stat Cards Data
 */
export const surveyStatCards = [
  {
    id: 'coordination_barrier',
    value: 91,
    unit: '%',
    label: 'See poor coordination as significant barrier',
    color: '#E74C3C',
    icon: '⚠️',
    insight: 'Overwhelming mandate for coordination leadership',
    trend: 'critical'
  },
  {
    id: 'trust_rwa',
    value: 74,
    unit: '%',
    label: 'Trust Rural Workforce Agencies',
    color: '#27AE60',
    icon: '✓',
    insight: 'Strong credibility foundation',
    trend: 'positive'
  },
  {
    id: 'coordination_impact',
    value: 66,
    unit: '%',
    label: 'Believe coordination solves majority of problems',
    color: '#3498DB',
    icon: '💡',
    insight: 'Clear market opportunity',
    trend: 'opportunity'
  },
  {
    id: 'partnerships_positive',
    value: 92,
    unit: '%',
    label: 'See partnerships as having positive impact',
    color: '#27AE60',
    icon: '👥',
    insight: 'Willingness to invest in coordination',
    trend: 'positive'
  },
  {
    id: 'community_input_barrier',
    value: 72,
    unit: '%',
    label: 'Lack of community input is barrier',
    color: '#F39C12',
    icon: '🔔',
    insight: 'Demand for community-centred planning',
    trend: 'action-required'
  },
  {
    id: 'willing_contribute',
    value: 95,
    unit: '%',
    label: 'Willing to contribute to solutions',
    color: '#27AE60',
    icon: '❤️',
    insight: 'Extraordinary engagement readiness',
    trend: 'positive'
  }
];

// ============================================================================
// THREE PILLARS VISUALISATION
// ============================================================================

/**
 * Pillar Success Metrics - Radar Chart Comparison
 */
export const pillarMetricsRadarData = {
  type: 'radar',
  data: {
    labels: [
      'Workforce Retention',
      'Planning Accuracy',
      'Cultural Safety',
      'Policy Influence',
      'Multi-Regional Partnerships',
      'Cross-Sector Collaboration',
      'Non-Govt Revenue',
      'Stakeholder Satisfaction'
    ],
    datasets: [
      {
        label: 'DOERS',
        data: [15, 25, 100, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(22, 160, 133, 0.2)',
        borderColor: '#16A085',
        borderWidth: 2,
        pointBackgroundColor: '#16A085'
      },
      {
        label: 'DRIVERS',
        data: [0, 0, 0, 60, 80, 20, 0, 0],
        backgroundColor: 'rgba(41, 128, 185, 0.2)',
        borderColor: '#2980B9',
        borderWidth: 2,
        pointBackgroundColor: '#2980B9'
      },
      {
        label: 'ENABLERS',
        data: [0, 0, 0, 0, 0, 0, 27.5, 90],
        backgroundColor: 'rgba(230, 126, 34, 0.2)',
        borderColor: '#E67E22',
        borderWidth: 2,
        pointBackgroundColor: '#E67E22'
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { size: 14, family: 'Segoe UI' }
        }
      },
      title: {
        display: true,
        text: 'Three-Pillar Success Metrics Framework',
        font: { size: 18, weight: 'bold' }
      }
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20
        }
      }
    }
  }
};

// ============================================================================
// PILOT PROGRAM VISUALISATION
// ============================================================================

/**
 * Pilot Community Budget Allocation - Pie Chart
 */
export const pilotBudgetPieData = {
  type: 'doughnut',
  data: {
    labels: [
      'Community Engagement (25%)',
      'Platform Development (30%)',
      'Service Delivery (20%)',
      'Evaluation (15%)',
      'Cultural Safety (10%)'
    ],
    datasets: [{
      data: [25, 30, 20, 15, 10],
      backgroundColor: [
        '#3498DB',
        '#9B59B6',
        '#27AE60',
        '#F39C12',
        '#E74C3C'
      ],
      borderColor: '#FFFFFF',
      borderWidth: 3
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          font: { size: 12, family: 'Segoe UI' },
          padding: 15
        }
      },
      title: {
        display: true,
        text: 'Pilot Program Resource Allocation',
        font: { size: 16, weight: 'bold' }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            return `${label}: ${value}%`;
          }
        }
      }
    }
  }
};

/**
 * Pilot Community Characteristics - Comparison Table Data
 */
export const pilotCommunityComparison = {
  headers: ['Characteristic', 'Bendigo', 'Gippsland Lakes', 'Mallee'],
  rows: [
    ['Classification', 'Inner Regional', 'Outer Regional', 'Remote'],
    ['Population', '~100,000', '~25,000', '~8,000'],
    ['First Nations', 'Dja Dja Wurrung', 'Gunaikurnai', 'Wergaia'],
    ['Key Strength', 'University presence', 'Community identity', 'Resilience'],
    ['Main Challenge', 'Melbourne competition', 'Geographic isolation', 'Distance'],
    ['Primary Focus', 'Data intelligence', 'Community-led planning', 'Early warning'],
    ['Timeline Priority', 'Year 1-2', 'Year 1-3', 'Year 2-4']
  ],
  colours: {
    bendigo: '#3498DB',
    gippsland: '#27AE60',
    mallee: '#E67E22'
  }
};

/**
 * Victoria Map - Pilot Region Coordinates
 */
export const victoriaMapData = {
  centre: [-37.4713, 144.7852], // Melbourne as reference
  zoom: 7,
  pilotRegions: [
    {
      id: 'bendigo',
      name: 'Bendigo Region',
      coordinates: [-36.7570, 144.2794],
      color: '#3498DB',
      population: 100000,
      classification: 'Inner Regional'
    },
    {
      id: 'gippsland',
      name: 'Gippsland Lakes',
      coordinates: [-37.8167, 147.6333],
      color: '#27AE60',
      population: 25000,
      classification: 'Outer Regional'
    },
    {
      id: 'mallee',
      name: 'Mallee Region',
      coordinates: [-35.1167, 142.1833],
      color: '#E67E22',
      population: 8000,
      classification: 'Remote'
    }
  ]
};

// ============================================================================
// FINANCIAL STRATEGY VISUALISATION
// ============================================================================

/**
 * Revenue Diversification Target - Gauge Chart
 */
export const revenueTargetGaugeData = {
  type: 'doughnut',
  data: {
    labels: ['Target Achieved', 'Remaining'],
    datasets: [{
      data: [27.5, 72.5], // 27.5% midpoint of 25-30% target
      backgroundColor: ['#27AE60', '#ECF0F1'],
      borderWidth: 0
    }]
  },
  options: {
    rotation: -90,
    circumference: 180,
    cutout: '75%',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Revenue Diversification Target by 2030',
        font: { size: 18, weight: 'bold' }
      },
      tooltip: { enabled: false },
      centerText: {
        display: true,
        text: '25-30%',
        font: { size: 32, weight: 'bold', family: 'Segoe UI' }
      }
    }
  }
};

/**
 * Revenue Streams - Stacked Bar Chart
 */
export const revenueStreamsStackedData = {
  type: 'bar',
  data: {
    labels: ['2026', '2027', '2028', '2029', '2030'],
    datasets: [
      {
        label: 'Data Intelligence (10-12%)',
        data: [1, 3, 7, 10, 12],
        backgroundColor: '#3498DB',
        borderColor: '#2980B9',
        borderWidth: 1
      },
      {
        label: 'Coordination Admin (8-10%)',
        data: [1, 4, 6, 8, 10],
        backgroundColor: '#27AE60',
        borderColor: '#229954',
        borderWidth: 1
      },
      {
        label: 'Strategic Consultation (5-7%)',
        data: [1, 2, 4, 5, 6],
        backgroundColor: '#9B59B6',
        borderColor: '#8E44AD',
        borderWidth: 1
      },
      {
        label: 'Innovation Partnerships (2-3%)',
        data: [0, 1, 1, 2, 2.5],
        backgroundColor: '#E67E22',
        borderColor: '#D35400',
        borderWidth: 1
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { size: 12, family: 'Segoe UI' },
          padding: 10
        }
      },
      title: {
        display: true,
        text: 'Revenue Stream Growth Projection (% of total revenue)',
        font: { size: 16, weight: 'bold' }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y}%`
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Year'
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        max: 35,
        ticks: {
          callback: (value) => `${value}%`
        },
        title: {
          display: true,
          text: 'Non-Government Revenue (%)'
        }
      }
    }
  }
};

/**
 * Revenue Stream Details - Table Data
 */
export const revenueStreamDetails = [
  {
    id: 'data_intelligence',
    name: 'Data Intelligence Services',
    target: '10-12%',
    timeToRevenue: '12-18 months',
    complexity: 'High',
    risk: 'Low',
    examples: [
      'Community Map subscriptions',
      'Predictive workforce analytics',
      'Custom research for policy'
    ],
    color: '#3498DB'
  },
  {
    id: 'coordination_admin',
    name: 'Coordination Administration',
    target: '8-10%',
    timeToRevenue: '6-12 months',
    complexity: 'Medium',
    risk: 'Low',
    examples: [
      'Multi-site supervision admin',
      'Partnership facilitation',
      'Coalition secretariat services'
    ],
    color: '#27AE60'
  },
  {
    id: 'strategic_consultation',
    name: 'Strategic Consultation',
    target: '5-7%',
    timeToRevenue: '3-6 months',
    complexity: 'Low',
    risk: 'Medium',
    examples: [
      'Health system design',
      'Workforce strategy development',
      'Cultural safety expertise'
    ],
    color: '#9B59B6'
  },
  {
    id: 'innovation_partnerships',
    name: 'Innovation Partnerships',
    target: '2-3%',
    timeToRevenue: '18-24 months',
    complexity: 'Medium',
    risk: 'High',
    examples: [
      'Tech company partnerships',
      'IMG pathway sponsorship',
      'Corporate foundation grants'
    ],
    color: '#E67E22'
  }
];

// ============================================================================
// IMPLEMENTATION TIMELINE VISUALISATION
// ============================================================================

/**
 * 5-Year Timeline - Gantt Chart Data
 */
export const implementationGanttData = {
  years: [
    {
      year: 2026,
      title: 'Foundation Building',
      color: '#3498DB',
      quarters: [
        {
          q: 'Q1',
          milestone: 'Board Approval & Comms',
          activities: ['Strategic direction endorsed', 'Pilot regions announced'],
          completion: 0
        },
        {
          q: 'Q2',
          milestone: 'Community Map Beta',
          activities: ['Platform development', 'Pilot onboarding'],
          completion: 0
        },
        {
          q: 'Q3',
          milestone: 'Partnership Agreements',
          activities: ['ACCHO partnership', 'PHN collaboration'],
          completion: 0
        },
        {
          q: 'Q4',
          milestone: 'Cultural Safety Protocols',
          activities: ['Leadership training', 'Protocol docs'],
          completion: 0
        }
      ],
      keyDeliverables: [
        'Pilot program launched',
        'Community Map live (beta)',
        'Cultural safety operational',
        'First consultation clients'
      ]
    },
    {
      year: 2027,
      title: 'Coalition Development',
      color: '#27AE60',
      quarters: [
        {
          q: 'Q1',
          milestone: 'Coalition Establishment',
          activities: ['Charter developed', 'Founding members'],
          completion: 0
        },
        {
          q: 'Q2',
          milestone: 'Data Services Launch',
          activities: ['Community Map full release', 'Client acquisition'],
          completion: 0
        },
        {
          q: 'Q3',
          milestone: 'Retention Programs',
          activities: ['Excellence Hubs operational', 'Peer networks'],
          completion: 0
        },
        {
          q: 'Q4',
          milestone: '10% Revenue Milestone',
          activities: ['Milestone celebrated', 'Model validated'],
          completion: 0
        }
      ],
      keyDeliverables: [
        'Coalition operational',
        '10% revenue achieved',
        'Pilot evaluation complete',
        'Statewide plan approved'
      ]
    },
    {
      year: 2028,
      title: 'System Integration',
      color: '#9B59B6',
      quarters: [
        {
          q: 'Q1-Q2',
          milestone: 'Statewide Deployment',
          activities: ['Community Map rollout', 'Regional training'],
          completion: 0
        },
        {
          q: 'Q3',
          milestone: 'Policy Influence',
          activities: ['Reform campaign', 'Coalition advocacy'],
          completion: 0
        },
        {
          q: 'Q4',
          milestone: '15% Revenue Milestone',
          activities: ['Innovation partnerships', 'Coordination contracts'],
          completion: 0
        }
      ],
      keyDeliverables: [
        'Statewide coverage',
        '15% revenue achieved',
        'First policy reform',
        'Multi-regional partnerships scaled'
      ]
    },
    {
      year: 2029,
      title: 'Leadership Consolidation (Part 1)',
      color: '#E67E22',
      focus: [
        'Regional coordination leadership established',
        'Sustainable revenue progress (20-25%)',
        'Impact measurement frameworks deployed'
      ],
      keyDeliverables: [
        '20-25% revenue achieved',
        '2+ policy reforms influenced',
        'National recognition emerging'
      ]
    },
    {
      year: 2030,
      title: 'Leadership Consolidation (Part 2)',
      color: '#E74C3C',
      focus: [
        'Target revenue achieved (25-30%)',
        'System change documented and celebrated',
        'Strategic plan 2031-2035 developed'
      ],
      keyDeliverables: [
        '25-30% sustainable revenue',
        '3+ policy reforms influenced',
        'National best practice model',
        'Next phase strategic plan'
      ]
    }
  ]
};

/**
 * Milestone Progress Tracker - Horizontal Timeline
 */
export const milestoneProgressData = {
  milestones: [
    { id: 1, year: 2026, title: 'Foundation', status: 'pending', completion: 0 },
    { id: 2, year: 2027, title: 'Coalition', status: 'pending', completion: 0 },
    { id: 3, year: 2028, title: 'Integration', status: 'pending', completion: 0 },
    { id: 4, year: 2029, title: 'Consolidation 1', status: 'pending', completion: 0 },
    { id: 5, year: 2030, title: 'Consolidation 2', status: 'pending', completion: 0 }
  ],
  colours: {
    pending: '#95A5A6',
    inProgress: '#F39C12',
    complete: '#27AE60'
  }
};

// ============================================================================
// EXPORT ALL DATA
// ============================================================================

export default {
  // Survey data
  communityWillingnessChartData,
  surveyStatCards,
  
  // Three pillars
  pillarMetricsRadarData,
  
  // Pilot program
  pilotBudgetPieData,
  pilotCommunityComparison,
  victoriaMapData,
  
  // Financial strategy
  revenueTargetGaugeData,
  revenueStreamsStackedData,
  revenueStreamDetails,
  
  // Implementation timeline
  implementationGanttData,
  milestoneProgressData
};
