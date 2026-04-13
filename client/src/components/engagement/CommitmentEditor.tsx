import { useState, useCallback } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import type { Commitment, CommitmentKind, ScopeExtensionCategory } from '@/types/engagement';
import {
  createCommitment,
  updateCommitment,
  archiveCommitment,
  countActiveTopCommitments,
  logChange,
  createScopeExtension,
} from '@/lib/commitmentApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, Trash2, Save, ChevronDown, ChevronRight, AlertTriangle, Archive,
} from 'lucide-react';

// ── Inline edit form for a single commitment ────────────────────────────────

interface CommitmentFormProps {
  commitment: Commitment;
  onSave: (updated: Partial<Pick<Commitment, 'title' | 'description' | 'success_signal'>>) => Promise<void>;
  onArchive: () => Promise<void>;
  onScopeExtension: (category: ScopeExtensionCategory, narrative: string) => Promise<void>;
  vocabulary: ReturnType<typeof useVocabulary>;
  isAdmin: boolean;
}

function CommitmentForm({ commitment, onSave, onArchive, onScopeExtension, vocabulary, isAdmin }: CommitmentFormProps) {
  const [title, setTitle] = useState(commitment.title);
  const [description, setDescription] = useState(commitment.description ?? '');
  const [successSignal, setSuccessSignal] = useState(commitment.success_signal ?? '');
  const [saving, setSaving] = useState(false);
  const [showScopeExt, setShowScopeExt] = useState(false);
  const [scopeCategory, setScopeCategory] = useState<ScopeExtensionCategory>('clarification');
  const [scopeNarrative, setScopeNarrative] = useState('');

  const kindLabel = commitment.kind === 'top'
    ? vocabulary.commitment_top_singular
    : commitment.kind === 'sub'
      ? vocabulary.commitment_sub_singular
      : vocabulary.cross_cut_singular;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ title, description: description || undefined, success_signal: successSignal || undefined });
      toast.success(`${kindLabel} saved`);
    } catch {
      toast.error(`Failed to save ${kindLabel.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const handleScopeExtension = async () => {
    if (!scopeNarrative.trim()) {
      toast.error('A brief narrative is required for scope extensions');
      return;
    }
    try {
      await onScopeExtension(scopeCategory, scopeNarrative.trim());
      toast.success('Scope extension logged');
      setShowScopeExt(false);
      setScopeNarrative('');
    } catch {
      toast.error('Failed to log scope extension');
    }
  };

  const dirty = title !== commitment.title
    || description !== (commitment.description ?? '')
    || successSignal !== (commitment.success_signal ?? '');

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs shrink-0">{kindLabel}</Badge>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="font-medium"
          disabled={!isAdmin}
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Description</Label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="text-sm"
          placeholder={`What does this ${kindLabel.toLowerCase()} mean?`}
          disabled={!isAdmin}
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Success signal</Label>
        <Input
          value={successSignal}
          onChange={e => setSuccessSignal(e.target.value)}
          className="text-sm"
          placeholder="How will you know this succeeded?"
          disabled={!isAdmin}
        />
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 pt-1">
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowScopeExt(!showScopeExt)}>
            Scope extension
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={onArchive}>
            <Archive className="w-3 h-3 mr-1" />
            {vocabulary.commitment_archive_verb}
          </Button>
        </div>
      )}

      {showScopeExt && (
        <div className="p-3 border rounded bg-muted/50 space-y-2">
          <Label className="text-xs font-medium">Log a scope extension</Label>
          <Select value={scopeCategory} onValueChange={v => setScopeCategory(v as ScopeExtensionCategory)}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clarification">Clarification</SelectItem>
              <SelectItem value="expansion">Expansion</SelectItem>
              <SelectItem value="reinterpretation">Reinterpretation</SelectItem>
              <SelectItem value="correction">Correction</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={scopeNarrative}
            onChange={e => setScopeNarrative(e.target.value)}
            rows={2}
            className="text-sm"
            placeholder="Brief description of how the scope has changed and why..."
          />
          <Button size="sm" onClick={handleScopeExtension} disabled={!scopeNarrative.trim()}>
            Log extension
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main commitment editor ──────────────────────────────────────────────────

export function CommitmentEditor() {
  const { engagement, commitments, isEngagementAdmin, refresh } = useEngagement();
  const v = useVocabulary();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addKind, setAddKind] = useState<CommitmentKind>('top');
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addSuccessSignal, setAddSuccessSignal] = useState('');
  const [countWarning, setCountWarning] = useState<string | null>(null);

  if (!engagement) return null;

  const priorities = commitments.filter(c => c.kind === 'top').sort((a, b) => a.order_index - b.order_index);
  const lenses = commitments.filter(c => c.kind === 'cross_cut').sort((a, b) => a.order_index - b.order_index);

  const getInitiatives = (parentId: string) =>
    commitments.filter(c => c.kind === 'sub' && c.parent_id === parentId).sort((a, b) => a.order_index - b.order_index);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async (id: string, data: Partial<Pick<Commitment, 'title' | 'description' | 'success_signal'>>) => {
    await updateCommitment(id, data);
    await refresh();
  };

  const handleArchive = async (id: string) => {
    if (!confirm(`Are you sure you want to ${v.commitment_archive_verb.toLowerCase()} this item? It will be hidden but not deleted.`)) return;
    await archiveCommitment(id);
    await logChange(engagement.id, id, 'commitment_archived');
    await refresh();
    toast.success('Archived');
  };

  const handleScopeExtension = async (commitmentId: string, category: ScopeExtensionCategory, narrative: string) => {
    await createScopeExtension(commitmentId, category, narrative);
    await refresh();
  };

  const openAddDialog = async (kind: CommitmentKind, parentId: string | null = null) => {
    setAddKind(kind);
    setAddParentId(parentId);
    setAddTitle('');
    setAddDescription('');
    setAddSuccessSignal('');
    setCountWarning(null);

    // Check count if adding a top-level commitment
    if (kind === 'top') {
      const current = await countActiveTopCommitments(engagement.id);
      if (current >= engagement.top_count_hard_cap) {
        setCountWarning(
          `You have ${current} active ${v.commitment_top_plural.toLowerCase()}, which is at the hard cap of ${engagement.top_count_hard_cap}. ` +
          `You must ${v.commitment_archive_verb.toLowerCase()} an existing ${v.commitment_top_singular.toLowerCase()} before adding a new one.`
        );
      } else if (current >= engagement.top_count_warning) {
        setCountWarning(
          `You have ${current} active ${v.commitment_top_plural.toLowerCase()}. ` +
          `Research suggests ${engagement.top_count_warning - 1} or fewer is more effective for governance focus.`
        );
      }
    }

    setShowAddDialog(true);
  };

  const handleAdd = async () => {
    if (!addTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    // Hard cap enforcement for top-level
    if (addKind === 'top') {
      const current = await countActiveTopCommitments(engagement.id);
      if (current >= engagement.top_count_hard_cap) {
        toast.error(`Cannot exceed ${engagement.top_count_hard_cap} active ${v.commitment_top_plural.toLowerCase()}. ${v.commitment_archive_verb} one first.`);
        return;
      }
    }

    const maxOrder = commitments
      .filter(c => c.kind === addKind && c.parent_id === addParentId)
      .reduce((max, c) => Math.max(max, c.order_index), -1);

    const created = await createCommitment(engagement.id, {
      kind: addKind,
      title: addTitle.trim(),
      description: addDescription.trim() || undefined,
      success_signal: addSuccessSignal.trim() || undefined,
      parent_id: addParentId ?? undefined,
      order_index: maxOrder + 1,
    });

    await logChange(engagement.id, created.id, 'commitment_created', addDescription.trim() || undefined);
    await refresh();
    setShowAddDialog(false);
    toast.success(`${addKind === 'top' ? v.commitment_top_singular : addKind === 'sub' ? v.commitment_sub_singular : v.cross_cut_singular} created`);
  };

  const kindLabel = addKind === 'top'
    ? v.commitment_top_singular
    : addKind === 'sub'
      ? v.commitment_sub_singular
      : v.cross_cut_singular;

  return (
    <div className="space-y-6">
      {/* ── Priorities ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{v.commitment_top_plural}</h3>
          {isEngagementAdmin && (
            <Button size="sm" variant="outline" onClick={() => openAddDialog('top')}>
              <Plus className="w-3 h-3 mr-1" />
              Add {v.commitment_top_singular}
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {priorities.map(p => {
            const initiatives = getInitiatives(p.id);
            const isExpanded = expandedIds.has(p.id);
            return (
              <div key={p.id}>
                <div
                  className="flex items-center gap-2 cursor-pointer select-none mb-1"
                  onClick={() => toggleExpand(p.id)}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">
                    ({initiatives.length} {initiatives.length === 1
                      ? v.commitment_sub_singular.toLowerCase()
                      : v.commitment_sub_plural.toLowerCase()})
                  </span>
                </div>

                {isExpanded && (
                  <div className="ml-6 space-y-2">
                    <CommitmentForm
                      commitment={p}
                      onSave={data => handleSave(p.id, data)}
                      onArchive={() => handleArchive(p.id)}
                      onScopeExtension={(cat, narr) => handleScopeExtension(p.id, cat, narr)}
                      vocabulary={v}
                      isAdmin={isEngagementAdmin}
                    />

                    {initiatives.map(i => (
                      <div key={i.id} className="ml-4">
                        <CommitmentForm
                          commitment={i}
                          onSave={data => handleSave(i.id, data)}
                          onArchive={() => handleArchive(i.id)}
                          onScopeExtension={(cat, narr) => handleScopeExtension(i.id, cat, narr)}
                          vocabulary={v}
                          isAdmin={isEngagementAdmin}
                        />
                      </div>
                    ))}

                    {isEngagementAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-4 text-xs"
                        onClick={() => openAddDialog('sub', p.id)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add {v.commitment_sub_singular} under {p.title}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {priorities.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No {v.commitment_top_plural.toLowerCase()} yet.
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* ── Lenses ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{v.cross_cut_plural}</h3>
          {isEngagementAdmin && (
            <Button size="sm" variant="outline" onClick={() => openAddDialog('cross_cut')}>
              <Plus className="w-3 h-3 mr-1" />
              Add {v.cross_cut_singular}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {lenses.map(l => (
            <CommitmentForm
              key={l.id}
              commitment={l}
              onSave={data => handleSave(l.id, data)}
              onArchive={() => handleArchive(l.id)}
              onScopeExtension={(cat, narr) => handleScopeExtension(l.id, cat, narr)}
              vocabulary={v}
              isAdmin={isEngagementAdmin}
            />
          ))}
          {lenses.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No {v.cross_cut_plural.toLowerCase()} yet.
            </p>
          )}
        </div>
      </div>

      {/* ── Add dialog ─────────────────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {kindLabel}</DialogTitle>
            <DialogDescription>
              {addKind === 'sub' && addParentId
                ? `This ${v.commitment_sub_singular.toLowerCase()} will be nested under the selected ${v.commitment_top_singular.toLowerCase()}.`
                : addKind === 'cross_cut'
                  ? `${v.cross_cut_plural} are cross-cutting tags that apply across all ${v.commitment_top_plural.toLowerCase()}.`
                  : `${v.commitment_top_plural} are the highest-level commitments in this engagement.`}
            </DialogDescription>
          </DialogHeader>

          {countWarning && (
            <div className="flex gap-2 p-3 rounded bg-yellow-50 border border-yellow-200 text-sm">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <span className="text-yellow-800">{countWarning}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                placeholder={`${kindLabel} title`}
                autoFocus
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={addDescription}
                onChange={e => setAddDescription(e.target.value)}
                rows={3}
                placeholder={`What does this ${kindLabel.toLowerCase()} mean for the organisation?`}
              />
            </div>
            <div>
              <Label>Success signal</Label>
              <Input
                value={addSuccessSignal}
                onChange={e => setAddSuccessSignal(e.target.value)}
                placeholder="How will you know this succeeded?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={handleAdd}
              disabled={!addTitle.trim() || (addKind === 'top' && countWarning?.includes('hard cap'))}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add {kindLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
