import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HandoverFlow } from '@/components/engagement/HandoverFlow';
import { ReportGenerator } from '@/components/engagement/ReportGenerator';
import { ReportTemplateEditor } from '@/components/engagement/ReportTemplateEditor';
import { CommitmentEditor } from '@/components/engagement/CommitmentEditor';
import { DocumentList } from '@/components/engagement/DocumentList';
import { EngagementSettings } from '@/components/engagement/EngagementSettings';

/**
 * Delivered view — the deliverable has been produced and the engagement
 * is ready for handover to the client.
 * Shown when engagement.status === 'delivered'.
 */
export function EngagementDeliveredView() {
  const { engagement, isEngagementAdmin } = useEngagement();
  const v = useVocabulary();

  if (!engagement) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {engagement.name}
        </h1>
        <Badge variant="secondary">Delivered</Badge>
      </div>
      {engagement.client_name && (
        <p className="text-muted-foreground mb-6">{engagement.client_name}</p>
      )}

      <Tabs defaultValue="handover">
        <TabsList>
          <TabsTrigger value="handover">Handover</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {isEngagementAdmin && (
            <>
              <TabsTrigger value="taxonomy">{v.commitment_top_plural}</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ── Handover tab ─────────────────────────────── */}
        <TabsContent value="handover" className="mt-4">
          <HandoverFlow />
        </TabsContent>

        {/* ── Reports tab ──────────────────────────────── */}
        <TabsContent value="reports" className="mt-4">
          <ReportGenerator />
        </TabsContent>

        {/* ── Documents tab ────────────────────────────── */}
        <TabsContent value="documents" className="mt-4">
          <DocumentList refreshTrigger={0} />
        </TabsContent>

        {/* ── Admin tabs ───────────────────────────────── */}
        {isEngagementAdmin && (
          <>
            <TabsContent value="taxonomy" className="mt-4">
              <CommitmentEditor />
            </TabsContent>
            <TabsContent value="templates" className="mt-4">
              <ReportTemplateEditor />
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
