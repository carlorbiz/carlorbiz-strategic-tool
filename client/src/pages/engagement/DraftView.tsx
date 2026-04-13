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
import { SurveyUpload } from '@/components/engagement/SurveyUpload';
import { SurveyList } from '@/components/engagement/SurveyList';

/**
 * Draft view — admin setup surface.
 * Shown when engagement.status === 'draft'.
 * Tabbed: Taxonomy | Stages | Documents | Change Log | Settings
 */
export function EngagementDraftView() {
  const { engagement } = useEngagement();
  const v = useVocabulary();
  const [docRefreshTrigger, setDocRefreshTrigger] = useState(0);
  const [surveyRefreshTrigger, setSurveyRefreshTrigger] = useState(0);

  if (!engagement) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {engagement.name}
        </h1>
        <Badge variant="outline">Draft</Badge>
      </div>
      {engagement.client_name && (
        <p className="text-muted-foreground mb-6">{engagement.client_name}</p>
      )}

      <Tabs defaultValue="taxonomy" className="mt-4">
        <TabsList>
          <TabsTrigger value="taxonomy">{v.commitment_top_plural}</TabsTrigger>
          <TabsTrigger value="stages">Stages</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
          <TabsTrigger value="changelog">Change Log</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="taxonomy" className="mt-4">
          <CommitmentEditor />
        </TabsContent>

        <TabsContent value="stages" className="mt-4">
          <StageEditor />
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-6">
          <DocumentUpload onUploadComplete={() => setDocRefreshTrigger(n => n + 1)} />
          <DocumentList refreshTrigger={docRefreshTrigger} />
        </TabsContent>

        <TabsContent value="surveys" className="mt-4 space-y-6">
          <SurveyUpload onUploadComplete={() => setSurveyRefreshTrigger(n => n + 1)} />
          <SurveyList refreshTrigger={surveyRefreshTrigger} />
        </TabsContent>

        <TabsContent value="changelog" className="mt-4">
          <CommitmentChangeLog />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <EngagementSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
