export interface ContentBlock {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  evidence?: {
    text: string;
    source: string;
    type: 'quote' | 'stat' | 'finding';
  }[];
  tags?: string[];
}

export interface TabData {
  id: string;
  label: string;
  description: string;
  blocks: ContentBlock[];
}

export const APP_DATA: TabData[] = [
  {
    id: "executive-summary",
    label: "Executive Summary",
    description: "Overview of the collaborative national scoping project by GPSA and GPRA mapping supports for First Nations GP training.",
    blocks: [
      {
        id: "project-overview",
        title: "Project Overview",
        category: "Context",
        summary: "A joint investigation by GPSA and GPRA into the support landscape for First Nations GP training.",
        content: `In early 2025, the First Nations General Practice Training Committee requested a comprehensive scoping project to explore First Nations GP training supports. GPSA and GPRA collaborated on this joint project (Sept-Dec 2025) to identify existing structures, map needs, and propose solutions.

The project captured perspectives from two critical cohorts:
*   **First Nations GP Registrars & Fellows** (via GPRA/IGPTN)
*   **GP Supervisors & ACCHO/AMS Staff** (via GPSA)

The goal is to provide the Commonwealth with actionable intelligence to inform policy and funding decisions, moving beyond fragmented investigations to a holistic view of the training ecosystem.`,
        evidence: [
          {
            text: "The project aimed to identify existing support structures, map support needs, document barriers, and propose practical solutions.",
            source: "Project Objectives",
            type: "finding"
          }
        ]
      },
      {
        id: "key-findings-summary",
        title: "Key Findings at a Glance",
        category: "Highlights",
        summary: "Four major themes emerged revealing a complex landscape of strengths and significant gaps.",
        content: `The combined findings reveal a support landscape characterized by both pockets of excellence and systemic failures.

**1. Mentorship & Peer Support**
IGPTN is universally valued as critical infrastructure. However, a "support paradox" exists where First Nations supervisors provide immense support but receive little themselves.

**2. Cultural Safety & Connection**
Strong satisfaction is reported when working within Community. Conversely, mainstream settings continue to present barriers including discrimination, isolation, and a lack of cultural safety.

**3. Financial & Organisational Supports**
While some funding exists, it is often precarious. Critical unmet needs include financial incentives, protected time for cultural activities, and dedicated resourcing for cultural labour.

**4. Structural Barriers**
Awareness gaps, geographic isolation, and a lack of recognition for cultural work undermine effective training and supervision across the board.`,
        evidence: [
          {
            text: "The overall support system remains fragmented, under-resourced, and heavily reliant on the unpaid cultural labour of First Nations practitioners.",
            source: "Executive Summary",
            type: "finding"
          }
        ]
      }
    ]
  },
  {
    id: "research-findings",
    label: "Research Findings",
    description: "Detailed analysis of the scoping project data from GPRA and GPSA cohorts.",
    blocks: [
      {
        id: "cohort-profiles",
        title: "Respondent Profiles",
        category: "Demographics",
        summary: "Perspectives from 24 respondents across diverse roles and geographies.",
        content: `**GPRA Cohort (n=4)**
*   **Identity:** 100% Aboriginal
*   **Roles:** Registrars, Fellows, Medical Educators
*   **Location:** NT, QLD, VIC, NSW
*   **Insight:** Represents practitioners at various stages, from training to national leadership.

**GPSA Cohort (n=20)**
*   **Identity:** 25% First Nations, 75% Non-Indigenous
*   **Roles:** GP Supervisors (17), ACCHO/AMS Staff (11), Medical Educators (5)
*   **Location:** NSW, VIC, WA, QLD, NT, SA
*   **Insight:** Supervisors in First Nations health settings typically manage dual responsibilities of clinical supervision and cultural education.`,
        evidence: [
          {
            text: "Supervisors in First Nations health settings typically support registrars from diverse backgrounds, managing dual responsibilities of clinical supervision and cultural education.",
            source: "Respondent Analysis",
            type: "stat"
          }
        ]
      },
      {
        id: "theme-mentorship",
        title: "Theme 1: Mentorship & Peer Support",
        category: "Research Theme",
        summary: "IGPTN is critical, but supervisors face a significant support deficit.",
        content: `**IGPTN as Critical Infrastructure**
Across both cohorts, the Indigenous General Practice Training Network (IGPTN) was identified as the most consistently valued resource. It provides culturally safe spaces for connection, mentorship, and professional development.

**The Support Paradox**
A striking finding is the lack of support for those who provide it. First Nations supervisors and medical directors often become the default support infrastructure for everyone else—registrars and colleagues alike—without receiving dedicated support themselves.

**Informal Networks**
Peer support networks are instrumental but often informal and unsupported by funding or policy.`,
        evidence: [
          {
            text: "I am expected to provide support for everyone - registrars, supervisors alike - and have no support myself.",
            source: "First Nations Supervisor",
            type: "quote"
          },
          {
            text: "IGPTN is a fantastic resource.",
            source: "GPSA Respondent",
            type: "quote"
          }
        ]
      },
      {
        id: "theme-cultural-safety",
        title: "Theme 2: Cultural Safety & Community",
        category: "Research Theme",
        summary: "Working in Community provides satisfaction; mainstream settings pose challenges.",
        content: `**Value of Community**
Respondents reported a strong sense of satisfaction and connectedness when working within Aboriginal and Torres Strait Islander communities. ACCHO/AMS settings often provide "multiple layers of cultural support," including access to Elders and protected time for community engagement.

**Mainstream Barriers**
In contrast, mainstream settings are associated with professional and cultural isolation. The lack of Indigenous mentorship and the imposition of "cultural load" without recognition are significant barriers.`,
        evidence: [
          {
            text: "Our service provides multiple layers of cultural support including regular cultural supervision, access to Elders, and protected time for community engagement.",
            source: "ACCHO Supervisor",
            type: "quote"
          }
        ]
      }
    ]
  },
  {
    id: "literature-review",
    label: "Literature Review",
    description: "Synthesis of 50 peer-reviewed and grey literature sources (2014-2025).",
    blocks: [
      {
        id: "lit-methodology",
        title: "Methodology & Scope",
        category: "Academic Rigour",
        summary: "A systematic review of over 1,000 papers, narrowed to 50 key sources.",
        content: `**Search Strategy**
A comprehensive search utilizing AI-powered synthesis (Consensus) across databases like PubMed, BMC, and the Lowitja Journal.
*   **Identified:** 1,092 papers
*   **Screened:** 590 papers
*   **Included:** 50 papers

**Focus Areas**
The review synthesizes evidence on cultural supports for four key cohorts:
1.  Indigenous registrars in mainstream settings
2.  Non-Indigenous registrars in AMS/ACCHO settings
3.  Indigenous supervisors in mainstream settings
4.  Non-Indigenous supervisors in AMS/ACCHO settings`,
        evidence: [
          {
            text: "The evidence reveals a consistent pattern: whilst the importance of cultural safety is acknowledged, actual provision remains inconsistent and under-resourced.",
            source: "Literature Review Executive Summary",
            type: "finding"
          }
        ]
      },
      {
        id: "lit-cultural-load",
        title: "Concept: Cultural Load",
        category: "Key Concepts",
        summary: "The unrecognized burden placed on Indigenous health professionals.",
        content: `**Definition**
Cultural load refers to the significant, often unrecognized burden placed on Indigenous health professionals to lead all Indigenous-related initiatives, provide cultural education to non-Indigenous colleagues, and interpret cultural contexts—typically without formal recognition or remuneration.

**Impact**
The literature consistently identifies cultural load as a major risk factor for burnout and a barrier to retention. It transforms a professional asset (cultural knowledge) into a professional liability (unpaid work and emotional exhaustion).`,
        evidence: [
          {
            text: "Indigenous supervisors particularly bear disproportionate responsibility for cultural education without adequate recognition, remuneration, or support.",
            source: "Literature Review Findings",
            type: "finding"
          }
        ]
      },
      {
        id: "lit-gaps",
        title: "Critical Research Gaps",
        category: "Evidence Gaps",
        summary: "What we still don't know due to lack of rigorous evaluation.",
        content: `Despite the growing attention to cultural safety, the review identified significant gaps in the evidence base:

*   **Evaluation Deficit:** Absence of rigorous evaluations of support interventions. We know *what* is being done, but rarely *how effective* it is.
*   **Long-term Outcomes:** Limited evidence on the long-term impact of cultural supports on workforce retention.
*   **Indigenous-led Research:** A lack of Indigenous-led research frameworks in many existing studies.

**Recommendation:** Future research must prioritize community governance and culturally safe methodologies that drive systemic change rather than incremental adjustments.`,
        evidence: []
      }
    ]
  },
  {
    id: "recommendations",
    label: "Recommendations",
    description: "Actionable steps for policy, funding, and organizational change.",
    blocks: [
      {
        id: "rec-scale-models",
        title: "Scale Proven Models",
        category: "Action",
        summary: "Invest in what works: IGPTN and ACCHO/AMS models.",
        content: `**IGPTN Support**
Secure, long-term funding for IGPTN is the single most effective intervention identified. It provides the essential "third space" for cultural safety and professional development that mainstream training cannot replicate.

**ACCHO/AMS Excellence**
Recognize and resource ACCHOs and AMSs as centers of excellence in training. Their comprehensive support models (Elders, cultural supervision, community protocols) should be the benchmark, not the exception.`,
        evidence: []
      },
      {
        id: "rec-supervisor-support",
        title: "Support the Supervisors",
        category: "Action",
        summary: "Address the 'Support Paradox' urgently.",
        content: `**Dedicated Resourcing**
Establish specific funding streams to support First Nations supervisors. This includes:
*   Remuneration for cultural supervision (distinct from clinical supervision).
*   Backfilling clinical time to allow for mentorship activities.
*   Formal peer support networks for supervisors to prevent isolation.

**Recognition**
Formally recognize "cultural load" as "cultural leadership" within college and training standards, attaching professional development points and financial value to this work.`,
        evidence: []
      },
      {
        id: "rec-local-solutions",
        title: "Enable Local Solutions",
        category: "Action",
        summary: "National frameworks must enable, not dictate, local responses.",
        content: `**Flexibility is Key**
While national funding is necessary, implementation must be flexible enough to respect local community protocols and needs.

**Community Governance**
Support structures must be designed, governed, and delivered by First Nations peoples. External support should enable Indigenous leadership rather than substitute for it.`,
        evidence: []
      }
    ]
  }
];
