// Onboarding wizard — a react-joyride tour that walks a prospect through what
// the Rural Futures Australia demo engagement (and any other research-vertical
// engagement) does and where the value lives. Triggers once per engagement per
// browser via a localStorage flag. Can be manually re-launched via the "Take
// the tour" button in the engagement nav.

import { useEffect, useState, useCallback } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';

interface OnboardingWizardProps {
  /** External control — when true, the tour starts regardless of localStorage. */
  forceStart?: boolean;
  /** Fired when the tour finishes or is skipped. */
  onClose?: () => void;
}

function storageKey(engagementId: string): string {
  return `st_onboarding_seen_${engagementId}`;
}

export function OnboardingWizard({ forceStart = false, onClose }: OnboardingWizardProps) {
  const { engagement, aiConfig } = useEngagement();
  const v = useVocabulary();
  const [run, setRun] = useState(false);

  // Auto-start only for engagements using the research-intelligence profile,
  // and only on first visit. Other profiles can opt in by adding their own
  // step set in the future.
  const isResearchProfile = aiConfig?.profile_key === 'research-intelligence';

  useEffect(() => {
    if (!engagement) return;
    if (forceStart) {
      setRun(true);
      return;
    }
    if (!isResearchProfile) return;
    const seen = typeof window !== 'undefined'
      ? window.localStorage.getItem(storageKey(engagement.id))
      : null;
    if (!seen) {
      // Delay a moment so the dashboard has rendered before the tour overlays
      const t = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(t);
    }
  }, [engagement, isResearchProfile, forceStart]);

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

  if (!engagement || !isResearchProfile) return null;

  const steps: Step[] = [
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
            harvested in service of. The next two minutes show you both — and the loop between
            them, which is where the value lives.
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
          evidence for. The tool earns its keep by showing what the corpus is telling you about
          each pillar — what's being advanced, what's being contradicted, what's silent. Pillars
          either come from your existing strategic plan, or from a quick extraction workshop if
          you're using this hub as a standalone add-on.
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
      placement: 'left',
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
            advancing what our organisation is trying to do?"</em> If yes — sharpen. If no — that's
            the most valuable signal the tool can give you.
          </p>
          <p>
            Re-launch this tour anytime from the navigation. Questions:{' '}
            <strong>carla@carlorbiz.com.au</strong>.
          </p>
        </div>
      ),
    },
  ];

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
