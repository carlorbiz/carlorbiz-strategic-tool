import { Target, Compass, BrainCircuit, Users, Shield, BarChart3, Lightbulb, Layers, Zap } from "lucide-react";
import type { CampaignConfig } from "@/pages/CampaignLanding";

/**
 * Each campaign is a focused landing page for LinkedIn (or other) ad traffic.
 * One sector. One buyer pain. One action.
 *
 * URL pattern: /lp/{slug}
 */
export const CAMPAIGNS: CampaignConfig[] = [
  /* ------------------------------------------------------------------ */
  /*  Peak Bodies — strategy that never gets executed                    */
  /* ------------------------------------------------------------------ */
  {
    slug: "peak-bodies",
    seo: {
      title: "Peak Bodies: Turn Your Strategy Into a System That Runs | Carlorbiz",
      description:
        "Your strategy document is 18 months old and nothing's changed. Carlorbiz builds live execution systems for peak bodies and industry associations.",
    },
    hero: {
      sector: "For peak bodies & industry associations",
      headline: "Your strategy document is 18 months old. Your board is asking what's changed.",
      subtext:
        "You've invested in the strategy. The workshops happened. The slides were approved. But six months on, your team is still reactive, your board wants evidence of progress, and the document lives in a shared drive nobody opens. The problem isn't the strategy — it's the system around it.",
      cta: "Book a free 30-minute strategy call",
    },
    differentiators: [
      {
        icon: Target,
        title: "Live execution tracking",
        body: "Your strategy becomes a system your team interacts with every week — not a PDF they reference quarterly. Progress is visible. Ownership is clear.",
      },
      {
        icon: Users,
        title: "Your team owns it",
        body: "I build the infrastructure and hand it over. No ongoing dependency. Your people run the system from day one — I just set it up right.",
      },
      {
        icon: BrainCircuit,
        title: "AI that knows your sector",
        body: "Nera — an AI layer trained on your organisation's own expertise — surfaces decisions, frameworks, and blind spots on demand. Not generic. Yours.",
      },
    ],
    proof: {
      stat: "30+ years leading transformation across peak bodies, healthcare & education",
      sectors:
        "I've worked inside peak bodies, member organisations, and industry associations for over a decade. I know the governance constraints, the stakeholder complexity, and the board dynamics.",
    },
  },

  /* ------------------------------------------------------------------ */
  /*  Healthcare — drowning in priorities, no shared decision framework  */
  /* ------------------------------------------------------------------ */
  {
    slug: "healthcare",
    seo: {
      title: "Healthcare Leaders: Cut Through the Noise With Decision Architecture | Carlorbiz",
      description:
        "Too many priorities and no shared framework for making calls. Carlorbiz builds decision architecture for healthcare leaders.",
    },
    hero: {
      sector: "For healthcare leaders",
      headline: "Too many priorities. No shared framework. Your team is busy but not aligned.",
      subtext:
        "You're juggling compliance, workforce pressures, digital transformation, and a dozen strategic initiatives at once. Everyone is heads-down, but nobody is pulling in the same direction. What's missing isn't effort — it's a shared decision system your team can trust.",
      cta: "Book a free 30-minute strategy call",
    },
    differentiators: [
      {
        icon: Compass,
        title: "Decision architecture, not more meetings",
        body: "I build the shared framework your leadership team uses to prioritise, escalate, and resolve — so you stop re-litigating the same decisions every quarter.",
      },
      {
        icon: Shield,
        title: "Built for governance-heavy environments",
        body: "Healthcare has unique constraints — compliance, accreditation, clinical governance. The systems I build work within those guardrails, not around them.",
      },
      {
        icon: BarChart3,
        title: "Visible progress for boards and execs",
        body: "Live dashboards and decision logs that show what's been decided, what's moving, and where the blockers are — without another reporting cycle.",
      },
    ],
    proof: {
      stat: "30+ years leading transformation across healthcare, peak bodies & education",
      sectors:
        "I've led transformation in acute care, allied health, and health service administration. I understand clinical governance, accreditation timelines, and the gap between executive intent and frontline reality.",
    },
  },

  /* ------------------------------------------------------------------ */
  /*  Education — want AI but overwhelmed by vendor noise               */
  /* ------------------------------------------------------------------ */
  {
    slug: "education",
    seo: {
      title: "Education Leaders: AI That Structures Your Expertise, Not Replaces It | Carlorbiz",
      description:
        "You know AI matters but every vendor pitch sounds the same. Carlorbiz builds AI knowledge systems that structure your organisation's deep expertise.",
    },
    hero: {
      sector: "For education leaders",
      headline: "You know AI matters. But every vendor pitch sounds the same — and none of them understand your context.",
      subtext:
        "Your leadership team is being asked about AI strategy. You've sat through demos of chatbots and dashboards, but none of them connect to your actual institutional knowledge. What you need isn't another tool — it's a system that structures what your organisation already knows and makes it usable.",
      cta: "Book a free 30-minute strategy call",
    },
    differentiators: [
      {
        icon: Lightbulb,
        title: "Your expertise, structured",
        body: "I take your organisation's deep institutional knowledge — policies, frameworks, teaching practice — and build it into an AI-powered system your team can query, trust, and extend.",
      },
      {
        icon: Layers,
        title: "Not a chatbot. A knowledge platform.",
        body: "Nera doesn't give generic answers. It draws from your structured content to surface decisions, flag gaps, and reason about your specific context.",
      },
      {
        icon: Zap,
        title: "Operational in weeks, not months",
        body: "We start with what you have — existing strategy documents, policies, frameworks — and get a working system live fast. No 12-month implementation.",
      },
    ],
    proof: {
      stat: "30+ years leading transformation across education, healthcare & peak bodies",
      sectors:
        "I've built AI knowledge systems for organisations navigating complex regulatory and institutional environments. Education is a natural fit — deep expertise, heavy documentation, and teams who need answers fast.",
    },
  },
];
