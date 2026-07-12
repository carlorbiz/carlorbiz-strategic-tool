// Setup Wizard Step 2 — Documents (CC-94, increment 2).
//
// Embeds the existing DocumentUpload + DocumentList primitives, scoped to the
// engagement via the surrounding EngagementProvider. The FIRST upload is
// presented as "the strategic plan": its st_documents id is stashed inside
// st_engagement_setup.pillar_proposals.source_document_id (jsonb — no schema
// change) so Step 3 knows which document to extract pillars from.
//
// Next unlocks once the strategic-plan document reaches status 'ingested'.
// Other documents can keep uploading/chunking in the background meanwhile.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { updateSetupFields, type PillarProposalsPayload } from '@/lib/setupApi';
import { DocumentUpload } from '@/components/engagement/DocumentUpload';
import { DocumentList } from '@/components/engagement/DocumentList';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { StDocument } from '@/types/engagement';
import { AlertTriangle, BookOpenCheck, CheckCircle2, Loader2 } from 'lucide-react';

interface SetupDocumentsStepProps {
  engagementId: string;
  pillarProposals: PillarProposalsPayload | null;
  /** Persist + lift the patched pillar_proposals into the wizard's state. */
  onPillarProposalsChange: (next: PillarProposalsPayload) => void;
  onBack: () => void;
  onNext: () => void;
}

const POLL_MS = 10_000;

export function SetupDocumentsStep({
  engagementId,
  pillarProposals,
  onPillarProposalsChange,
  onBack,
  onNext,
}: SetupDocumentsStepProps) {
  const planDocId = pillarProposals?.source_document_id ?? null;
  const [planDoc, setPlanDoc] = useState<StDocument | null>(null);
  const [listRefresh, setListRefresh] = useState(0);

  // Track the strategic-plan document's ingestion status.
  const loadPlanDoc = useCallback(async () => {
    if (!planDocId || !supabase) return;
    const { data } = await supabase
      .from('st_documents')
      .select('*')
      .eq('id', planDocId)
      .maybeSingle();
    if (data) setPlanDoc(data as StDocument);
  }, [planDocId]);

  useEffect(() => {
    loadPlanDoc();
  }, [loadPlanDoc]);

  useEffect(() => {
    if (!planDocId) return;
    if (planDoc && (planDoc.status === 'ingested' || planDoc.status === 'failed')) return;
    const interval = setInterval(loadPlanDoc, POLL_MS);
    return () => clearInterval(interval);
  }, [planDocId, planDoc, loadPlanDoc]);

  const handleUploaded = (doc: StDocument) => {
    if (planDocId) return; // the strategic plan is already chosen
    const next: PillarProposalsPayload = { ...(pillarProposals ?? {}), source_document_id: doc.id };
    setPlanDoc(doc);
    onPillarProposalsChange(next);
    updateSetupFields(engagementId, { pillar_proposals: next }).catch(() => {
      toast.error(
        "Couldn't record which document is the strategic plan — the upload itself is safe. Try refreshing before moving on.",
      );
    });
  };

  const planIngested = planDoc?.status === 'ingested';

  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>Documents</CardTitle>
        <CardDescription>
          Share the documents that tell the organisation's story. Start with the strategic plan —
          the first document you upload here is the one Nera proposes pillars from in the next step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Strategic-plan status banner */}
        {!planDocId && (
          <div className="flex items-start gap-2 p-3 rounded border bg-muted/50">
            <BookOpenCheck className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Upload the strategic plan first. Anything else — annual reports, reviews, board
              papers — can follow in any order.
            </p>
          </div>
        )}
        {planDocId && planDoc && !planIngested && planDoc.status !== 'failed' && (
          <div className="flex items-start gap-2 p-3 rounded border bg-muted/50">
            <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                Nera is reading the plan: {planDoc.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A long document can take 10-20 minutes — you can keep uploading other documents
                meanwhile. This page checks progress automatically.
              </p>
            </div>
          </div>
        )}
        {planDoc?.status === 'failed' && (
          <div className="flex items-start gap-2 p-3 rounded border border-destructive/50 bg-destructive/10">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium">Nera couldn't read the strategic plan.</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use the retry button on the document below, or upload a cleaner copy. Pillars can't
                be proposed until the plan has been read.
              </p>
            </div>
          </div>
        )}
        {planIngested && planDoc && (
          <div className="flex items-start gap-2 p-3 rounded border bg-muted/50">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
            <p className="text-sm">
              The strategic plan is in — Nera has read <span className="font-medium">{planDoc.title}</span>
              {typeof planDoc.chunk_count === 'number' && planDoc.chunk_count > 0
                ? ` (${planDoc.chunk_count} knowledge chunks).`
                : '.'}{' '}
              Add anything else useful, then continue to pillars.
            </p>
          </div>
        )}

        <DocumentUpload
          onUploaded={handleUploaded}
          onUploadComplete={() => setListRefresh(n => n + 1)}
        />
        <DocumentList refreshTrigger={listRefresh} />
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          {!planIngested && (
            <span className="text-xs text-muted-foreground">
              {planDocId
                ? 'Next unlocks once the plan is chunked.'
                : 'Upload the strategic plan to continue.'}
            </span>
          )}
          <Button onClick={onNext} disabled={!planIngested}>
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
