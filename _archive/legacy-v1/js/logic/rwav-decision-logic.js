/**
 * RWAV Strategic Workshop - Decision Logic Framework
 * Maps Board/C-Suite decisions to consequences, opportunities, and interdependencies
 * 
 * This framework powers the real-time impact modelling in VERSION 2
 */

// ============================================================================
// DECISION CATEGORIES & OPTIONS
// ============================================================================

export const decisionCategories = {
  strategicDirection: {
    id: 'strategic_direction',
    title: 'Strategic Direction',
    description: 'Endorse the three-pillar transformation framework?',
    options: [
      {
        id: 'approve_full',
        label: 'Approve Full Transformation',
        impact: 'high',
        consequences: ['enables_all_pillars', 'requires_cultural_shift', 'needs_board_commitment'],
        opportunities: ['market_leadership', 'sustainable_future', 'policy_influence']
      },
      {
        id: 'approve_phased',
        label: 'Approve Phased Approach (prioritise one pillar first)',
        impact: 'medium',
        consequences: ['delays_full_transformation', 'reduces_risk', 'limits_immediate_impact'],
        opportunities: ['learn_and_adapt', 'test_market_response', 'build_confidence']
      },
      {
        id: 'defer',
        label: 'Defer Decision (more consultation needed)',
        impact: 'critical',
        consequences: ['loses_momentum', 'stakeholder_disappointment', 'competitor_advantage'],
        opportunities: ['refine_strategy', 'build_consensus']
      }
    ],
    weight: 10, // Critical decision
    dependencies: [] // No prerequisites
  },

  pilotProgram: {
    id: 'pilot_program',
    title: 'Pilot Program',
    description: 'Approve three-region pilot implementation?',
    options: [
      {
        id: 'approve_three',
        label: 'Approve All Three Regions (Bendigo, Gippsland, Mallee)',
        impact: 'high',
        consequences: ['resource_intensive', 'comprehensive_evidence', 'year_1_stretched'],
        opportunities: ['diverse_learnings', 'statewide_credibility', 'early_wins_across_contexts'],
        resourceRequirement: {
          staffing: '3.3 FTE',
          budget: 'Full pilot allocation',
          timeline: '18 months'
        }
      },
      {
        id: 'approve_two',
        label: 'Approve Two Regions (recommend: Bendigo + one other)',
        impact: 'medium',
        consequences: ['reduced_diversity', 'faster_iteration', 'limited_remote_insights'],
        opportunities: ['resource_efficiency', 'deeper_engagement', 'quicker_learning'],
        resourceRequirement: {
          staffing: '2.3 FTE',
          budget: '65% of full pilot',
          timeline: '15 months'
        }
      },
      {
        id: 'approve_one',
        label: 'Approve Single Region (Bendigo recommended)',
        impact: 'low',
        consequences: ['narrow_evidence_base', 'scalability_questions', 'limited_board_confidence'],
        opportunities: ['deep_dive', 'minimal_risk', 'proof_of_concept'],
        resourceRequirement: {
          staffing: '1.5 FTE',
          budget: '40% of full pilot',
          timeline: '12 months'
        }
      },
      {
        id: 'defer_pilot',
        label: 'Defer Pilot (refine model first)',
        impact: 'critical',
        consequences: ['delays_transformation', 'stakeholder_frustration', 'theory_not_practice'],
        opportunities: ['perfect_the_model', 'secure_more_funding']
      }
    ],
    weight: 9,
    dependencies: ['strategic_direction']
  },

  financialStrategy: {
    id: 'financial_strategy',
    title: 'Financial Diversification',
    description: 'Support revenue diversification targeting 25-30% by 2030?',
    options: [
      {
        id: 'approve_aggressive',
        label: 'Approve Aggressive Target (30%+ by 2030)',
        impact: 'high',
        consequences: ['commercial_pressure', 'mission_tension_risk', 'faster_independence'],
        opportunities: ['financial_autonomy', 'market_leadership', 'attract_talent'],
        revenueImpact: {
          year1: '5%',
          year3: '20%',
          year5: '32%'
        }
      },
      {
        id: 'approve_moderate',
        label: 'Approve Moderate Target (25-30% as proposed)',
        impact: 'medium',
        consequences: ['balanced_approach', 'sustainable_pace', 'government_dependency_continues'],
        opportunities: ['ethical_revenue_focus', 'stakeholder_trust', 'mission_alignment'],
        revenueImpact: {
          year1: '3%',
          year3: '15%',
          year5: '27.5%'
        }
      },
      {
        id: 'approve_conservative',
        label: 'Approve Conservative Target (15-20% by 2030)',
        impact: 'low',
        consequences: ['limited_autonomy', 'slower_transformation', 'government_dependency'],
        opportunities: ['low_risk', 'maintain_focus', 'gradual_culture_shift'],
        revenueImpact: {
          year1: '2%',
          year3: '10%',
          year5: '17.5%'
        }
      },
      {
        id: 'reject_diversification',
        label: 'Reject Revenue Diversification (maintain government funding model)',
        impact: 'critical',
        consequences: ['strategic_contradiction', 'transformation_unsustainable', 'continued_vulnerability'],
        opportunities: ['focus_on_core', 'avoid_commercial_risk']
      }
    ],
    weight: 8,
    dependencies: ['strategic_direction']
  },

  culturalSafety: {
    id: 'cultural_safety',
    title: 'Cultural Safety Mandate',
    description: 'Approve mandatory ACCHO leadership in all initiatives?',
    options: [
      {
        id: 'approve_mandatory',
        label: 'Approve Mandatory ACCHO Leadership (as proposed)',
        impact: 'high',
        consequences: ['genuine_partnership', 'slower_initial_decisions', 'community_trust_built'],
        opportunities: ['authentic_self_determination', 'national_best_practice', 'improved_outcomes']
      },
      {
        id: 'approve_advisory',
        label: 'Approve Advisory ACCHO Role (not mandatory)',
        impact: 'medium',
        consequences: ['tokenistic_risk', 'faster_decisions', 'trust_deficit'],
        opportunities: ['flexibility', 'gradual_partnership_building']
      },
      {
        id: 'defer_cultural',
        label: 'Defer Decision (consult ACCHO partners first)',
        impact: 'low',
        consequences: ['delays_pilot', 'demonstrates_respect', 'missed_timeline'],
        opportunities: ['co_design_mandate', 'stronger_foundation']
      }
    ],
    weight: 10, // Non-negotiable from strategic perspective
    dependencies: [] // Should be approved regardless
  },

  implementationTimeline: {
    id: 'implementation_timeline',
    title: 'Implementation Timeline',
    description: 'Authorise immediate Phase 1 commencement?',
    options: [
      {
        id: 'approve_immediate',
        label: 'Approve Immediate Start (Q1 2026)',
        impact: 'high',
        consequences: ['fast_market_entry', 'operational_pressure', 'stakeholder_confidence'],
        opportunities: ['momentum_maintained', 'early_learnings', 'competitive_advantage'],
        timeline: {
          phase1Start: '2026-01-01',
          pilotLaunch: '2026-07-01',
          year2Milestone: '2027-12-31'
        }
      },
      {
        id: 'approve_delayed',
        label: 'Approve Delayed Start (Q3 2026)',
        impact: 'medium',
        consequences: ['preparation_time', 'momentum_loss', 'stakeholder_questions'],
        opportunities: ['thorough_planning', 'team_readiness', 'risk_mitigation'],
        timeline: {
          phase1Start: '2026-07-01',
          pilotLaunch: '2027-01-01',
          year2Milestone: '2028-06-30'
        }
      },
      {
        id: 'approve_staged',
        label: 'Approve Staged Rollout (pilot first, then decision on full transformation)',
        impact: 'low',
        consequences: ['uncertainty', 'limited_commitment', 'talent_retention_risk'],
        opportunities: ['evidence_based_decision', 'exit_option', 'adaptive_approach'],
        timeline: {
          phase1Start: '2026-01-01',
          pilotLaunch: '2026-07-01',
          decisionPoint: '2028-01-01'
        }
      }
    ],
    weight: 7,
    dependencies: ['strategic_direction', 'pilot_program']
  }
};

