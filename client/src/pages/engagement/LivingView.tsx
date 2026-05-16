import { useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { triggerDriftWatch } from '@/lib/engagementApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Radar } from 'lucide-react';
import { CommitmentEditor } from '@/components/engagement/CommitmentEditor';
import { CommitmentChangeLog } from '@/components/engagement/CommitmentChangeLog';
import { StageEditor } from '@/components/engagement/StageEditor';
import { EngagementSettings } from '@/components/engagement/EngagementSettings';
import { DocumentUpload } from '@/components/engagement/DocumentUpload';
import { DocumentList } from '@/components/engagement/DocumentList';
import { SurveyUpload } from '@/components/engagement/SurveyUpload';
import { SurveyList } from '@/components/engagement/SurveyList';
import { ConversationalUpdate } from '@/components/engagement/ConversationalUpdate';
import { PriorityStatusGrid } from '@/components/engagement/dashboard/PriorityStatusGrid';
import { DriftSignals } from '@/components/engagement/dashboard/DriftSignals';
import { RecentUpdates } from '@/components/engagement/dashboard/RecentUpdates';
import { NeraQuestions } from '@/components/engagement/dashboard/NeraQuestions';
import { SampleNeraQuestions } from '@/components/engagement/dashboard/SampleNeraQuestions';
import { PillarsPanel } from '@/components/engagement/dashboard/PillarsPanel';
import { ReportGenerator } from '@/components/engagement/ReportGenerator';
import { ReportTemplateEditor } from '@/components/engagement/ReportTemplateEditor';

/**
 * Living view — the engagement is handed over and the organisation
 * is using the tool independently.
 * Shown when engagement.status === 'living'.
 */
export function EngagementLivingView() {
  const { engagement, commitments, isEngagementAdmin, aiConfig } = useEngagement();
  const v = useVocabulary();
  // Research-vertical engagements suppress strategic-planning-shaped features
  // whose semantics don't yet map (conversational update, drift signals UI).
  // Pillars + sample Nera questions + reports do the heavy lifting instead.
  const isResearchProfile = aiConfig?.profile_key === 'research-intelligence';
  const [docRefreshTrigger, setDocRefreshTrigger] = useState(0);
  const [surveyRefreshTrigger, setSurveyRefreshTrigger] = useState(0);
  const [driftRunning, setDriftRunning] = useState(false);
  const [driftRefresh, setDriftRefresh] = useState(0);

  const handleRunDriftWatch = async () => {
    if (!engagement) return;
    setDriftRunning(true);
    try {
      await triggerDriftWatch(engagement.id);
      toast.success('Drift watch complete — signals updated');
      setDriftRefresh(n => n + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Drift watch failed';
      toast.error(msg);
    } finally {
      setDriftRunning(false);
    }
  };

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
        <TabsList data-tour="tabs-list">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          {isEngagementAdmin && (
            <>
              <TabsTrigger value="taxonomy">{v.commitment_top_plural}</TabsTrigger>
              <TabsTrigger value="stages">Stages</TabsTrigger>
              <TabsTrigger value="changelog">Change Log</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ── Dashboard tab ─────────────────────────────────── */}
        <TabsContent value="dashboard" className="mt-4 space-y-6">
          {/* Strategic pillars — the intent the corpus is harvested in service of */}
          <PillarsPanel />

          {/* Themes (intake taxonomy) — what the corpus is organised by */}
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

          {/* Drift signals — hidden on research-vertical engagements until the
              drift-watch edge function is reframed to detect programme-integrity
              signals (repeat presenters, theme silence, institution concentration)
              rather than strategic-plan drift. */}
          {!isResearchProfile && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{v.drift_plural ?? 'Drift Signals'}</h3>
                {isEngagementAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRunDriftWatch}
                    disabled={driftRunning}
                  >
                    {driftRunning ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running...</>
                    ) : (
                      <><Radar className="w-3 h-3 mr-1" /> Run Drift Watch</>
                    )}
                  </Button>
                )}
              </div>
              <DriftSignals key={driftRefresh} />
              <NeraQuestions />
            </>
          )}

          {/* Sample questions a prospect can click to demo Nera (research profile only) */}
          <SampleNeraQuestions />

          {/* Conversational update — hidden on research-vertical engagements until
              the semantic equivalent ("capture how the corpus shifted a pillar")
              is designed. Shipping RAG-status framing for a non-plan engagement
              is worse than silence. */}
          {!isResearchProfile && (
            <div data-tour="conversational-update">
              <ConversationalUpdate />
            </div>
          )}

          {/* Recent updates */}
          {!isResearchProfile && <RecentUpdates />}

          {/* Recent documents */}
          <div data-tour="recent-documents">
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

        {/* ── Surveys tab ──────────────────────────────────── */}
        <TabsContent value="surveys" className="mt-4 space-y-6">
          {isEngagementAdmin && (
            <SurveyUpload onUploadComplete={() => setSurveyRefreshTrigger(n => n + 1)} />
          )}
          <SurveyList refreshTrigger={surveyRefreshTrigger} />
        </TabsContent>

        {/* ── Reports tab ───────────────────────────────────── */}
        <TabsContent value="reports" className="mt-4">
          <ReportGenerator />
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
