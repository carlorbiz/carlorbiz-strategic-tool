import { useState, useEffect } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import {
  fetchTemplates,
  fetchReports,
  fetchReport,
  generateReport,
  updateReport,
  deleteReport,
} from '@/lib/reportApi';
import type { ReportingTemplate, ComplianceReport } from '@/types/engagement';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Loader2,
  FileText,
  Check,
  Send,
  Download,
  Trash2,
  Eye,
  Pencil,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  review: 'In Review',
  approved: 'Approved',
  delivered: 'Delivered',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  review: 'secondary',
  approved: 'default',
  delivered: 'default',
};

export function ReportGenerator() {
  const { engagement } = useEngagement();
  const v = useVocabulary();
  const [templates, setTemplates] = useState<ReportingTemplate[]>([]);
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Generation form
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [reportTitle, setReportTitle] = useState('');

  // Review dialog
  const [reviewReport, setReviewReport] = useState<ComplianceReport | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!engagement) return;
    setLoading(true);
    try {
      const [tpls, rpts] = await Promise.all([
        fetchTemplates(engagement.id),
        fetchReports(engagement.id),
      ]);
      setTemplates(tpls);
      setReports(rpts);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [engagement?.id]);

  const handleGenerate = async () => {
    if (!engagement || !selectedTemplateId) return;
    setGenerating(true);
    try {
      const result = await generateReport({
        engagement_id: engagement.id,
        template_id: selectedTemplateId,
        title: reportTitle || undefined,
        period_start: periodStart || undefined,
        period_end: periodEnd || undefined,
      });
      toast.success(`Report generated — ${result.citation_count} citations`);
      load();
      // Reset form
      setSelectedTemplateId('');
      setPeriodStart('');
      setPeriodEnd('');
      setReportTitle('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const openReview = async (report: ComplianceReport) => {
    // Re-fetch to get latest content
    const full = await fetchReport(report.id);
    if (full) {
      setReviewReport(full);
      setEditedContent(full.content_markdown ?? '');
    }
  };

  const handleSaveEdits = async () => {
    if (!reviewReport) return;
    setSaving(true);
    try {
      const updated = await updateReport(reviewReport.id, {
        content_markdown: editedContent,
      });
      setReviewReport(updated);
      toast.success('Report saved');
      load();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (reportId: string, newStatus: string) => {
    try {
      await updateReport(reportId, { status: newStatus as ComplianceReport['status'] });
      toast.success(`Report moved to ${STATUS_LABELS[newStatus]}`);
      if (reviewReport?.id === reportId) {
        setReviewReport((prev) => prev ? { ...prev, status: newStatus as ComplianceReport['status'] } : null);
      }
      load();
    } catch {
      toast.error('Status update failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReport(id);
      toast.success('Report deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleExportPdf = (report: ComplianceReport) => {
    // Create a printable HTML document and trigger browser print/save as PDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked — allow pop-ups for PDF export');
      return;
    }

    // Simple markdown → HTML (headings, paragraphs, lists, bold)
    const html = (report.content_markdown ?? '')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/^(?!<[hulo])(.+)$/gm, '<p>$1</p>');

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${report.title}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.8em; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { font-size: 1.3em; margin-top: 1.5em; color: #333; }
  h3 { font-size: 1.1em; color: #555; }
  p { margin: 0.5em 0; }
  ul { margin: 0.5em 0; padding-left: 1.5em; }
  .meta { color: #666; font-size: 0.9em; margin-bottom: 2em; }
  .citation { color: #888; font-size: 0.8em; }
  @media print { body { margin: 20px; } }
</style></head><body>
<div class="meta">
  <strong>${report.title}</strong><br>
  Period: ${report.period_start ?? 'inception'} to ${report.period_end ?? 'now'}<br>
  Generated: ${new Date(report.created_at).toLocaleDateString('en-AU')}<br>
  Status: ${STATUS_LABELS[report.status] ?? report.status}
</div>
${html}
${report.citations.length > 0 ? `
<hr>
<h2>Source Citations</h2>
<div class="citation">
${report.citations.map((c, i) => `<p>${i + 1}. ${c.claim} — <em>${c.source_type}/${c.source_document ?? 'unknown'}</em></p>`).join('')}
</div>` : ''}
</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading reports...</p>;
  }

  return (
    <div className="space-y-6">
      {/* ── Generate new report ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Generate Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.funder_type ? `(${t.funder_type})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title (optional)</Label>
              <Input
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Auto-generated if blank"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Period start</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <Label>Period end</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!selectedTemplateId || generating}
          >
            {generating ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
            ) : (
              <><FileText className="w-3 h-3 mr-1" /> Generate Report</>
            )}
          </Button>
          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No templates available. Create one in the Settings tab first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Report list ────────────────────────────────── */}
      {reports.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Reports</h3>
          {reports.map((rpt) => (
            <Card key={rpt.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{rpt.title}</CardTitle>
                    <Badge variant={STATUS_VARIANTS[rpt.status]}>
                      {STATUS_LABELS[rpt.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openReview(rpt)}>
                      {rpt.status === 'draft' ? (
                        <Pencil className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleExportPdf(rpt)}>
                      <Download className="w-3 h-3" />
                    </Button>
                    {rpt.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDelete(rpt.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  {rpt.period_start ?? 'inception'} to {rpt.period_end ?? 'now'} — {rpt.citations.length} citations — {new Date(rpt.created_at).toLocaleDateString('en-AU')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Review dialog (side-by-side) ───────────────── */}
      <Dialog open={!!reviewReport} onOpenChange={(open) => !open && setReviewReport(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{reviewReport?.title}</DialogTitle>
              <div className="flex items-center gap-2">
                {reviewReport?.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reviewReport && handleStatusChange(reviewReport.id, 'review')}
                  >
                    <Eye className="w-3 h-3 mr-1" /> Move to Review
                  </Button>
                )}
                {reviewReport?.status === 'review' && (
                  <Button
                    size="sm"
                    onClick={() => reviewReport && handleStatusChange(reviewReport.id, 'approved')}
                  >
                    <Check className="w-3 h-3 mr-1" /> Approve
                  </Button>
                )}
                {reviewReport?.status === 'approved' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reviewReport && handleExportPdf(reviewReport)}
                    >
                      <Download className="w-3 h-3 mr-1" /> Export PDF
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => reviewReport && handleStatusChange(reviewReport.id, 'delivered')}
                    >
                      <Send className="w-3 h-3 mr-1" /> Mark Delivered
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden mt-2">
            {/* Left: editable draft */}
            <div className="flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">Report Draft</Label>
                {reviewReport?.status === 'draft' && (
                  <Button size="sm" variant="outline" onClick={handleSaveEdits} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Edits'}
                  </Button>
                )}
              </div>
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                readOnly={reviewReport?.status !== 'draft'}
                className="flex-1 font-mono text-xs resize-none min-h-[400px]"
              />
            </div>

            {/* Right: citations / source evidence */}
            <div className="flex flex-col overflow-hidden">
              <Label className="text-xs font-medium mb-2">
                Source Citations ({reviewReport?.citations.length ?? 0})
              </Label>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {reviewReport?.citations.length === 0 && (
                  <p className="text-xs text-muted-foreground">No citations in this report.</p>
                )}
                {reviewReport?.citations.map((cit, i) => (
                  <Card key={i} className="p-2">
                    <p className="text-xs">{cit.claim}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Source: {cit.source_type}/{cit.source_document ?? 'unknown'} — <code className="text-[10px]">{cit.source_chunk_id.slice(0, 8)}</code>
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
