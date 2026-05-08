import { useState, useRef } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { uploadDocument, triggerIngestion, linkDocumentToCommitments } from '@/lib/documentApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, FileUp, Loader2, AlertTriangle } from 'lucide-react';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.md,.txt,.xlsx,.xls,.csv,.json,.png,.jpg,.jpeg,.webp';

// Radix Select disallows empty-string item values, so use a sentinel for "no primary"
const NONE_VALUE = '__none__';

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const { engagement, commitments } = useEngagement();
  const v = useVocabulary();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [primaryCommitmentId, setPrimaryCommitmentId] = useState<string>('');
  const [additionalCommitmentIds, setAdditionalCommitmentIds] = useState<Set<string>>(new Set());
  const [containsPii, setContainsPii] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  if (!engagement) return null;

  const topCommitments = commitments.filter(c => c.kind === 'top' && c.status === 'active');
  const subCommitments = commitments.filter(c => c.kind === 'sub' && c.status === 'active');
  const lenses = commitments.filter(c => c.kind === 'cross_cut' && c.status === 'active');

  // Grouped: top + their children for the primary selector
  const commitmentOptions = [
    ...topCommitments.map(p => ({
      id: p.id,
      label: p.title,
      indent: false,
    })),
    ...subCommitments.map(s => {
      const parent = topCommitments.find(p => p.id === s.parent_id);
      return {
        id: s.id,
        label: parent ? `${parent.title} → ${s.title}` : s.title,
        indent: true,
      };
    }),
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    if (!title) {
      // Auto-fill title from filename (without extension)
      setTitle(selected.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    setFile(dropped);
    if (!title) {
      setTitle(dropped.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const toggleAdditionalCommitment = (id: string) => {
    setAdditionalCommitmentIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error('Please select a file and provide a title');
      return;
    }

    setUploading(true);
    try {
      // 1. Upload file and create st_documents row
      const doc = await uploadDocument(engagement.id, file, {
        title: title.trim(),
        description: description.trim() || undefined,
        primaryCommitmentId: primaryCommitmentId || undefined,
        containsPii,
      });

      // 2. Link to commitments — primary as 'primary', lenses/extras as 'tagged'
      if (primaryCommitmentId) {
        await linkDocumentToCommitments(doc.id, [primaryCommitmentId], 'primary');
      }
      const taggedLinks = Array.from(additionalCommitmentIds).filter(id => id !== primaryCommitmentId);
      if (taggedLinks.length > 0) {
        await linkDocumentToCommitments(doc.id, taggedLinks, 'tagged');
      }

      toast.success('Document uploaded successfully');

      // 3. Trigger ingestion (async — don't block the UI)
      setIngesting(true);
      try {
        await triggerIngestion(doc.id);
        toast.success(`Document chunked: ${doc.title}`);
      } catch (err) {
        // Ingestion failure is non-blocking — the document is saved,
        // ingestion can be retried from the document list
        const msg = err instanceof Error ? err.message : 'Ingestion failed';
        toast.error(`Upload succeeded but chunking failed: ${msg}. You can retry from the document list.`);
      } finally {
        setIngesting(false);
      }

      // 4. Reset form
      setFile(null);
      setTitle('');
      setDescription('');
      setPrimaryCommitmentId('');
      setAdditionalCommitmentIds(new Set());
      setContainsPii(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onUploadComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const isWorking = uploading || ingesting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="w-5 h-5" />
          Upload {v.evidence_singular}
        </CardTitle>
        <CardDescription>
          Upload a {v.evidence_singular.toLowerCase()} and Nera will chunk it into the knowledge base,
          linked to the {v.commitment_top_plural.toLowerCase()} and {v.cross_cut_plural.toLowerCase()} you select.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileSelect}
            className="hidden"
          />
          {file ? (
            <div className="space-y-1">
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB — click or drop to replace
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop a file, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, Word, Markdown, text, Excel, CSV, JSON, images
              </p>
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <Label>Title</Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Document title"
            disabled={isWorking}
          />
        </div>

        {/* Description */}
        <div>
          <Label>Description (optional)</Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief description of what this document contains"
            disabled={isWorking}
          />
        </div>

        {/* Primary commitment */}
        <div>
          <Label>Primary {v.commitment_top_singular} / {v.commitment_sub_singular}</Label>
          <Select
            value={primaryCommitmentId || NONE_VALUE}
            onValueChange={val => setPrimaryCommitmentId(val === NONE_VALUE ? '' : val)}
            disabled={isWorking}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select a ${v.commitment_top_singular.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>None</SelectItem>
              {commitmentOptions.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.indent ? `  ↳ ${opt.label}` : opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lens tags */}
        {lenses.length > 0 && (
          <div>
            <Label>{v.cross_cut_plural} (optional tags)</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {lenses.map(l => {
                const selected = additionalCommitmentIds.has(l.id);
                return (
                  <Badge
                    key={l.id}
                    variant={selected ? 'default' : 'outline'}
                    className="cursor-pointer select-none"
                    onClick={() => !isWorking && toggleAdditionalCommitment(l.id)}
                  >
                    {l.title}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* PII checkbox */}
        <div className="flex items-start gap-2 p-3 rounded border bg-muted/50">
          <Checkbox
            id="pii-check"
            checked={containsPii}
            onCheckedChange={v => setContainsPii(v === true)}
            disabled={isWorking}
          />
          <div>
            <Label htmlFor="pii-check" className="text-sm font-medium cursor-pointer">
              This document may contain personally identifiable information
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              If checked, Nera will not quote verbatim from this document in any output.
              Aggregate analysis is still performed. Individual patient information must
              never be uploaded — see the tool's data policy.
            </p>
          </div>
        </div>

        {/* Upload button */}
        <Button
          onClick={handleUpload}
          disabled={!file || !title.trim() || isWorking}
          className="w-full"
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
          ) : ingesting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Chunking with Nera...</>
          ) : (
            <><Upload className="w-4 h-4 mr-2" /> Upload and chunk</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
