import { useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommitmentEditor } from '@/components/engagement/CommitmentEditor';
import { CommitmentChangeLog } from '@/components/engagement/CommitmentChangeLog';
import { StageEditor } from '@/components/engagement/StageEditor';
import { EngagementSettings } from '@/components/engagement/EngagementSettings';
import { DocumentUpload } from '@/components/engagement/DocumentUpload';
import { DocumentList } from '@/components/engagement/DocumentList';
import { PriorityStatusGrid } from '@/components/engagement/dashboard/PriorityStatusGrid';
import { DriftSignals } from '@/components/engagement/dashboard/DriftSignals';
import { RecentUpdates } from '@/components/engagement/dashboard/RecentUpdates';
import { NeraQuestions } from '@/components/engagement/dashboard/NeraQuestions';

/**
 * Living view — the engagement is handed over and the organisation
 * is using the tool independently.
 * Shown when engagement.status === 'living'.
 */
export function EngagementLivingView() {
  const { engagement, commitments, isEngagementAdmin } = useEngagement();
  const v = useVocabulary();
  const [docRefreshTrigger, setDocRefreshTrigger] = useState(0);

  if (!engagement) return null;

  const lenses = commitments.filter(c => c.kind === 'cross_cut');

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {engagement.name}
        </h1>
        <Badge>Living</Badge>
      </div>
      {engagement.client_name && (
        <p className="text-muted-foreground mb-6">{engagement.client_name}</p>
      )}

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {isEngagementAdmin && (
            <>
              <TabsTrigger value="taxonomy">{v.commitment_top_plural}</TabsTrigger>
              <TabsTrigger value="stages">Stages</TabsTrigger>
              <TabsTrigger value="changelog">Change Log</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ── Dashboard tab ─────────────────────────────────── */}
        <TabsContent value="dashboard" className="mt-4 space-y-6">
          {/* Priority status grid with RAG roll-ups */}
          <PriorityStatusGrid />

          {/* Lenses */}
          {lenses.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-2">{v.cross_cut_plural}</h2>
              <div className="flex flex-wrap gap-2">
                {lenses.map(l => (
                  <Badge key={l.id} variant="outline">{l.title}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Drift signals */}
          <DriftSignals />

          {/* Nera's open questions (only shows if there are any) */}
          <NeraQuestions />

          {/* Recent updates */}
          <RecentUpdates />

          {/* Recent documents */}
          <div>
            <h3 className="text-base font-semibold mb-2">Recent {v.evidence_plural}</h3>
            <DocumentList refreshTrigger={docRefreshTrigger} />
          </div>
        </TabsContent>

        {/* ── Documents tab ─────────────────────────────────── */}
        <TabsContent value="documents" className="mt-4 space-y-6">
          {isEngagementAdmin && (
            <DocumentUpload onUploadComplete={() => setDocRefreshTrigger(n => n + 1)} />
          )}
          <DocumentList refreshTrigger={docRefreshTrigger} />
        </TabsContent>

        {/* ── Admin tabs ────────────────────────────────────── */}
        {isEngagementAdmin && (
          <>
            <TabsContent value="taxonomy" className="mt-4">
              <CommitmentEditor />
            </TabsContent>
            <TabsContent value="stages" className="mt-4">
              <StageEditor />
            </TabsContent>
            <TabsContent value="changelog" className="mt-4">
              <CommitmentChangeLog />
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <EngagementSettings />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
