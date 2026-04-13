import { useState, useEffect } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { updateEngagementSettings, updateVocabularyMap } from '@/lib/commitmentApi';
import type { TaxonomyStrictness, VocabularyMap } from '@/types/engagement';
import { DEFAULT_VOCABULARY } from '@/types/engagement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export function EngagementSettings() {
  const { engagement, aiConfig, isEngagementAdmin, refresh } = useEngagement();
  const v = useVocabulary();

  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [strictness, setStrictness] = useState<TaxonomyStrictness>('soft');
  const [topCountWarning, setTopCountWarning] = useState(6);
  const [topCountHardCap, setTopCountHardCap] = useState(7);
  const [pulseCadenceDays, setPulseCadenceDays] = useState(42);
  const [vocabMap, setVocabMap] = useState<VocabularyMap>(DEFAULT_VOCABULARY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!engagement) return;
    setName(engagement.name);
    setClientName(engagement.client_name ?? '');
    setDescription(engagement.description ?? '');
    setStrictness(engagement.taxonomy_strictness);
    setTopCountWarning(engagement.top_count_warning);
    setTopCountHardCap(engagement.top_count_hard_cap);
    setPulseCadenceDays(engagement.pulse_cadence_days);
  }, [engagement]);

  useEffect(() => {
    if (aiConfig?.vocabulary_map) {
      setVocabMap({ ...DEFAULT_VOCABULARY, ...aiConfig.vocabulary_map });
    }
  }, [aiConfig]);

  if (!engagement) return null;

  const handleSaveEngagement = async () => {
    setSaving(true);
    try {
      await updateEngagementSettings(engagement.id, {
        name, client_name: clientName || undefined, description: description || undefined,
        taxonomy_strictness: strictness, top_count_warning: topCountWarning,
        top_count_hard_cap: topCountHardCap, pulse_cadence_days: pulseCadenceDays,
      });
      await refresh();
      toast.success('Engagement settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVocabulary = async () => {
    if (!aiConfig) {
      toast.error('No AI config found for this engagement');
      return;
    }
    setSaving(true);
    try {
      await updateVocabularyMap(aiConfig.id, vocabMap);
      await refresh();
      toast.success('Vocabulary saved — headings will update across the app');
    } catch {
      toast.error('Failed to save vocabulary');
    } finally {
      setSaving(false);
    }
  };

  const updateVocab = (key: keyof VocabularyMap, value: string) => {
    setVocabMap(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* ── Engagement details ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} disabled={!isEngagementAdmin} />
          </div>
          <div>
            <Label>Client name</Label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} disabled={!isEngagementAdmin} placeholder="Organisation name" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} disabled={!isEngagementAdmin} />
          </div>
          {isEngagementAdmin && (
            <Button size="sm" onClick={handleSaveEngagement} disabled={saving}>
              <Save className="w-3 h-3 mr-1" /> Save details
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Taxonomy rules ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Taxonomy rules</CardTitle>
          <CardDescription>
            Controls how strictly the commitment taxonomy is enforced.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Justification strictness</Label>
            <Select value={strictness} onValueChange={v => setStrictness(v as TaxonomyStrictness)} disabled={!isEngagementAdmin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="soft">Soft — any admin can add, justification logged</SelectItem>
                <SelectItem value="medium">Medium — Nera reviews for fit and duplication</SelectItem>
                <SelectItem value="hard">Hard — new items require board ratification</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{v.commitment_top_singular} warning at</Label>
              <Input type="number" min={1} max={20} value={topCountWarning} onChange={e => setTopCountWarning(+e.target.value)} disabled={!isEngagementAdmin} />
            </div>
            <div>
              <Label>Hard cap at</Label>
              <Input type="number" min={1} max={20} value={topCountHardCap} onChange={e => setTopCountHardCap(+e.target.value)} disabled={!isEngagementAdmin} />
            </div>
            <div>
              <Label>Pulse cadence (days)</Label>
              <Input type="number" min={7} max={365} value={pulseCadenceDays} onChange={e => setPulseCadenceDays(+e.target.value)} disabled={!isEngagementAdmin} />
            </div>
          </div>

          {isEngagementAdmin && (
            <Button size="sm" onClick={handleSaveEngagement} disabled={saving}>
              <Save className="w-3 h-3 mr-1" /> Save rules
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Vocabulary ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Vocabulary</CardTitle>
          <CardDescription>
            Change the headings and labels your organisation sees throughout the tool.
            These defaults come from the strategic-planning profile — edit them to
            match your own language.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Top-level (singular)</Label>
              <Input value={vocabMap.commitment_top_singular} onChange={e => updateVocab('commitment_top_singular', e.target.value)} disabled={!isEngagementAdmin} />
            </div>
            <div>
              <Label>Top-level (plural)</Label>
              <Input value={vocabMap.commitment_top_plural} onChange={e => updateVocab('commitment_top_plural', e.target.value)} disabled={!isEngagementAdmin} />
            </div>
            <div>
              <Label>Sub-level (singular)</Label>
              <Input value={vocabMap.commitment_sub_singular} onChange={e => updateVocab('commitment_sub_singular', e.target.value)} disabled={!isEngagementAdmin} />
            </div>
            <div>
              <Label>Sub-level (plural)</Label>
              <Input value={vocabMap.commitment_sub_plural} onChange={e => updateVocab('commitment_sub_plural', e.target.value)} disabled={!isEngagementAdmin} />
            </div>
            <div>
              <Label>Cross-cutting (singular)</Label>
              <Input value={vocabMap.cross_cut_singular} onChange={e => updateVocab('cross_cut_singular', e.target.value)} disabled={!isEngagementAdmin} />
            </div>
            <div>
              <Label>Cross-cutting (plural)</Label>
              <Input value={vocabMap.cross_cut_plural} onChange={e => updateVocab('cross_cut_plural', e.target.value)} disabled={!isEngagementAdmin} />
            </div>
          </div>

          {isEngagementAdmin && (
            <Button size="sm" onClick={handleSaveVocabulary} disabled={saving}>
              <Save className="w-3 h-3 mr-1" /> Save vocabulary
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
