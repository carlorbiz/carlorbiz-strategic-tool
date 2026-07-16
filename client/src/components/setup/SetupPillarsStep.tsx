// Setup Wizard Step 3 — Pillars (CC-94, increment 2).
//
// On entry with no proposals: a "Nera, propose the pillars" button calls the
// st-extract-pillars edge function (one LLM read of the strategic-plan
// document's chunks). Proposals render as an editable list — inline edits,
// add/remove, reorder — nothing is decided without the admin.
//
// "These are right — lock them in":
//   (a) inserts each proposal into st_organisational_pillars (order_index by
//       position, status 'active' to match existing rows from 0008),
//   (b) applies vocabulary_suggestions via updateVocabularyMap ONLY if Nera
//       found distinctive terms AND the engagement has its own st_ai_config
//       row (the global row is never touched; house defaults otherwise),
//   (c) advances to step 4.
//
// Re-running the extraction replaces the proposals (with a warning if edits
// would be lost). If pillars already exist for the engagement the step shows
// a locked state instead of offering a second insert.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  extractPillars,
  updateSetupFields,
  type PillarProposal,
  type PillarProposalsPayload,
  type VocabularySuggestions,
} from '@/lib/setupApi';
import { fetchAiConfig, fetchOrganisationalPillars } from '@/lib/engagementApi';
import { triggerIngestion } from '@/lib/documentApi';
import { updateVocabularyMap } from '@/lib/commitmentApi';
import { DEFAULT_VOCABULARY, type StOrganisationalPillar, type VocabularyMap } from '@/types/engagement';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface SetupPillarsStepProps {
  engagementId: string;
  pillarProposals: PillarProposalsPayload | null;
  /** Lift the latest payload into the wizard's state (already persisted). */
  onPillarProposalsChange: (next: PillarProposalsPayload) => void;
  onBack: () => void;
  onNext: () => void;
}

const BLANK_PROPOSAL: PillarProposal = {
  title: '',
  description: '',
  success_signal: '',
  pillar_level: 'organisational',
};

// Naive singular for a plural label Nera suggested ("Strategic Directions" →
// "Strategic Direction"). Good enough for UI headings; the admin can refine
// in Engagement Settings.
function singularise(label: string): string {
  if (/ies$/i.test(label)) return label.replace(/ies$/i, 'y');
  if (/(ches|shes|sses|xes|zes)$/i.test(label)) return label.replace(/es$/i, '');
  if (/s$/i.test(label) && !/ss$/i.test(label)) return label.replace(/s$/i, '');
  return label;
}

function mergeVocabulary(base: VocabularyMap, suggestions: VocabularySuggestions): VocabularyMap {
  const next: VocabularyMap = { ...base };
  if (suggestions.priorities_label) {
    next.commitment_top_plural = suggestions.priorities_label;
    next.commitment_top_singular = singularise(suggestions.priorities_label);
  }
  if (suggestions.initiatives_label) {
    next.commitment_sub_plural = suggestions.initiatives_label;
    next.commitment_sub_singular = singularise(suggestions.initiatives_label);
  }
  if (suggestions.lenses_label) {
    next.cross_cut_plural = suggestions.lenses_label;
    next.cross_cut_singular = singularise(suggestions.lenses_label);
  }
  return next;
}

