import { useParams } from 'wouter';
import { EngagementProvider, useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';

// Status-specific views (stubs — will be built out in later phases)
import { EngagementDraftView } from '@/pages/engagement/DraftView';
import { EngagementActiveView } from '@/pages/engagement/ActiveView';
import { EngagementDeliveredView } from '@/pages/engagement/DeliveredView';
import { EngagementLivingView } from '@/pages/engagement/LivingView';
import { EngagementArchivedView } from '@/pages/engagement/ArchivedView';

function EngagementContent() {
  const { engagement, isLoading, error, activeRoleKey } = useEngagement();
  const v = useVocabulary();

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
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Engagement not found</h2>
          <p className="text-muted-foreground">
            {error ?? "You may not have access to this engagement, or it doesn't exist."}
          </p>
        </div>
      </div>
    );
  }

  // No role and not internal_admin → no access
  if (!activeRoleKey) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="text-muted-foreground">
            You don't have a role in this engagement. Contact the administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  // Route to the appropriate view based on engagement status
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
      <EngagementContent />
    </EngagementProvider>
  );
}
