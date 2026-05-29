// Onboarding wizard — a react-joyride tour that walks a prospect through what
// the current demo engagement does and where the value lives. Triggers once
// per engagement per browser via a localStorage flag, and can be manually
// re-launched from the "Take the tour" button in the engagement nav.
//
// Step sets are keyed by aiConfig.profile_key. Adding a new profile to the
// demo platform = adding an entry to STEP_SETS. Profiles without a step set
// render nothing (the button is also hidden — see EngagementShell).

import { useEffect, useMemo, useState, useCallback } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import type { Engagement, VocabularyMap } from '@/types/engagement';

interface OnboardingWizardProps {
  /** External control — when true, the tour starts regardless of localStorage. */
  forceStart?: boolean;
  /** Fired when the tour finishes or is skipped. */
  onClose?: () => void;
}

/** Profile keys that have an authored step set. Keep in sync with STEP_SETS. */
const PROFILES_WITH_TOUR = ['research-intelligence', 'strategic-planning'] as const;
type TouredProfile = (typeof PROFILES_WITH_TOUR)[number];

export function hasOnboardingTour(profileKey: string | null | undefined): boolean {
  return !!profileKey && (PROFILES_WITH_TOUR as readonly string[]).includes(profileKey);
}

function storageKey(engagementId: string): string {
  return `st_onboarding_seen_${engagementId}`;
}