export function SetupPillarsStep({
  engagementId,
  pillarProposals,
  onPillarProposalsChange,
  onBack,
  onNext,
}: SetupPillarsStepProps) {
  const sourceDocumentId = pillarProposals?.source_document_id ?? null;

  const [proposals, setProposals] = useState<PillarProposal[]>(pillarProposals?.proposals ?? []);
  const [edited, setEdited] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [existingPillars, setExistingPillars] = useState<StOrganisationalPillar[] | null>(null);

  // If pillars already exist for this engagement (wizard re-entry after
  // lock-in, or seeded elsewhere) don't offer a second insert.
  useEffect(() => {
    let cancelled = false;
    fetchOrganisationalPillars(engagementId)
      .then(p => {
        if (!cancelled) setExistingPillars(p);
      })
      .catch(() => {
        if (!cancelled) setExistingPillars([]);
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  const handleExtract = async () => {
    if (!sourceDocumentId) return;
    if (proposals.length > 0) {
      const ok = window.confirm(
        edited
          ? 'Re-running the extraction replaces the current proposals, including your edits. Continue?'
          : 'Re-running the extraction replaces the current proposals. Continue?',
      );
      if (!ok) return;
    }
    setExtracting(true);
    try {
      const payload = await extractPillars(engagementId, sourceDocumentId);
      setProposals(payload.proposals ?? []);
      setEdited(false);
      onPillarProposalsChange(payload);
      toast.success('Nera has drafted the pillars — read them with a critical eye.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Pillar extraction failed.');
    } finally {
      setExtracting(false);
    }
  };

  const updateProposal = (index: number, patch: Partial<PillarProposal>) => {
    setProposals(prev => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    setEdited(true);
  };

  const addProposal = () => {
    setProposals(prev => [...prev, { ...BLANK_PROPOSAL }]);
    setEdited(true);
  };

  const removeProposal = (index: number) => {
    setProposals(prev => prev.filter((_, i) => i !== index));
    setEdited(true);
  };

  const moveProposal = (index: number, direction: -1 | 1) => {
    setProposals(prev => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setEdited(true);
  };

  // Keep in-session edits alive if the admin steps back to Documents and
  // returns (the step component remounts; the parent state doesn't).
  const handleBack = () => {
    if (edited) {
      onPillarProposalsChange({ ...(pillarProposals ?? {}), proposals });
    }
    onBack();
  };

  const handleLockIn = async () => {
    if (!supabase) {
      toast.error('Supabase not configured');
      return;
    }
    const cleaned = proposals
      .map(p => ({
        title: p.title.trim(),
        description: p.description.trim(),
        success_signal: p.success_signal.trim(),
        pillar_level: p.pillar_level || 'organisational',
      }))
      .filter(p => p.title.length > 0);
    if (cleaned.length === 0) {
      toast.error('At least one pillar with a title is needed before locking in.');
      return;
    }

    setLocking(true);
    try {
      // (a) Insert the pillars — status 'active' matches the 0008 default and
      // every existing row; order_index by list position.
      const rows = cleaned.map((p, i) => ({
        engagement_id: engagementId,
        title: p.title,
        description: p.description || null,
        success_signal: p.success_signal || null,
        pillar_level: p.pillar_level,
        order_index: i,
        status: 'active',
      }));
      const { error: insertErr } = await supabase.from('st_organisational_pillars').insert(rows);
      if (insertErr) throw insertErr;

      // (b) Vocabulary — only when Nera found distinctive terms, and only on
      // the engagement's own config row (never the global one).
      const suggestions = pillarProposals?.vocabulary_suggestions ?? null;
      if (suggestions && Object.keys(suggestions).length > 0) {
        try {
          const cfg = await fetchAiConfig(engagementId);
          if (cfg && cfg.engagement_id === engagementId) {
            const merged = mergeVocabulary(cfg.vocabulary_map ?? DEFAULT_VOCABULARY, suggestions);
            await updateVocabularyMap(cfg.id, merged);
            toast.success("Adopted the plan's own vocabulary for this engagement.");
          }
        } catch {
          // Vocabulary is cosmetic — the pillars are already in. Say so honestly.
          toast.error("Pillars saved, but the vocabulary suggestions couldn't be applied.");
        }
      }

      // Keep the setup record's copy in sync with what was actually locked in.
      const finalPayload: PillarProposalsPayload = {
        ...(pillarProposals ?? {}),
        proposals: cleaned as PillarProposal[],
      };
      onPillarProposalsChange(finalPayload);
      await updateSetupFields(engagementId, { pillar_proposals: finalPayload }).catch(() => undefined);

      // (c) Now that the pillars are confirmed, build the deep knowledge base
      // for the strategic plan in the background (fire-and-forget). The fast
      // text pass already gave us pillars; this is the slow chunk pass, and the
      // wizard must not wait on it — it proceeds straight to the next step.
      if (sourceDocumentId) {
        void triggerIngestion(sourceDocumentId, 'chunk').catch(err => {
          // Non-blocking — the plan can be re-chunked from the document list.
          console.warn('Background chunking failed to start:', err);
        });
      }

      toast.success(`${cleaned.length} pillar${cleaned.length === 1 ? '' : 's'} locked in.`);
      // (d) Advance.
      onNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save the pillars.');
    } finally {
      setLocking(false);
    }
  };

  // ── Checking whether pillars are already locked in ─────────────────────────
  if (existingPillars === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>Pillars</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-5 h-5 mx-auto animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // ── Already locked in ──────────────────────────────────────────────────────
  if (existingPillars && existingPillars.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>Pillars</CardTitle>
          <CardDescription>
            This engagement's pillars are already locked in. They can be refined later from the
            engagement's settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {existingPillars.map(p => (
              <li key={p.id} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
                <div>
                  <span className="font-medium">{p.title}</span>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>Next</Button>
        </CardFooter>
      </Card>
    );
  }

  // ── Propose / review ───────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>Pillars</CardTitle>
        <CardDescription>
          The handful of big things the organisation is really about. Nera proposes them from the
          strategic plan — you review, reword or reject. Nothing is decided without you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!sourceDocumentId && (
          <p className="text-sm text-muted-foreground">
            No strategic plan has been chosen yet. Go back to Documents and upload the plan first —
            it's the document Nera reads to propose these.
          </p>
        )}

        {sourceDocumentId && proposals.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Nera has read the strategic plan and is ready to suggest the pillars it's built around.
            </p>
            <Button onClick={handleExtract} disabled={extracting}>
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Nera is reading the plan and
                  drafting pillars — usually under a minute...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> Nera, propose the pillars
                </>
              )}
            </Button>
          </div>
        )}

        {proposals.length > 0 && (
          <div className="space-y-4">
            {proposals.map((p, i) => (
              <div key={i} className="rounded border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Pillar {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => moveProposal(i, -1)}
                      disabled={i === 0 || locking}
                      aria-label="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => moveProposal(i, 1)}
                      disabled={i === proposals.length - 1 || locking}
                      aria-label="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeProposal(i)}
                      disabled={locking}
                      aria-label="Remove pillar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`pillar-title-${i}`}>Title</Label>
                  <Input
                    id={`pillar-title-${i}`}
                    value={p.title}
                    onChange={e => updateProposal(i, { title: e.target.value })}
                    placeholder="e.g. Thriving communities"
                    disabled={locking}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`pillar-desc-${i}`}>What it covers</Label>
                  <Textarea
                    id={`pillar-desc-${i}`}
                    value={p.description}
                    onChange={e => updateProposal(i, { description: e.target.value })}
                    rows={2}
                    disabled={locking}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`pillar-signal-${i}`}>What success looks like</Label>
                  <Textarea
                    id={`pillar-signal-${i}`}
                    value={p.success_signal}
                    onChange={e => updateProposal(i, { success_signal: e.target.value })}
                    rows={2}
                    disabled={locking}
                  />
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={addProposal} disabled={locking}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add a pillar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExtract}
                disabled={extracting || locking || !sourceDocumentId}
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Re-reading the plan...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Ask Nera again
                  </>
                )}
              </Button>
            </div>

            {pillarProposals?.vocabulary_suggestions &&
              Object.keys(pillarProposals.vocabulary_suggestions).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  The plan uses its own vocabulary
                  {pillarProposals.vocabulary_suggestions.priorities_label
                    ? ` — it calls these "${pillarProposals.vocabulary_suggestions.priorities_label}"`
                    : ''}
                  . Locking in will adopt those terms across this engagement.
                </p>
              )}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={handleBack} disabled={locking}>
          Back
        </Button>
        <Button onClick={handleLockIn} disabled={locking || extracting || proposals.length === 0}>
          {locking ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Locking in...
            </>
          ) : (
            "These are right — lock them in"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