// ============================================================================
// DECISION INTERDEPENDENCIES & IMPACT RULES
// ============================================================================

/**
 * Impact calculation based on decision combinations
 * Returns: { score, alerts, opportunities, timeline, resources }
 */
export function calculateDecisionImpact(decisions) {
  const impacts = {
    strategicCoherence: 100,
    resourceFeasibility: 100,
    stakeholderAlignment: 100,
    timelineFeasibility: 100,
    overallScore: 0,
    alerts: [],
    opportunities: [],
    timelineAdjustments: {},
    resourceRequirements: {}
  };

  // Rule 1: Strategic Direction drives everything
  if (decisions.strategic_direction === 'defer') {
    impacts.alerts.push({
      severity: 'critical',
      message: 'Deferring strategic direction blocks all other decisions',
      affectedAreas: ['pilot_program', 'financial_strategy', 'implementation_timeline']
    });
    impacts.strategicCoherence -= 50;
  }

  // Rule 2: Pilot Program & Resources
  if (decisions.pilot_program === 'approve_three' && decisions.implementation_timeline === 'approve_immediate') {
    impacts.alerts.push({
      severity: 'high',
      message: 'Three-region pilot with immediate start requires significant upfront resourcing',
      affectedAreas: ['staffing', 'budget', 'operational_capacity']
    });
    impacts.resourceFeasibility -= 25;
    impacts.timelineAdjustments.year1 = 'Extended to 18 months due to pilot intensity';
  } else if (decisions.pilot_program === 'approve_three') {
    impacts.opportunities.push({
      type: 'strategic',
      message: 'Three diverse regions provide comprehensive evidence for Board confidence in statewide rollout',
      pillar: 'all'
    });
  }

  // Rule 3: Financial Strategy & Transformation Sustainability
  if (decisions.strategic_direction === 'approve_full' && decisions.financial_strategy === 'reject_diversification') {
    impacts.alerts.push({
      severity: 'critical',
      message: 'Full transformation requires revenue diversification for sustainability',
      affectedAreas: ['financial_viability', 'strategic_coherence']
    });
    impacts.strategicCoherence -= 40;
  }

  if (decisions.financial_strategy === 'approve_aggressive' && decisions.pilot_program === 'approve_one') {
    impacts.alerts.push({
      severity: 'medium',
      message: 'Aggressive revenue targets difficult to test with single-region pilot',
      affectedAreas: ['revenue_validation', 'market_testing']
    });
    impacts.resourceFeasibility -= 15;
  }

  // Rule 4: Cultural Safety Non-Negotiable
  if (decisions.cultural_safety !== 'approve_mandatory') {
    impacts.alerts.push({
      severity: 'high',
      message: 'ACCHO advisory role (not leadership) risks tokenism and undermines trust',
      affectedAreas: ['community_relations', 'strategic_integrity', 'first_nations_outcomes']
    });
    impacts.stakeholderAlignment -= 30;
  } else {
    impacts.opportunities.push({
      type: 'strategic',
      message: 'Mandatory ACCHO leadership positions RWAV as national best practice in cultural safety',
      pillar: 'doers'
    });
    impacts.stakeholderAlignment += 10;
  }

  // Rule 5: Timeline & Momentum
  if (decisions.implementation_timeline === 'approve_delayed') {
    impacts.alerts.push({
      severity: 'medium',
      message: 'Delayed start risks losing stakeholder momentum from consultation process',
      affectedAreas: ['stakeholder_confidence', 'competitive_position']
    });
    impacts.stakeholderAlignment -= 20;
  } else if (decisions.implementation_timeline === 'approve_immediate') {
    impacts.opportunities.push({
      type: 'operational',
      message: 'Immediate start capitalises on stakeholder enthusiasm and consultation momentum',
      pillar: 'enablers'
    });
  }

  // Rule 6: Phased Approach Coherence
  if (decisions.strategic_direction === 'approve_phased' && decisions.pilot_program === 'approve_three') {
    impacts.alerts.push({
      severity: 'low',
      message: 'Phased strategic approach with three-region pilot may send mixed signals',
      affectedAreas: ['strategic_clarity']
    });
    impacts.strategicCoherence -= 10;
  }

  // Rule 7: Revenue & Pilot Alignment
  if (decisions.financial_strategy === 'approve_moderate' && decisions.pilot_program === 'approve_three') {
    impacts.opportunities.push({
      type: 'financial',
      message: 'Three regions provide diverse testing ground for revenue stream validation',
      pillar: 'enablers'
    });
    impacts.resourceFeasibility += 15;
  }

  // Calculate overall score
  impacts.overallScore = Math.round(
    (impacts.strategicCoherence * 0.3 +
     impacts.resourceFeasibility * 0.25 +
     impacts.stakeholderAlignment * 0.25 +
     impacts.timelineFeasibility * 0.2) / 4
  );

  // Add strategic opportunities based on high-coherence combinations
  if (impacts.overallScore >= 85) {
    impacts.opportunities.push({
      type: 'strategic',
      message: 'This combination of decisions creates a compelling, coherent transformation narrative',
      pillar: 'all'
    });
  }

  return impacts;
}

