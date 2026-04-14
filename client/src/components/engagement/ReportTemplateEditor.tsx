import { useState, useEffect } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate } from '@/lib/reportApi';
import type { ReportingTemplate } from '@/types/engagement';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';

export function ReportTemplateEditor() {
  const { engagement } = useEngagement();
  const [templates, setTemplates] = useState<ReportingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<ReportingTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFunderType, setFormFunderType] = useState('');
  const [formMarkdown, setFormMarkdown] = useState('');

  const load = async () => {
    if (!engagement) return;
    setLoading(true);
    try {
      const data = await fetchTemplates(engagement.id);
      setTemplates(data);
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [engagement?.id]);

  const openNew = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormFunderType('');
    setFormMarkdown('# Report Title\n\n## Section 1\n\n{placeholder}\n\n## Section 2\n\n{placeholder}\n');
    setIsDialogOpen(true);
  };

  const openEdit = (tpl: ReportingTemplate) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormDescription(tpl.description ?? '');
    setFormFunderType(tpl.funder_type ?? '');
    setFormMarkdown(tpl.template_markdown);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!engagement) return;
    if (!formName.trim() || !formMarkdown.trim()) {
      toast.error('Name and template content are required');
      return;
    }

    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          funder_type: formFunderType.trim() || null,
          template_markdown: formMarkdown,
        });
        toast.success('Template updated');
      } else {
        await createTemplate({
          engagement_id: engagement.id,
          name: formName.trim(),
          description: formDescription.trim() || null,
          funder_type: formFunderType.trim() || null,
          template_markdown: formMarkdown,
        });
        toast.success('Template created');
      }
      setIsDialogOpen(false);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      toast.success('Template deleted');
      load();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading templates...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Report Templates</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="w-3 h-3 mr-1" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'New Report Template'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label htmlFor="tpl-name">Template name</Label>
                <Input
                  id="tpl-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Board Pre-Read, PHN Quarterly"
                />
              </div>
              <div>
                <Label htmlFor="tpl-desc">Description (optional)</Label>
                <Input
                  id="tpl-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What this template is for"
                />
              </div>
              <div>
                <Label htmlFor="tpl-funder">Funder type (optional)</Label>
                <Input
                  id="tpl-funder"
                  value={formFunderType}
                  onChange={(e) => setFormFunderType(e.target.value)}
                  placeholder="e.g. PHN quarterly, state health annual"
                />
              </div>
              <div>
                <Label htmlFor="tpl-md">Template (markdown with {'{placeholders}'})</Label>
                <Textarea
                  id="tpl-md"
                  value={formMarkdown}
                  onChange={(e) => setFormMarkdown(e.target.value)}
                  rows={16}
                  className="font-mono text-sm"
                  placeholder="# Report Title..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {'{for_each_priority}'}, {'{priority_title}'}, {'{rag_status}'}, {'{drift_signals_narrative}'}, etc. as placeholders. Nera fills them from the evidence corpus.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingTemplate ? 'Save Changes' : 'Create Template'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No templates yet. Create one or seed from a profile.
        </p>
      ) : (
        <div className="grid gap-3">
          {templates.map((tpl) => (
            <Card key={tpl.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{tpl.name}</CardTitle>
                    {!tpl.engagement_id && (
                      <Badge variant="outline" className="text-xs">Global</Badge>
                    )}
                    {tpl.funder_type && (
                      <Badge variant="secondary" className="text-xs">{tpl.funder_type}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(tpl)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDelete(tpl.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {tpl.description && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">{tpl.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
