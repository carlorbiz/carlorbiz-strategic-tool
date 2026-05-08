import { useParams, Link } from 'wouter';
import { EngagementProvider, useEngagement } from '@/contexts/EngagementContext';
import { StrategicChatProvider } from '@/contexts/StrategicChatContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut } from 'lucide-react';
import { EngagementNeraChatbot } from '@/components/chat/EngagementNeraChatbot';

// Status-specific views
import { EngagementDraftView } from '@/pages/engagement/DraftView';
import { EngagementActiveView } from '@/pages/engagement/ActiveView';
import { EngagementDeliveredView } from '@/pages/engagement/DeliveredView';
import { EngagementLivingView } from '@/pages/engagement/LivingView';
import { EngagementArchivedView } from '@/pages/engagement/ArchivedView';

function EngagementNav() {
  const { engagement } = useEngagement();
  const { signOut } = useAuth();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between h-12 px-4 max-w-5xl">
        <div className="flex items-center gap-2">
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
        <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1 text-muted-foreground">
          <LogOut className="w-3 h-3" />
          Sign out
        </Button>
      </div>
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

  if (!activeRoleKey) {
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
        <EngagementNav />
        <EngagementContent />
        <EngagementNeraChatbot />
      </StrategicChatProvider>
    </EngagementProvider>
  );
}