// ============================================================================
// PILLAR-SPECIFIC IMPACTS
// ============================================================================

export function calculatePillarImpact(decisions) {
  const pillarScores = {
    doers: 0,
    drivers: 0,
    enablers: 0
  };

  // DOERS: Impacted by pilot decisions and cultural safety
  if (decisions.pilot_program === 'approve_three') {
    pillarScores.doers += 30;
  } else if (decisions.pilot_program === 'approve_two') {
    pillarScores.doers += 20;
  } else if (decisions.pilot_program === 'approve_one') {
    pillarScores.doers += 10;
  }

  if (decisions.cultural_safety === 'approve_mandatory') {
    pillarScores.doers += 25;
  } else if (decisions.cultural_safety === 'approve_advisory') {
    pillarScores.doers += 10;
  }

  // DRIVERS: Impacted by strategic direction and timeline
  if (decisions.strategic_direction === 'approve_full') {
    pillarScores.drivers += 35;
  } else if (decisions.strategic_direction === 'approve_phased') {
    pillarScores.drivers += 20;
  }

  if (decisions.implementation_timeline === 'approve_immediate') {
    pillarScores.drivers += 20;
  } else if (decisions.implementation_timeline === 'approve_delayed') {
    pillarScores.drivers += 10;
  }

  // ENABLERS: Impacted by financial strategy and strategic direction
  if (decisions.financial_strategy === 'approve_aggressive') {
    pillarScores.enablers += 30;
  } else if (decisions.financial_strategy === 'approve_moderate') {
    pillarScores.enablers += 25;
  } else if (decisions.financial_strategy === 'approve_conservative') {
    pillarScores.enablers += 15;
  }

  if (decisions.strategic_direction === 'approve_full') {
    pillarScores.enablers += 25;
  } else if (decisions.strategic_direction === 'approve_phased') {
    pillarScores.enablers += 15;
  }

  return pillarScores;
}

