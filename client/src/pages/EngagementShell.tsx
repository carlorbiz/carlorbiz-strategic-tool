import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { EngagementProvider, useEngagement } from '@/contexts/EngagementContext';
import { StrategicChatProvider } from '@/contexts/StrategicChatContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, Sparkles } from 'lucide-react';
import { EngagementNeraChatbot } from '@/components/chat/EngagementNeraChatbot';
import { OnboardingWizard, hasOnboardingTour } from '@/components/engagement/OnboardingWizard';
import { isDemoEngagement } from '@/lib/demo';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { getBrand } from '@/lib/brand';

// Status-specific views
import { EngagementDraftView } from '@/pages/engagement/DraftView';
import { EngagementActiveView } from '@/pages/engagement/ActiveView';
import { EngagementDeliveredView } from '@/pages/engagement/DeliveredView';
import { EngagementLivingView } from '@/pages/engagement/LivingView';
import { EngagementArchivedView } from '@/pages/engagement/ArchivedView';

// The per-surface engagement bar: EP3 green logo, back-to-engagements, the
// engagement name, tour re-launch, and the local sign-out. On the Carlorbiz
// skin it is the sticky top nav (unchanged). On the MTMOT skin the replicated
// mtmot.com header (App.tsx) is the ONLY top bar, so this entire bar renders
// as a non-sticky page FOOTER instead (CC-89 — same links/actions, EP3 logo
// preserved, just moved to the bottom of the page).
function EngagementNav({ onTakeTour, asFooter = false }: { onTakeTour: () => void; asFooter?: boolean }) {
  const { engagement, aiConfig } = useEngagement();
  const { signOut } = useAuth();
  const showTourButton = hasOnboardingTour(aiConfig?.profile_key);

  const inner = (
    <div className="container mx-auto flex items-center justify-between h-12 px-4 max-w-5xl">
      <div className="flex items-center gap-2">
        <BrandLogo imgClassName="h-6 w-auto object-contain" />
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            Engagements
          </Button>
        </Link>
        {engagement && (
          <span className="text-sm text-muted-foreground hidden sm:inline">
            / {engagement.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {showTourButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onTakeTour}
            className="gap-1 text-muted-foreground"
            title="Re-launch the demo tour"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">Take the tour</span>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1 text-muted-foreground">
          <LogOut className="w-3 h-3" />
          Sign out
        </Button>
      </div>
    </div>
  );

  if (asFooter) {
    return <footer className="border-t bg-background">{inner}</footer>;
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      {inner}
    </nav>
  );
}

function EngagementContent() {
  const { engagement, isLoading, error, activeRoleKey } = useEngagement();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading engagement...</p>
      </div>
    );
  }

  if (error || !engagement) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Engagement not found</h2>
          <p className="text-muted-foreground">
            {error ?? "You may not have access to this engagement, or it doesn't exist."}
          </p>
          <Link href="/">
            <Button variant="outline">Back to engagements</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Public demo engagements are viewable with NO engagement role — a prospect
  // enters via /demo on an anonymous session (RLS allows read-only). Only gate
  // real (non-demo) engagements on the role. Without this exemption the demo
  // shows "Access denied" behind the onboarding wizard.
  if (!activeRoleKey && !isDemoEngagement(engagement.id)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="text-muted-foreground">
            You don't have a role in this engagement. Contact the administrator to request access.
          </p>
          <Link href="/">
            <Button variant="outline">Back to engagements</Button>
          </Link>
        </div>
      </div>
    );
  }

  switch (engagement.status) {
    case 'draft':
      return <EngagementDraftView />;
    case 'active':
      return <EngagementActiveView />;
    case 'delivered':
      return <EngagementDeliveredView />;
    case 'living':
      return <EngagementLivingView />;
    case 'archived':
      return <EngagementArchivedView />;
    default:
      return (
        <div className="flex h-screen items-center justify-center">
          <p className="text-muted-foreground">
            Unknown engagement status: {engagement.status}
          </p>
        </div>
      );
  }
}

export default function EngagementShell() {
  const params = useParams<{ engagementId: string }>();
  const engagementId = params.engagementId;

  if (!engagementId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">No engagement ID provided.</p>
      </div>
    );
  }

  return (
    <EngagementProvider engagementId={engagementId}>
      <StrategicChatProvider>
        <EngagementShellInner />
      </StrategicChatProvider>
    </EngagementProvider>
  );
}

// If the engagement was loaded via UUID or short_code but it has a slug,
// quietly swap the URL to the canonical slug form. Random-looking short
// codes (e.g. /e/b93cb5) read as phishing tokens to most prospects;
// /e/rural-futures-australia reads as a recognisable place.
//
// Uses replace:true so the change doesn't create a back-button entry. The
// engagement object stays the same; components don't unmount.
function CanonicalUrlRedirect() {
  const params = useParams<{ engagementId: string }>();
  const [, setLocation] = useLocation();
  const { engagement } = useEngagement();

  useEffect(() => {
    if (!engagement?.slug) return;
    if (params.engagementId === engagement.slug) return;
    setLocation(`/e/${engagement.slug}`, { replace: true });
  }, [engagement, params.engagementId, setLocation]);

  return null;
}

function EngagementShellInner() {
  // Manual-relaunch counter so the "Take the tour" button re-fires the wizard
  // (remounting OnboardingWizard with a fresh forceStart=true each click).
  const [tourNonce, setTourNonce] = useState(0);
  const brand = getBrand();
  const takeTour = () => setTourNonce((n) => n + 1);

  return (
    <>
      <CanonicalUrlRedirect />
      {/* Carlorbiz skin: sticky top nav, exactly as before. MTMOT skin: the
          replicated mtmot.com header is the only top bar, so the engagement
          bar renders below the content as a footer (CC-89). Mid-flow controls
          stay reachable regardless: the demo wizard carries its own step/close
          controls and the Nera chatbot floats — neither depends on this bar. */}
      {!brand.isMtmot && <EngagementNav onTakeTour={takeTour} />}
      {brand.isMtmot ? (
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">
            <EngagementContent />
          </div>
          <EngagementNav asFooter onTakeTour={takeTour} />
        </div>
      ) : (
        <EngagementContent />
      )}
      <EngagementNeraChatbot />
      <OnboardingWizard
        key={tourNonce}
        forceStart={tourNonce > 0}
      />
    </>
  );
}
