import { useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import type { EngagementStage, StageType, StageStatus } from '@/types/engagement';
import { createStage, updateStage, deleteStage } from '@/lib/commitmentApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Save, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

const STAGE_TYPES: { value: StageType; label: string }[] = [
  { value: 'interview', label: 'Interview' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'report', label: 'Report' },
  { value: 'checkpoint', label: 'Checkpoint' },
  { value: 'board_review', label: 'Board Review' },
  { value: 'retrospective', label: 'Retrospective' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'survey_run', label: 'Survey Run' },
  { value: 'reporting_cycle', label: 'Reporting Cycle' },
];

const STATUS_BADGE: Record<StageStatus, 'default' | 'secondary' | 'outline'> = {
  draft: 'outline',
  open: 'default',
  closed: 'secondary',
  archived: 'outline',
};

interface StageFormProps {
  stage: EngagementStage;
  isAdmin: boolean;
  onRefresh: () => Promise<void>;
}

function StageForm({ stage, isAdmin, onRefresh }: StageFormProps) {
  const [title, setTitle] = useState(stage.title);
  const [description, setDescription] = useState(stage.description ?? '');
  const [stageType, setStageType] = useState(stage.stage_type);
  const [status, setStatus] = useState(stage.status);
  const [neraPrompt, setNeraPrompt] = useState(stage.nera_system_prompt ?? '');
  const [isRecurring, setIsRecurring] = useState(stage.is_recurring);
  const [recurrencePattern, setRecurrencePattern] = useState(stage.recurrence_pattern ?? '');
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateStage(stage.id, {
        title, description: description || undefined, stage_type: stageType,
        status, nera_system_prompt: neraPrompt || undefined,
        is_recurring: isRecurring, recurrence_pattern: recurrencePattern || undefined,
      });
      await onRefresh();
      toast.success('Stage saved');
    } catch {
      toast.error('Failed to save stage');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this stage? This cannot be undone.')) return;
    try {
      await deleteStage(stage.id);
      await onRefresh();
      toast.success('Stage deleted');
    } catch {
      toast.error('Failed to delete stage');
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Badge variant={STATUS_BADGE[stage.status]} className="text-xs">{stage.status}</Badge>
        <Badge variant="outline" className="text-xs">{stage.stage_type}</Badge>
        <span className="font-medium text-sm">{stage.title}</span>
      </div>

      {expanded && (
        <div className="ml-6 space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} disabled={!isAdmin} />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={stageType} onValueChange={v => setStageType(v as StageType)} disabled={!isAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} disabled={!isAdmin} />
          </div>

          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={v => setStatus(v as StageStatus)} disabled={!isAdmin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Nera system prompt (optional)</Label>
            <Textarea value={neraPrompt} onChange={e => setNeraPrompt(e.target.value)} rows={3} className="text-sm" disabled={!isAdmin}
              placeholder="Custom Nera prompt for this stage. Leave blank to use the profile default." />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} disabled={!isAdmin} />
            <Label className="text-xs">Recurring stage</Label>
            {isRecurring && (
              <Input value={recurrencePattern} onChange={e => setRecurrencePattern(e.target.value)} placeholder="e.g. every_6_weeks" className="text-xs ml-2 w-48" disabled={!isAdmin} />
            )}
          </div>

          {isAdmin && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="w-3 h-3 mr-1" /> Save
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={handleDelete}>
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StageEditor() {
  const { engagement, stages, isEngagementAdmin, refresh } = useEngagement();
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addType, setAddType] = useState<StageType>('workshop');
  const [addDescription, setAddDescription] = useState('');

  if (!engagement) return null;

  const handleAdd = async () => {
    if (!addTitle.trim()) { toast.error('Title is required'); return; }
    try {
      await createStage(engagement.id, {
        title: addTitle.trim(),
        stage_type: addType,
        description: addDescription.trim() || undefined,
        order_index: stages.length,
      });
      await refresh();
      setShowAdd(false);
      setAddTitle('');
      setAddDescription('');
      toast.success('Stage created');
    } catch {
      toast.error('Failed to create stage');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Stages</h3>
        {isEngagementAdmin && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="w-3 h-3 mr-1" /> Add stage
          </Button>
        )}
      </div>

      {stages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stages defined yet.</p>
      ) : (
        stages.map(s => (
          <StageForm key={s.id} stage={s} isAdmin={isEngagementAdmin} onRefresh={refresh} />
        ))
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={addTitle} onChange={e => setAddTitle(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={addType} onValueChange={v => setAddType(v as StageType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={addDescription} onChange={e => setAddDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!addTitle.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Add stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
