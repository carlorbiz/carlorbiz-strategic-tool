import { useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { supabase } from '@/lib/supabase';
import { createDeliverable } from '@/lib/reportApi';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { FileText, Loader2, ArrowRight, Check, AlertTriangle } from 'lucide-react';

/**
 * DeliverableComposer — the bridge between the consulting engagement arc
 * and the living platform. Creates a deliverable document, writes
 * Priorities/Initiatives/Lenses into st_commitments (if they came from
 * the deliverable), chunks the document into knowledge_chunks, and
 * transitions the engagement from active → delivered.
 */
export function DeliverableComposer() {
  const { engagement, commitments, refresh } = useEngagement();
  const { user } = useAuth();
  const v = useVocabulary();

  const [isOpen, setIsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [renderMode, setRenderMode] = useState<'full' | 'summary' | 'executive'>('full');

  const topCommitments = commitments.filter(c => c.kind === 'top');
  const subCommitments = commitments.filter(c => c.kind === 'sub');
  const lenses = commitments.filter(c => c.kind === 'cross_cut');

  const handleOpen = () => {
    const defaultTitle = `${engagement?.name ?? 'Engagement'} — Deliverable`;
    setTitle(defaultTitle);

    // Pre-populate with commitment summary
    const lines = [
      `# ${defaultTitle}`,
      '',
      `**Client:** ${engagement?.client_name ?? '(not set)'}`,
      `**Date:** ${new Date().toLocaleDateString('en-AU')}`,
      '',
      `## ${v.commitment_top_plural}`,
      '',
      ...topCommitments.map((c, i) => {
        const subs = subCommitments.filter(s => s.parent_id === c.id);
        const subsText = subs.length > 0
          ? '\n' + subs.map(s => `  - **${s.title}**: ${s.description ?? ''}`).join('\n')
          : '';
        return `${i + 1}. **${c.title}**: ${c.description ?? ''}${subsText}`;
      }),
      '',
    ];

    if (lenses.length > 0) {
      lines.push(`## ${v.cross_cut_plural}`, '');
      lenses.forEach(l => {
        lines.push(`- **${l.title}**: ${l.description ?? ''}`);
      });
      lines.push('');
    }

    lines.push(
      '## Recommendations',
      '',
      '*(Add consultant recommendations here)*',
      '',
      '## Next Steps',
      '',
      '*(Add next steps here)*',
    );

    setContent(lines.join('\n'));
    setIsOpen(true);
  };

  const handleDeliver = async () => {
    if (!engagement || !supabase || !user) return;
    setSaving(true);

    try {
      // 1. Create the deliverable record
      const deliverable = await createDeliverable({
        engagement_id: engagement.id,
        title: title.trim(),
        content_markdown: content,
        content_structured: {
          priorities: topCommitments.map(c => ({
            id: c.id,
            title: c.title,
            description: c.description,
          })),
          lenses: lenses.map(l => ({
            id: l.id,
            title: l.title,
            description: l.description,
          })),
        },
        render_mode: renderMode,
        is_published: true,
        published_at: new Date().toISOString(),
        created_by: user.id,
      });

      // 2. Chunk the deliverable into knowledge_chunks so Nera can cite it
      const chunks = splitIntoChunks(content, title);
      for (const chunk of chunks) {
        await supabase.from('knowledge_chunks').insert({
          engagement_id: engagement.id,
          source_app: 'strategic-tool',
          source_type: 'deliverable',
          document_source: title,
          chunk_text: chunk.text,
          chunk_summary: chunk.summary,
          topic_tags: chunk.tags,
        });
      }

      // 3. Transition engagement status to 'delivered'
      const { error: statusErr } = await supabase
        .from('st_engagements')
        .update({ status: 'delivered' })
        .eq('id', engagement.id);

      if (statusErr) throw statusErr;

      toast.success('Engagement delivered — deliverable created and chunked');
      setIsOpen(false);
      setConfirmOpen(false);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delivery failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!engagement || engagement.status !== 'active') return null;

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-600" />
            <CardTitle className="text-sm text-amber-900">Ready to Deliver?</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-amber-800 mb-3">
            When the consulting engagement is complete, compose the deliverable document.
            This writes {v.commitment_top_plural}, {v.commitment_sub_plural}, and {v.cross_cut_plural} into
            the commitment taxonomy and transitions the engagement to <strong>delivered</strong>.
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            {topCommitments.length} {v.commitment_top_plural} · {subCommitments.length} {v.commitment_sub_plural} · {lenses.length} {v.cross_cut_plural} defined
          </p>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={handleOpen}>
                <FileText className="w-3 h-3 mr-1" /> Compose Deliverable
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Compose Engagement Deliverable</DialogTitle>
                <DialogDescription>
                  This document will be chunked into the knowledge corpus so Nera can cite it.
                  The engagement will transition to <strong>delivered</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Deliverable title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Content (markdown)</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={20}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{topCommitments.length} {v.commitment_top_plural}</Badge>
                  <Badge variant="outline">{subCommitments.length} {v.commitment_sub_plural}</Badge>
                  <Badge variant="outline">{lenses.length} {v.cross_cut_plural}</Badge>
                  <span>will be confirmed in the taxonomy</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setConfirmOpen(true)}>
                    <ArrowRight className="w-3 h-3 mr-1" /> Deliver
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Confirm Delivery
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will:
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Create the deliverable document and chunk it into the knowledge corpus</li>
                <li>Transition the engagement from <strong>active</strong> to <strong>delivered</strong></li>
                <li>The engagement will need to be handed over to the client to enter <strong>living</strong> mode</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeliver} disabled={saving}>
              {saving ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Delivering...</>
              ) : (
                <><Check className="w-3 h-3 mr-1" /> Confirm Delivery</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Chunking helper ────────────────────────────────────────────

function splitIntoChunks(
  markdown: string,
  docTitle: string
): Array<{ text: string; summary: string; tags: string[] }> {
  const sections = markdown.split(/(?=^## )/m);
  return sections
    .filter(s => s.trim().length > 50)
    .map(section => {
      const headingMatch = section.match(/^##\s+(.+)/);
      const heading = headingMatch?.[1] ?? docTitle;
      const text = section.trim();
      // Simple tag extraction from heading
      const tags = heading
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 5);

      return {
        text,
        summary: `${heading} — from deliverable "${docTitle}"`,
        tags,
      };
    });
}
