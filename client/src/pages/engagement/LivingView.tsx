import { useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommitmentEditor } from '@/components/engagement/CommitmentEditor';
import { CommitmentChangeLog } from '@/components/engagement/CommitmentChangeLog';
import { StageEditor } from '@/components/engagement/StageEditor';
import { EngagementSettings } from '@/components/engagement/EngagementSettings';
import { DocumentUpload } from '@/components/engagement/DocumentUpload';
import { DocumentList } from '@/components/engagement/DocumentList';

/**
 * Living view — the engagement is handed over and the organisation
 * is using the tool independently.
 * Shown when engagement.status === 'living'.
 *
 * Two layers:
 *   1. Dashboard (default tab) — priority cards, document list, future widgets
 *   2. Admin tabs (for users with admin permissions) — taxonomy editor,
 *      stages, documents, change log, settings
 */
export function EngagementLivingView() {
  const { engagement, commitments, isEngagementAdmin } = useEngagement();
  const v = useVocabulary();
  const [docRefreshTrigger, setDocRefreshTrigger] = useState(0);

  if (!engagement) return null;

  const priorities = commitments.filter(c => c.kind === 'top');
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
        <TabsContent value="dashboard" className="mt-4">
          <h2 className="text-lg font-semibold mb-3">{v.commitment_top_plural}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {priorities.map(p => {
              const initiatives = commitments.filter(c => c.parent_id === p.id && c.kind === 'sub');
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{p.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {p.description && (
                      <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                    )}
                    {initiatives.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {initiatives.length} {initiatives.length === 1
                          ? v.commitment_sub_singular.toLowerCase()
                          : v.commitment_sub_plural.toLowerCase()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {priorities.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">
                No {v.commitment_top_plural.toLowerCase()} defined yet.
              </p>
            )}
          </div>

          {lenses.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mb-3">{v.cross_cut_plural}</h2>
              <div className="flex flex-wrap gap-2 mb-8">
                {lenses.map(l => (
                  <Badge key={l.id} variant="outline">{l.title}</Badge>
                ))}
              </div>
            </>
          )}

          {/* Recent documents on the dashboard */}
          <h2 className="text-lg font-semibold mb-3">Recent {v.evidence_plural}</h2>
          <DocumentList refreshTrigger={docRefreshTrigger} />
        </TabsContent>

        {/* ── Documents tab (upload + full list) ────────────── */}
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