// ============================================================================
// RESOURCE REQUIREMENT CALCULATOR
// ============================================================================

export function calculateResourceRequirements(decisions) {
  const resources = {
    staffing: {
      year1: 0,
      year2: 0,
      year3: 0
    },
    budget: {
      year1: 0,
      year2: 0,
      year3: 0
    },
    criticalHires: [],
    infrastructureNeeds: []
  };

  // Pilot program staffing
  if (decisions.pilot_program === 'approve_three') {
    resources.staffing.year1 += 3.3;
    resources.criticalHires.push('Pilot Program Coordinator', 'Community Engagement Specialists (3x)', 'Data Analyst');
  } else if (decisions.pilot_program === 'approve_two') {
    resources.staffing.year1 += 2.3;
    resources.criticalHires.push('Pilot Program Coordinator', 'Community Engagement Specialists (2x)');
  } else if (decisions.pilot_program === 'approve_one') {
    resources.staffing.year1 += 1.5;
    resources.criticalHires.push('Pilot Program Coordinator', 'Community Engagement Specialist');
  }

  // Cultural safety resourcing
  if (decisions.cultural_safety === 'approve_mandatory') {
    resources.staffing.year1 += 0.5;
    resources.criticalHires.push('Cultural Safety Advisor & First Nations Liaison');
  }

  // Financial strategy resourcing
  if (decisions.financial_strategy === 'approve_aggressive' || decisions.financial_strategy === 'approve_moderate') {
    resources.staffing.year1 += 1.0;
    resources.criticalHires.push('Business Development Manager', 'Data Intelligence Lead');
    resources.infrastructureNeeds.push('Community Map Platform Development', 'CRM System', 'Data Analytics Infrastructure');
  }

  // Timeline impacts
  if (decisions.implementation_timeline === 'approve_immediate') {
    resources.budget.year1 *= 1.15; // 15% premium for immediate start
    resources.infrastructureNeeds.push('Rapid onboarding systems');
  }

  return resources;
}

// ============================================================================
// WORKSHOP FACILITATION HELPERS
// ============================================================================

/**
 * Suggested decision sequence for workshop
 */
export const workshopSequence = [
  {
    order: 1,
    category: 'cultural_safety',
    rationale: 'Non-negotiable foundation - decide first to set tone',
    timeAllocation: '15 minutes'
  },
  {
    order: 2,
    category: 'strategic_direction',
    rationale: 'Core direction drives all other decisions',
    timeAllocation: '30 minutes'
  },
  {
    order: 3,
    category: 'pilot_program',
    rationale: 'Concrete implementation testing approach',
    timeAllocation: '25 minutes'
  },
  {
    order: 4,
    category: 'financial_strategy',
    rationale: 'Sustainability model aligned with transformation scope',
    timeAllocation: '25 minutes'
  },
  {
    order: 5,
    category: 'implementation_timeline',
    rationale: 'Final decision based on resource/risk assessment',
    timeAllocation: '20 minutes'
  }
];

/**
 * Decision validation checklist
 */
export const validationChecklist = [
  {
    check: 'strategic_coherence',
    question: 'Do these decisions tell a coherent strategic story?',
    threshold: 80
  },
  {
    check: 'resource_feasibility',
    question: 'Are the resource requirements realistic given current capacity?',
    threshold: 75
  },
  {
    check: 'stakeholder_alignment',
    question: 'Will stakeholders see these decisions as responding to their input?',
    threshold: 85
  },
  {
    check: 'timeline_feasibility',
    question: 'Can we realistically achieve these milestones in the proposed timeframe?',
    threshold: 70
  }
];

export default {
  decisionCategories,
  calculateDecisionImpact,
  calculatePillarImpact,
  calculateResourceRequirements,
  workshopSequence,
  validationChecklist
};
