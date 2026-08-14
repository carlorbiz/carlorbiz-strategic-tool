import { useState, useRef } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import {
  uploadDocument,
  triggerIngestion,
  linkDocumentToCommitments,
  createDocumentRecord,
  ingestExtractedText,
  type IngestProgress,
} from '@/lib/documentApi';
import { extractTextFromFile, isExtractable, splitIntoSegments } from '@/lib/extractText';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Upload, FileUp, Loader2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [progress, setProgress] = useState<IngestProgress | null>(null);

  // Research metadata (optional — surfaced via collapsible section)
  const [showResearchMeta, setShowResearchMeta] = useState(false);
  const [authors, setAuthors] = useState('');
  const [institution, setInstitution] = useState('');
  const [publicationYear, setPublicationYear] = useState('');
  const [journal, setJournal] = useState('');
  const [doi, setDoi] = useState('');
  const [externalLink, setExternalLink] = useState('');

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
      const parsedYear = publicationYear.trim() ? Number(publicationYear) : undefined;
      const metadata = {
        title: title.trim(),
        description: description.trim() || undefined,
        primaryCommitmentId: primaryCommitmentId || undefined,
        containsPii,
        authors: authors.trim() || undefined,
        institution: institution.trim() || undefined,
        publicationYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
        journal: journal.trim() || undefined,
        doi: doi.trim() || undefined,
        externalLink: externalLink.trim() || undefined,
      };

      if (isExtractable(file.name)) {
        // ── Sovereign path: the file never leaves this machine ──
        // 1. Extract text in the browser
        const extraction = await extractTextFromFile(file);
        const thinText = !extraction.text || extraction.text.trim().length < 200;
        const scannedPdf = extraction.warnings.some(w => w.includes('scanned'));
        if (thinText || scannedPdf) {
          toast.error(
            extraction.warnings[0] ??
            'No readable text found in this file. Please upload a text-based version.',
          );
          return;
        }
        for (const w of extraction.warnings) toast.warning(w);

        // 2. Create the document record — no file upload, file_path stays NULL
        const doc = await createDocumentRecord(engagement.id, file, metadata);

        // 3. Link to commitments
        if (primaryCommitmentId) {
          await linkDocumentToCommitments(doc.id, [primaryCommitmentId], 'primary');
        }
        const taggedLinks = Array.from(additionalCommitmentIds).filter(id => id !== primaryCommitmentId);
        if (taggedLinks.length > 0) {
          await linkDocumentToCommitments(doc.id, taggedLinks, 'tagged');
        }

        // 4. Ingest segment by segment with live progress
        setUploading(false);
        setIngesting(true);
        try {
          const segments = splitIntoSegments(extraction.text, 10000);
          const final = await ingestExtractedText(doc.id, segments, setProgress);
          toast.success(`${doc.title}: ${final.chunksInserted} knowledge chunks indexed. The file itself never left your machine.`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Ingestion failed';
          toast.error(`Indexing stopped: ${msg}. Upload the file again to retry — nothing is duplicated on retry.`);
          return;
        } finally {
          setIngesting(false);
          setProgress(null);
        }
      } else {
        // ── Legacy path (images, spreadsheets): requires storing the file ──
        const doc = await uploadDocument(engagement.id, file, metadata);
        if (primaryCommitmentId) {
          await linkDocumentToCommitments(doc.id, [primaryCommitmentId], 'primary');
        }
        const taggedLinks = Array.from(additionalCommitmentIds).filter(id => id !== primaryCommitmentId);
        if (taggedLinks.length > 0) {
          await linkDocumentToCommitments(doc.id, taggedLinks, 'tagged');
        }
        toast.success('Document uploaded');
        setIngesting(true);
        try {
          await triggerIngestion(doc.id);
          toast.success(`Document chunked: ${doc.title}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Ingestion failed';
          toast.error(`Upload succeeded but chunking failed: ${msg}. You can retry from the document list.`);
        } finally {
          setIngesting(false);
        }
      }

      // 4. Reset form
      setFile(null);
      setTitle('');
      setDescription('');
      setPrimaryCommitmentId('');
      setAdditionalCommitmentIds(new Set());
      setContainsPii(false);
      setAuthors('');
      setInstitution('');
      setPublicationYear('');
      setJournal('');
      setDoi('');
      setExternalLink('');
      setShowResearchMeta(false);
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

        {/* Research metadata (optional) */}
        <Collapsible open={showResearchMeta} onOpenChange={setShowResearchMeta}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={isWorking}
            >
              {showResearchMeta ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Research metadata (optional)
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 border-l-2 border-muted pl-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="authors">Authors</Label>
                <Input
                  id="authors"
                  value={authors}
                  onChange={e => setAuthors(e.target.value)}
                  placeholder="Smith J, Lee K, et al."
                  disabled={isWorking}
                />
              </div>
              <div>
                <Label htmlFor="institution">Institution</Label>
                <Input
                  id="institution"
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                  placeholder="Macquarie University"
                  disabled={isWorking}
                />
              </div>
              <div>
                <Label htmlFor="publication_year">Year</Label>
                <Input
                  id="publication_year"
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={2100}
                  value={publicationYear}
                  onChange={e => setPublicationYear(e.target.value)}
                  placeholder="2025"
                  disabled={isWorking}
                />
              </div>
              <div>
                <Label htmlFor="journal">Journal / venue</Label>
                <Input
                  id="journal"
                  value={journal}
                  onChange={e => setJournal(e.target.value)}
                  placeholder="The Australian Journal of Rural Health"
                  disabled={isWorking}
                />
              </div>
              <div>
                <Label htmlFor="doi">Citation / reference ID</Label>
                <Input
                  id="doi"
                  value={doi}
                  onChange={e => setDoi(e.target.value)}
                  placeholder="DOI, abstract number, or other ID"
                  disabled={isWorking}
                />
              </div>
              <div>
                <Label htmlFor="external_link">External link</Label>
                <Input
                  id="external_link"
                  type="url"
                  value={externalLink}
                  onChange={e => setExternalLink(e.target.value)}
                  placeholder="https://doi.org/..."
                  disabled={isWorking}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

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

        {/* Live ingest progress */}
        {ingesting && progress && (
          <div className="rounded border bg-muted/50 p-3 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Indexing segment {progress.segmentsDone} of {progress.segmentsTotal}
              </span>
              <span>{progress.chunksInserted} knowledge chunks</span>
            </div>
            <div className="h-1.5 w-full rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round((progress.segmentsDone / Math.max(1, progress.segmentsTotal)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload button */}
        <Button
          onClick={handleUpload}
          disabled={!file || !title.trim() || isWorking}
          className="w-full"
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reading file in your browser...</>
          ) : ingesting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Indexing with Nera...</>
          ) : (
            <><Upload className="w-4 h-4 mr-2" /> Index this document</>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          PDFs and documents are read in your browser — the file itself never leaves
          your machine. Only the extracted knowledge is indexed, and it can be
          deleted on request at any time.
        </p>
      </CardContent>
    </Card>
  );
}
