import { useState, useRef } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { uploadSurvey, triggerSurveyIngestion } from '@/lib/surveyApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';

const ACCEPTED_TYPES = '.xlsx,.xls,.csv,.json';

interface SurveyUploadProps {
  onUploadComplete?: () => void;
}

export function SurveyUpload({ onUploadComplete }: SurveyUploadProps) {
  const { engagement } = useEngagement();
  const v = useVocabulary();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [period, setPeriod] = useState('');
  const [containsPii, setContainsPii] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  if (!engagement) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    if (!name) {
      setName(selected.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    setFile(dropped);
    if (!name) {
      setName(dropped.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) {
      toast.error('Please select a file and provide a name');
      return;
    }

    setUploading(true);
    try {
      const survey = await uploadSurvey(engagement.id, file, {
        name: name.trim(),
        period: period.trim() || undefined,
        containsPii,
      });

      toast.success('Survey uploaded successfully');

      // Trigger ingestion (async)
      setIngesting(true);
      try {
        await triggerSurveyIngestion(survey.id);
        toast.success(`Survey analysed: ${survey.name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ingestion failed';
        toast.error(`Upload succeeded but analysis failed: ${msg}. You can retry from the survey list.`);
      } finally {
        setIngesting(false);
      }

      // Reset form
      setFile(null);
      setName('');
      setPeriod('');
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
          <FileSpreadsheet className="w-5 h-5" />
          Upload Survey
        </CardTitle>
        <CardDescription>
          Upload a survey export (Excel, CSV, or JSON) and Nera will analyse responses,
          extract themes, and add findings to the knowledge base linked to your {v.commitment_top_plural.toLowerCase()}.
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
                Drag and drop a survey file, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Excel (.xlsx, .xls), CSV, or JSON
              </p>
            </div>
          )}
        </div>

        {/* Survey name */}
        <div>
          <Label>Survey Name</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. 2026 Staff Satisfaction Survey"
            disabled={isWorking}
          />
        </div>

        {/* Period */}
        <div>
          <Label>Period (optional)</Label>
          <Input
            value={period}
            onChange={e => setPeriod(e.target.value)}
            placeholder="e.g. 2026 Q1, March 2026, Annual 2025"
            disabled={isWorking}
          />
        </div>

        {/* PII checkbox */}
        <div className="flex items-start gap-2 p-3 rounded border bg-muted/50">
          <Checkbox
            id="survey-pii-check"
            checked={containsPii}
            onCheckedChange={v => setContainsPii(v === true)}
            disabled={isWorking}
          />
          <div>
            <Label htmlFor="survey-pii-check" className="text-sm font-medium cursor-pointer">
              This survey may contain personally identifiable information
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              If checked, Nera will not quote individual responses verbatim.
              Aggregate analysis and themes are still extracted.
            </p>
          </div>
        </div>

        {/* Upload button */}
        <Button
          onClick={handleUpload}
          disabled={!file || !name.trim() || isWorking}
          className="w-full"
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
          ) : ingesting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analysing with Nera...</>
          ) : (
            <><Upload className="w-4 h-4 mr-2" /> Upload and analyse</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
