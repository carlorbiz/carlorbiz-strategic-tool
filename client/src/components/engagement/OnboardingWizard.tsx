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
            This is a <strong>research intelligence hub</strong> — a working installation of
            the Carlorbiz Strategic Tool, configured as a doorway for events teams and
            programme committees.
          </p>
          <p>
            Each year's research {v.evidence_plural.toLowerCase()} accumulate here instead of getting
            their five seconds at a podium and disappearing. The next two minutes will show you
            what that looks like in practice.
          </p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '[data-tour="themes-grid"]',
      title: `The four ${v.commitment_top_plural}`,
      content: (
        <p className="text-sm">
          Every {v.evidence_singular.toLowerCase()} in the corpus is tagged against one of these
          {' '}{v.commitment_top_plural.toLowerCase()} (and one or more {v.cross_cut_plural.toLowerCase()},
          which are cross-cutting tags like discipline or geography). The status pill on each card
          rolls up from the underlying {v.commitment_sub_plural.toLowerCase()}.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="recent-documents"]',
      title: `Recent ${v.evidence_plural}`,
      content: (
        <p className="text-sm">
          Each {v.evidence_singular.toLowerCase()} you upload is converted, semantically chunked, and
          tagged here. The chunk count tells you how granularly Nera can recall it. Authors,
          journal, and DOI travel with the {v.evidence_singular.toLowerCase()} so you can always get
          back to the source.
        </p>
      ),
      placement: 'top',
    },
    {
      target: '[data-tour="nera-bubble"]',
      title: 'Talk to Nera about this corpus',
      content: (
        <p className="text-sm">
          Click the round bubble to open Nera. She answers questions strictly from the {' '}
          {v.evidence_plural.toLowerCase()} in <strong>this engagement</strong> — no cross-contamination
          with other clients. Try things like <em>"Which papers contradict each other on telehealth?"</em>
          {' '}or <em>"Who at Macquarie has presented on workforce planning?"</em>
        </p>
      ),
      placement: 'left',
    },
    {
      target: '[data-tour="tabs-list"]',
      title: 'The work surfaces',
      content: (
        <p className="text-sm">
          The dashboard is the front door. <strong>Documents</strong> is where you upload new
          {' '}{v.evidence_plural.toLowerCase()} — drop in PDFs from the shared Google Drive to watch
          one go through the pipeline live. <strong>Reports</strong> generates a Conference
          Roundup or Speaker Follow-up Brief from the corpus on demand.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="conversational-update"]',
      title: 'Capture a follow-up',
      content: (
        <p className="text-sm">
          When something happens — a researcher's paper gets cited in policy, a programme decision
          gets made, a theme matures — capture it conversationally here. Nera figures out which
          Theme or Stream it belongs to and stores it as structured evidence.
        </p>
      ),
      placement: 'top',
    },
    {
      target: 'body',
      placement: 'center',
      title: 'Have a play',
      content: (
        <div className="space-y-2 text-sm">
          <p>
            That's the tour. The {v.commitment_top_plural.toLowerCase()}, the {v.evidence_plural.toLowerCase()},
            the chatbot, and the reports are all live and querying real ingested research.
          </p>
          <p>
            You can re-launch this tour anytime from the navigation. If you have any questions,
            email <strong>carla@carlorbiz.com.au</strong>.
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