export function OnboardingWizard({ forceStart = false, onClose }: OnboardingWizardProps) {
  const { engagement, aiConfig } = useEngagement();
  const v = useVocabulary();
  const [run, setRun] = useState(false);

  const profileKey = aiConfig?.profile_key ?? null;
  const hasTour = hasOnboardingTour(profileKey);

  useEffect(() => {
    if (!engagement) return;
    if (forceStart) {
      setRun(true);
      return;
    }
    if (!hasTour) return;
    const seen = typeof window !== 'undefined'
      ? window.localStorage.getItem(storageKey(engagement.id))
      : null;
    if (!seen) {
      // Delay a moment so the dashboard has rendered before the tour overlays
      const t = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(t);
    }
  }, [engagement, hasTour, forceStart]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      if (engagement && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey(engagement.id), new Date().toISOString());
      }
      onClose?.();
    }
  }, [engagement, onClose]);

  const steps = useMemo<Step[]>(() => {
    if (!engagement || !hasTour) return [];
    const builder = STEP_SETS[profileKey as TouredProfile];
    return builder ? builder(engagement, v) : [];
  }, [engagement, hasTour, profileKey, v]);

  if (!engagement || !hasTour || steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      callback={handleCallback}
      continuous
      showProgress
      showSkipButton
      disableScrolling={false}
      styles={{
        options: {
          // Explicit hex / rgba — react-joyride passes these into inline styles,
          // which cannot resolve hsl(var(--token)) CSS-variable references.
          primaryColor: '#2D7E32',         // brand green (matches --color-brand-primary)
          backgroundColor: '#ffffff',      // tooltip fill (was transparent → overlapping bug)
          textColor: '#262626',
          arrowColor: '#ffffff',
          overlayColor: 'rgba(0, 0, 0, 0.55)',
          zIndex: 60,
        },
        tooltip: {
          borderRadius: 8,
          padding: '20px 24px',
          maxWidth: 460,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 8,
        },
        tooltipContent: {
          padding: 0,
          fontSize: 14,
          lineHeight: 1.5,
        },
        buttonNext: {
          borderRadius: 6,
          padding: '8px 16px',
        },
        buttonBack: {
          marginRight: 8,
        },
        buttonSkip: {
          color: '#6b7280',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  );
}

/** Convenience hook for the "Take the tour" button in the engagement nav. */
export function useOnboardingWizard() {
  const [forceStart, setForceStart] = useState(false);
  return {
    forceStart,
    start: () => setForceStart(true),
    reset: () => setForceStart(false),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Step sets, keyed by profile_key. Each builder receives the live engagement
// and the active vocabulary map so labels (Priorities/Initiatives/Lenses vs
// Themes/Cross-cuts/Documents) match what the dashboard is rendering.
// ──────────────────────────────────────────────────────────────────────────

type StepBuilder = (engagement: Engagement, v: VocabularyMap) => Step[];

const researchSteps: StepBuilder = (engagement, v) => [
  {
    target: 'body',
    placement: 'center',
    title: `Welcome to ${engagement.name}`,
    content: (
      <div className="space-y-2 text-sm">
        <p>
          This is a <strong>research intelligence hub</strong> — a working installation of the
          Carlorbiz Strategic Tool. It sits between the research your organisation harvests
          and the strategic decisions your organisation has to make next.
        </p>
        <p>
          Two ideas thread through it: <strong>themes</strong> are the intake taxonomy (how the
          corpus is organised); <strong>pillars</strong> are the strategic intent the corpus is
          harvested in service of. The loop between them is your organisation's{' '}
          <strong>operating rhythm</strong> — the place where evidence either challenges intent
          or quietly confirms it. The next two minutes show you both.
        </p>
      </div>
    ),
    disableBeacon: true,
  },
  {
    target: '[data-tour="pillars-panel"]',
    title: 'Strategic pillars — the intent',
    content: (
      <p className="text-sm">
        These are the organisational or departmental priorities the conference is harvesting
        evidence for — the <strong>challenge cadence</strong> the corpus is meant to feed. The
        tool earns its keep by showing what the corpus is telling you about each pillar:
        what's being advanced, what's being contradicted, what's silent. Pillars either come
        from your existing strategic plan, or from a quick extraction workshop if you're
        using this hub as a standalone add-on.
      </p>
    ),
    placement: 'bottom',
  },
  {
    target: '[data-tour="themes-grid"]',
    title: `${v.commitment_top_plural} — the intake taxonomy`,
    content: (
      <p className="text-sm">
        Every {v.evidence_singular.toLowerCase()} in the corpus is tagged against one of these
        {' '}{v.commitment_top_plural.toLowerCase()} (and one or more {v.cross_cut_plural.toLowerCase()}{' '}
        for cross-cutting dimensions like discipline or geography). Themes are locked once
        you've set them — they're how the corpus is organised, not what the corpus is for.
      </p>
    ),
    placement: 'bottom',
  },
  {
    target: '[data-tour="recent-documents"]',
    title: `Recent ${v.evidence_plural}`,
    content: (
      <p className="text-sm">
        Each {v.evidence_singular.toLowerCase()} you upload is converted, semantically chunked,
        and tagged against a theme and any cross-cutting disciplines. Authors, institution,
        venue, and reference identifier travel with the {v.evidence_singular.toLowerCase()} so
        you can always get back to the source.
      </p>
    ),
    placement: 'top',
  },
  {
    target: '[data-tour="nera-bubble"]',
    title: 'Talk to Nera about your pillars',
    content: (
      <p className="text-sm">
        Click the round bubble to open Nera. She answers strictly from <strong>this
        engagement's</strong> corpus — no cross-contamination. The questions worth asking are
        pillar-level: <em>"Which pillar is best served by what we've collected?"</em> or{' '}
        <em>"Where is the corpus saying our assumptions about workforce uptake are wrong?"</em>
      </p>
    ),
    // Anchor above the Nera bubble (which sits at the bottom-right of the
    // viewport) so the tooltip + Next button always fit on screen.
    placement: 'top',
  },
  {
    target: '[data-tour="tabs-list"]',
    title: 'The work surfaces',
    content: (
      <p className="text-sm">
        <strong>Documents</strong> is where you upload — drop in PDFs from the shared folder to
        watch one go through the pipeline live. <strong>Reports</strong> generates a Conference
        Roundup, a Speaker Follow-up Brief, or — the most consequential one — a{' '}
        <strong>Pillar Briefing</strong> that synthesises what the corpus says about each
        strategic pillar and recommends moves for the next planning cycle.
      </p>
    ),
    placement: 'bottom',
  },
  {
    target: 'body',
    placement: 'center',
    title: 'Have a play',
    content: (
      <div className="space-y-2 text-sm">
        <p>
          That's the tour. The pillars, the themes, the {v.evidence_plural.toLowerCase()}, the
          chatbot, and the reports are all live and querying real ingested research.
        </p>
        <p>
          Think of the question this hub answers: <em>"Is what we're harvesting actually
          advancing what our organisation is trying to do?"</em> If yes — sharpen. If no — that
          mismatch is the most valuable signal the tool can give you, and the seed of your
          next planning cycle's rhythm.
        </p>
        <p>
          Re-launch this tour anytime from the navigation. Questions:{' '}
          <strong>carla@carlorbiz.com.au</strong>.
        </p>
      </div>
    ),
  },
];

const strategicPlanningSteps: StepBuilder = (engagement, v) => {
  const topPlural = v.commitment_top_plural.toLowerCase();
  const topSingular = v.commitment_top_singular.toLowerCase();
  const subPlural = v.commitment_sub_plural.toLowerCase();
  const driftPlural = (v.drift_plural ?? 'drift signals').toLowerCase();

  return [
    {
      target: 'body',
      placement: 'center',
      title: `Welcome to ${engagement.name}`,
      content: (
        <div className="space-y-2 text-sm">
          <p>
            This is a <strong>living strategic plan</strong> — a working installation of the
            Carlorbiz Strategic Tool. The plan that came out of your workshop isn't sitting in
            a PDF; it's running here, with {topPlural}, {subPlural}, and cross-cutting{' '}
            {v.cross_cut_plural.toLowerCase()} you can interrogate.
          </p>
          <p>
            Two ideas thread through it: <strong>{v.commitment_top_plural}</strong> are the
            strategic intent (what the organisation is committing to); <strong>evidence</strong>
            {' '}is everything that lands in the corpus — board papers, status updates,
            meeting notes, conversations with Nera. The loop between them is your{' '}
            <strong>operating rhythm</strong>. The next two minutes show you where it lives.
          </p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '[data-tour="pillars-panel"]',
      title: 'Strategic pillars — the intent',
      content: (
        <p className="text-sm">
          Pillars are the organisational or departmental priorities everything else is in
          service of. Most engagements start with {v.commitment_top_plural.toLowerCase()}{' '}
          (below) and add pillars once the plan is bedded in. If this panel is empty for now,
          that's expected — the {topPlural} below are doing the heavy lifting.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="themes-grid"]',
      title: `${v.commitment_top_plural} — what we said we'd do`,
      content: (
        <p className="text-sm">
          Each {topSingular} carries a live <strong>RAG status</strong> rolled up from its{' '}
          {subPlural}. Click any card to expand the {subPlural} underneath and see the
          last update Nera captured. The card colour is the latest answer to the only
          question that matters at the next board meeting: <em>"is it on track?"</em>
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="drift-section"]',
      title: `${v.drift_plural ?? 'Drift Signals'} — where the plan is wobbling`,
      content: (
        <p className="text-sm">
          Drift-watch reads everything that's landed in the corpus since the last run and
          surfaces {driftPlural}: a {topSingular} going quiet, scope creeping in a direction
          nobody noticed, an emerging theme without a home. This is the work the consultant
          used to do by reading every status report. Now it runs on demand.
        </p>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="conversational-update"]',
      title: 'Tell Nera what just happened',
      content: (
        <p className="text-sm">
          Instead of filling in a status form, you just <em>tell Nera</em> what's moved — in
          your own words. She works out which {topSingular} or {v.commitment_sub_singular.toLowerCase()}
          {' '}it relates to, pulls out the status snapshot, and writes the narrative for you.
          You confirm before it's saved. This is how a {topSingular} stays alive between
          board meetings.
        </p>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="recent-documents"]',
      title: `Recent ${v.evidence_plural}`,
      content: (
        <p className="text-sm">
          Every {v.evidence_singular.toLowerCase()} you upload — board papers, meeting notes,
          grant reports, stakeholder feedback — is converted, chunked, and tagged against the
          {' '}{topPlural} it touches. Nera reads all of it. That's how she answers questions
          without you having to find the source first.
        </p>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="nera-bubble"]',
      title: 'Talk to Nera about the plan',
      content: (
        <p className="text-sm">
          Click the round bubble to open Nera. She answers strictly from <strong>this
          engagement's</strong> corpus — no cross-contamination. The questions worth asking are
          {' '}{topSingular}-level: <em>"Which {topSingular} has gone quiet?"</em>,{' '}
          <em>"What does the corpus say about workforce since the last board meeting?"</em>,
          or <em>"Draft a pre-read for the next quarterly meeting."</em>
        </p>
      ),
      // Anchor above the Nera bubble (bottom-right of viewport) so the
      // tooltip + Next button always fit on screen.
      placement: 'top',
    },
    {
      target: '[data-tour="tabs-list"]',
      title: 'The work surfaces',
      content: (
        <p className="text-sm">
          <strong>Documents</strong> and <strong>Surveys</strong> are where evidence lands.{' '}
          <strong>Reports</strong> is the consequential one — pick a template (Board Pre-Read,
          quarterly summary, funder report), pick a period, and Nera drafts it from the
          corpus with citations back to source. You review, edit side-by-side, then mark it
          approved.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: 'body',
      placement: 'center',
      title: 'Have a play',
      content: (
        <div className="space-y-2 text-sm">
          <p>
            That's the tour. The {topPlural}, the {driftPlural}, the conversational updates,
            the chatbot, and the reports are all live and querying real seeded evidence.
          </p>
          <p>
            Think of the question this platform answers: <em>"Between board meetings, is the
            plan still alive?"</em> A static plan in a PDF can't answer that. This one can —
            and that's the difference between a consulting deliverable and a decision system.
          </p>
          <p>
            Re-launch this tour anytime from the navigation. Questions:{' '}
            <strong>carla@carlorbiz.com.au</strong>.
          </p>
        </div>
      ),
    },
  ];
};

const STEP_SETS: Record<TouredProfile, StepBuilder> = {
  'research-intelligence': researchSteps,
  'strategic-planning': strategicPlanningSteps,
};
