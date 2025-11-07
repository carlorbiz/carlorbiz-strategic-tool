// Auto-generated from rwav-strategic-data.json
// Generated: 2025-11-06
// DO NOT EDIT MANUALLY - Run transform-data-complete.py to regenerate

const STRATEGIC_PLAN_DATA = {
  "EXECUTIVE_SUMMARY": {
    "currentState": "RWAV currently operates as a government-funded workforce placement service, competing with other agencies for limited recruitment success. This model focuses on individual placements rather than systemic solutions, creates dependency on government funding cycles, limits strategic influence and cross-sector collaboration, and underutilises RWAV's unique neutral position and established relationships.",
    "futureVision": "The transformation positions RWAV as rural Victoria's trusted systems coordinator, using data intelligence and coalition leadership—leveraging the trust the community and stakeholders already have—to drive retention, workforce planning, and health system reform. This addresses the coordination crisis while establishing sustainable revenue streams aligned with stakeholder needs.",
    "evidence": "Survey data from 120 stakeholders reveals overwhelming support for coordination leadership.",
    "requiredDecisions": [
      {
        "id": "strategic_direction",
        "title": "Strategic Direction Approval",
        "description": "Endorse the three-pillar transformation framework (DOERS, DRIVERS, ENABLERS)",
        "priority": "CRITICAL",
        "dependencies": []
      },
      {
        "id": "pilot_program",
        "title": "Pilot Program Authorisation",
        "description": "Approve three-region pilot implementation with allocated resources (Bendigo, Gippsland Lakes, Mallee)",
        "priority": "CRITICAL",
        "dependencies": [
          "strategic_direction"
        ]
      },
      {
        "id": "financial_strategy",
        "title": "Financial Strategy Commitment",
        "description": "Support revenue diversification targeting 25-30% non-government funding by 2030",
        "priority": "HIGH",
        "dependencies": [
          "strategic_direction"
        ]
      },
      {
        "id": "cultural_safety",
        "title": "Cultural Safety Mandate",
        "description": "Approve mandatory ACCHO leadership requirements in all initiatives",
        "priority": "CRITICAL",
        "dependencies": []
      },
      {
        "id": "implementation_timeline",
        "title": "Implementation Timeline Authorisation",
        "description": "Authorise immediate commencement of Phase 1 foundation building (2026)",
        "priority": "HIGH",
        "dependencies": [
          "strategic_direction",
          "pilot_program"
        ]
      }
    ]
  },
  "THREE_PILLARS": {
    "doers": {
      "id": "doers",
      "title": "DOERS",
      "subtitle": "Frontline Impact Through Strategic Partnerships",
      "icon": "fa-users",
      "objective": "Deliver measurable workforce and health outcomes through coordinated partner networks rather than direct service delivery.",
      "initiatives": [
        {
          "name": "Retention Excellence Hubs",
          "description": "Multi-organisational coordination centres addressing community input barriers",
          "timeline": "Year 1-2",
          "impact": "high",
          "connections": []
        },
        {
          "name": "Community Map Platform",
          "description": "Real-time workforce intelligence system providing early warning and strategic planning capability",
          "timeline": "Year 1-3",
          "impact": "very high",
          "connections": []
        },
        {
          "name": "Cultural Safety Integration",
          "description": "Mandatory ACCHO leadership in all initiatives, addressing First Nations workforce priorities",
          "timeline": "Year 1 onwards",
          "impact": "medium",
          "connections": []
        },
        {
          "name": "Rural Health Innovation Partnerships",
          "description": "Facilitating the 92% who see health partnerships as positive impact",
          "timeline": "Year 2-5",
          "impact": "medium",
          "connections": []
        }
      ],
      "successMetrics": [
        {
          "metric": "15% increase in rural health workforce retention",
          "target": "15%"
        },
        {
          "metric": "25% improvement in workforce planning accuracy",
          "target": "25%"
        },
        {
          "metric": "100% cultural safety compliance",
          "target": "100%"
        }
      ]
    },
    "drivers": {
      "id": "drivers",
      "title": "DRIVERS",
      "subtitle": "Systems Change and Strategic Influence",
      "icon": "fa-trending-up",
      "objective": "Lead policy reform and systems coordination addressing root causes of rural health workforce challenges.",
      "initiatives": [
        {
          "name": "Rural Health Coalition Leadership",
          "description": "Convening cross-sector partnerships for systems reform",
          "timeline": "Year 2-5",
          "impact": "medium",
          "connections": []
        },
        {
          "name": "Evidence-Based Policy Advocacy",
          "description": "Using Community Map data for strategic government engagement",
          "timeline": "Year 2 onwards",
          "impact": "low",
          "connections": []
        },
        {
          "name": "Multi-Regional Coordination",
          "description": "Facilitating resource sharing and collaborative service delivery",
          "timeline": "Year 2-4",
          "impact": "medium",
          "connections": []
        },
        {
          "name": "Innovation Facilitation",
          "description": "Supporting technology adoption and service model innovation",
          "timeline": "Year 3-5",
          "impact": "low",
          "connections": []
        }
      ],
      "successMetrics": [
        {
          "metric": "3 major policy reforms influenced",
          "target": "3 reforms"
        },
        {
          "metric": "5 multi-regional partnerships established",
          "target": "5 partnerships"
        },
        {
          "metric": "20% increase in cross-sector collaboration",
          "target": "20%"
        }
      ]
    },
    "enablers": {
      "id": "enablers",
      "title": "ENABLERS",
      "subtitle": "Organisational Transformation and Sustainability",
      "icon": "fa-settings",
      "objective": "Build internal capability and financial sustainability to support coordination leadership role.",
      "initiatives": [
        {
          "name": "Revenue Diversification",
          "description": "Ethical revenue streams aligned with coordination mission",
          "timeline": "Year 1-5",
          "impact": "high",
          "connections": []
        },
        {
          "name": "Data Intelligence Capability",
          "description": "Advanced analytics and predictive modelling expertise",
          "timeline": "Year 1-3",
          "impact": "very high",
          "connections": []
        },
        {
          "name": "Partnership Infrastructure",
          "description": "Systems and processes for multi-organisational coordination",
          "timeline": "Year 1-4",
          "impact": "medium",
          "connections": []
        },
        {
          "name": "Cultural Transformation",
          "description": "From service delivery to strategic leadership organisational culture",
          "timeline": "Year 1-5",
          "impact": "medium",
          "connections": []
        }
      ],
      "successMetrics": [
        {
          "metric": "25-30% non-government revenue",
          "target": "27.5%"
        },
        {
          "metric": "90% stakeholder satisfaction with coordination services",
          "target": "90%"
        }
      ]
    }
  },
  "EVIDENCE_BASE": {
    "surveyStats": {
      "coordination_barrier": {
        "value": 91,
        "label": "See poor coordination as significant barrier",
        "indicator": "warning"
      },
      "trust_rwa": {
        "value": 74,
        "label": "Trust Rural Workforce Agencies (moderate-to-high)",
        "indicator": "check-circle"
      },
      "coordination_impact": {
        "value": 66,
        "label": "Believe coordination could solve majority of problems",
        "indicator": "lightbulb"
      },
      "partnerships_positive": {
        "value": 92,
        "label": "See health organisation partnerships as positive",
        "indicator": "users"
      },
      "community_input_barrier": {
        "value": 72,
        "label": "Cite lack of community input as barrier",
        "indicator": "alert-circle"
      },
      "willing_contribute": {
        "value": 95,
        "label": "Willing to contribute to workforce solutions",
        "indicator": "heart"
      }
    },
    "communityWillingness": [
      {
        "activity": "Talk to family and friends about health workforce importance",
        "percentage": 65
      },
      {
        "activity": "Advocate for funding and policy changes",
        "percentage": 50
      },
      {
        "activity": "Pursue a career in health care",
        "percentage": 40
      },
      {
        "activity": "Participate in local community health worker program",
        "percentage": 38
      },
      {
        "activity": "Volunteer to support the health workforce",
        "percentage": 35
      },
      {
        "activity": "Donate to organisations supporting health workforce",
        "percentage": 25
      },
      {
        "activity": "Host community event to raise awareness",
        "percentage": 20
      },
      {
        "activity": "Not willing to do anything",
        "percentage": 5
      }
    ],
    "stakeholderQuotes": [
      {
        "quote": "Health professionals need peers… Priority should be in supporting the building of one workforce that works across the various services in rural areas.",
        "attribution": "Stakeholder Consultation (Anonymous)",
        "theme": "workforce_coordination"
      },
      {
        "quote": "Stop stealing from each other and share resources.",
        "attribution": "Regional Health Service Leader",
        "theme": "collaboration"
      },
      {
        "quote": "I don't understand why every state Rural Workforce Agency is so different with services. QLD services are far better for Rural General Practice than Victoria.",
        "attribution": "GP Stakeholder Feedback",
        "theme": "service_consistency"
      },
      {
        "quote": "As a health professional and as a carer in rural/regional Australia, we need to bring health care to the patient and their families.",
        "attribution": "Health Professional & Carer",
        "theme": "patient_centred_care"
      },
      {
        "quote": "Tax deduction for rural doctors: 20% for MMM3, 30% for MMM4, 40% for MMM5, 50% for MMM6-7.",
        "attribution": "Community Member Policy Proposal",
        "theme": "retention_incentives"
      }
    ]
  },
  "PILOT_PROGRAM": {
    "communities": [
      {
        "id": "bendigo",
        "name": "Bendigo Region",
        "classification": "Inner Regional",
        "population": 100000,
        "focusAreas": [
          "Data intelligence platform",
          "Retention strategies",
          "University partnership enhancement"
        ],
        "strengths": [
          "Strong university presence",
          "Existing coordination mechanisms",
          "Diverse health services"
        ],
        "challenges": [
          "Competition with Melbourne for workforce",
          "Aging practitioner demographics"
        ],
        "firstNationsContext": "Dja Dja Wurrung country with active ACCHO presence"
      },
      {
        "id": "gippsland",
        "name": "Gippsland Lakes Region",
        "classification": "Outer Regional",
        "population": 25000,
        "focusAreas": [
          "Community-led planning",
          "Innovative supervision models",
          "IMG integration"
        ],
        "strengths": [
          "Strong community identity",
          "Tourism economy",
          "Lifestyle attraction"
        ],
        "challenges": [
          "Geographic isolation",
          "Limited career pathways",
          "Supervision access"
        ],
        "firstNationsContext": "Gunaikurnai country requiring authentic ACCHO partnership"
      },
      {
        "id": "mallee",
        "name": "Mallee Region",
        "classification": "Remote",
        "population": 8000,
        "focusAreas": [
          "Early warning systems",
          "Hub-and-spoke models",
          "Cultural safety integration"
        ],
        "strengths": [
          "Tight-knit community",
          "Agricultural economy",
          "Community resilience"
        ],
        "challenges": [
          "Distance from training centres",
          "Limited housing",
          "Social isolation"
        ],
        "firstNationsContext": "Wergaia country with historical workforce access inequities"
      }
    ],
    "overview": {
      "title": "Three-Community Strategic Pilot Program",
      "subtitle": "Testing Transformation Through Targeted Implementation",
      "purpose": "Test and refine RWAV's transformation model through intensive implementation in three diverse rural communities, providing evidence base for statewide rollout and Board confidence in strategic direction.",
      "timeline": "18-month pilot (July 2026 - December 2027) with 6-month evaluation",
      "investment": "Dedicated resources for intensive community engagement, platform development, and outcome measurement"
    }
  },
  "FINANCIAL_STRATEGY": {
    "targetRange": "25-30%",
    "revenueStreams": [
      {
        "name": "Data Intelligence Services",
        "target": "10-12%",
        "description": "Community Map subscriptions for health services and government, workforce analytics and predictive modelling services, custom research and analysis for policy development",
        "timeline": "12-18 months",
        "colour": "#3498DB",
        "launchYear": 2027,
        "rampUpYears": [
          2027,
          2028,
          2029,
          2030
        ]
      },
      {
        "name": "Coordination Administration",
        "target": "8-10%",
        "description": "Multi-site supervision program administration, cross-regional partnership facilitation services, coalition secretariat and project management",
        "timeline": "6-12 months",
        "colour": "#27AE60",
        "launchYear": 2026,
        "rampUpYears": [
          2026,
          2027,
          2028,
          2029
        ]
      },
      {
        "name": "Strategic Consultation",
        "target": "5-7%",
        "description": "Rural health system design consultation, workforce planning and retention strategy development, cultural safety and community engagement expertise",
        "timeline": "3-6 months",
        "colour": "#9B59B6",
        "launchYear": 2027,
        "rampUpYears": [
          2027,
          2028,
          2029,
          2030
        ]
      },
      {
        "name": "Innovation Partnerships",
        "target": "2-3%",
        "description": "Technology company partnerships for rural health solutions, sponsored coordination of international medical graduate pathways, corporate partnership facilitation aligned with rural health needs",
        "timeline": "18-24 months",
        "colour": "#E67E22",
        "launchYear": 2027,
        "rampUpYears": [
          2027,
          2028,
          2029,
          2030
        ]
      }
    ],
    "ethicalFramework": "Ethical Revenue Framework for Sustainable Transformation",
    "riskMitigation": {
      "principles": [
        "Enhance rather than compromise RWAV's primary mission",
        "Maintain organisational independence and credibility",
        "Provide genuine value to rural communities and healthcare professionals",
        "Support long-term sustainability without short-term exploitation",
        "Align with RWAV's values of partnership, collaboration, and community focus"
      ]
    }
  },
  "IMPLEMENTATION_TIMELINE": {
    "year1": {
      "year": 2026,
      "years": 2026,
      "title": "Foundation Building",
      "milestones": [
        {
          "quarter": "Q1",
          "title": "Board Approval & Stakeholder Communication",
          "activities": [
            "Strategic direction endorsed",
            "Pilot regions announced",
            "Partnership consultations begin"
          ]
        },
        {
          "quarter": "Q2",
          "title": "Community Map Platform Beta Launch",
          "activities": [
            "Platform development sprint",
            "Pilot community onboarding",
            "User testing and feedback"
          ]
        },
        {
          "quarter": "Q3",
          "title": "Partnership Agreements with Key Stakeholders",
          "activities": [
            "ACCHO partnership formalised",
            "PHN collaboration agreements",
            "University MoU signed"
          ]
        },
        {
          "quarter": "Q4",
          "title": "Cultural Safety Protocols Implementation",
          "activities": [
            "ACCHO leadership training",
            "Protocol documentation",
            "Community validation"
          ]
        }
      ],
      "keyDeliverables": [
        "Pilot program launched in 3 communities",
        "Community Map platform live (beta)",
        "Cultural safety framework operational",
        "First consultation revenue clients secured"
      ]
    },
    "year2": {
      "year": 2027,
      "years": 2027,
      "title": "Coalition Development",
      "milestones": [
        {
          "quarter": "Q1",
          "title": "Rural Workforce Coalition Establishment",
          "activities": [
            "Coalition charter developed",
            "Founding members recruited",
            "First summit held"
          ]
        },
        {
          "quarter": "Q2",
          "title": "Data Subscription Services Launch",
          "activities": [
            "Community Map full release",
            "Subscription pricing finalised",
            "Health service client acquisition"
          ]
        },
        {
          "quarter": "Q3",
          "title": "Enhanced Retention Program Implementation",
          "activities": [
            "Retention Excellence Hubs operational",
            "Peer support networks established",
            "Family integration programs"
          ]
        },
        {
          "quarter": "Q4",
          "title": "10% Non-Government Revenue Achievement",
          "activities": [
            "Revenue milestone celebrated",
            "Model validated",
            "Scaling plan refined"
          ]
        }
      ],
      "keyDeliverables": [
        "Rural workforce coalition operational",
        "10% non-government revenue achieved",
        "Pilot evaluation complete",
        "Statewide rollout plan approved"
      ]
    },
    "year3": {
      "year": 2028,
      "years": 2028,
      "title": "System Integration",
      "milestones": [
        {
          "quarter": "Q1-Q2",
          "title": "Full Community Map Platform Deployment",
          "activities": [
            "Statewide rollout begins",
            "Training program for regional users",
            "Data integration with government systems"
          ]
        },
        {
          "quarter": "Q3",
          "title": "Policy Influence and Advocacy Expansion",
          "activities": [
            "Policy reform campaign launched",
            "Coalition advocacy coordination",
            "Evidence briefs to government"
          ]
        },
        {
          "quarter": "Q4",
          "title": "Partnership Revenue Streams Established",
          "activities": [
            "Innovation partnerships secured",
            "Coordination contracts expanded",
            "15% revenue milestone"
          ]
        }
      ],
      "keyDeliverables": [
        "Community Map statewide coverage",
        "15% non-government revenue achieved",
        "First major policy reform influenced",
        "Multi-regional partnerships scaled"
      ]
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.STRATEGIC_PLAN_DATA = STRATEGIC_PLAN_DATA;
}
