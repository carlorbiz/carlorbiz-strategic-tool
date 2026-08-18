// CC-231 — "Tools in play": which Intelligence Engine tools this engagement runs on.
// Admin-only editor rendered inside Engagement Settings. Stores tool_slugs only.

import { useEffect, useMemo, useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { updateEngagementSettings } from '@/lib/commitmentApi';
import { fetchCatalogueVendors, freshnessLabel, type CatalogueVendor } from '@/lib/toolCatalogueApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Save, Check, Plus, X } from 'lucide-react';

export function ToolsInPlaySelector() {
  const { engagement, isEngagementAdmin, refresh } = useEngagement();
  const [vendors, setVendors] = useState<CatalogueVendor[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(engagement?.tools_in_play ?? []);
  }, [engagement?.id, engagement?.tools_in_play]);

  useEffect(() => {
    let alive = true;
    fetchCatalogueVendors()
      .then(v => { if (alive) { setVendors(v); setLoadError(null); } })
      .catch(e => { if (alive) { setVendors([]); setLoadError(e instanceof Error ? e.message : String(e)); } });
    return () => { alive = false; };
  }, []);

  const bySlug = useMemo(() => new Map((vendors ?? []).map(v => [v.tool_slug, v])), [vendors]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<string, CatalogueVendor[]>();
    for (const v of vendors ?? []) {
      if (q && !(`${v.tool_name} ${v.vendor ?? ''} ${v.category ?? ''}`.toLowerCase().includes(q))) continue;
      const key = v.category || 'Other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)) as [string, CatalogueVendor[]][];
  }, [vendors, query]);

  if (!engagement) return null;

  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...(engagement.tools_in_play ?? [])].sort());

  const toggle = (slug: string) =>
    setSelected(cur => (cur.includes(slug) ? cur.filter(s => s !== slug) : [...cur, slug]));

  const save = async () => {
    setSaving(true);
    try {
      await updateEngagementSettings(engagement.id, { tools_in_play: selected });
      await refresh();
      toast.success('Tools in play saved');
    } catch {
      toast.error('Failed to save tools in play');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tools in play</CardTitle>
        <CardDescription>
          The systems this organisation runs on. The Intelligence Engine is read live for
          each tool you select — nothing is copied into this engagement, and the engine
          only ever sees tool names.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected */}
        <div className="flex flex-wrap gap-2 min-h-8">
          {selected.length === 0 && (
            <span className="text-sm text-muted-foreground">No tools selected yet.</span>
          )}
          {selected.map(slug => {
            const v = bySlug.get(slug);
            return (
              <Badge key={slug} variant="secondary" className="gap-1 pr-1">
                {v?.tool_name ?? slug}
                {isEngagementAdmin && (
                  <button type="button" onClick={() => toggle(slug)} className="ml-1 rounded hover:bg-muted p-0.5" aria-label={`Remove ${v?.tool_name ?? slug}`}>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>

        {isEngagementAdmin && (
          <>
            <Input
              placeholder="Search the catalogue (e.g. Xero, Salesforce, Snowflake)"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {vendors === null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading the catalogue…</div>
            )}
            {loadError && (
              <p className="text-sm text-destructive">Couldn't reach the Intelligence Engine: {loadError}</p>
            )}
            {vendors && vendors.length > 0 && (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {grouped.map(([category, list]) => (
                  <div key={category}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{category}</div>
                    <div className="flex flex-wrap gap-2">
                      {list.map((v: CatalogueVendor) => {
                        const on = selected.includes(v.tool_slug);
                        return (
                          <button
                            key={v.tool_slug}
                            type="button"
                            onClick={() => toggle(v.tool_slug)}
                            title={`${v.chunk_count} knowledge chunks · ${freshnessLabel(v.last_harvest)}`}
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                          >
                            {on ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            {v.tool_name}
                            <span className={`text-[10px] ${on ? 'opacity-80' : 'text-muted-foreground'}`}>{v.chunk_count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />} Save tools in play
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
