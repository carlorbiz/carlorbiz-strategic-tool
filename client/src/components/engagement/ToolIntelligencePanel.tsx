// CC-231 — "Tool Intelligence": what the Intelligence Engine knows, right now,
// about the tools this engagement runs on. Read live per render; nothing cached
// into the engagement. Visible to every engagement member; editing the tool set
// is admin-only (Settings → Tools in play).

import { useEffect, useMemo, useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import {
  fetchCatalogueVendors,
  fetchCatalogueVendorDetail,
  freshnessLabel,
  type CatalogueVendor,
  type CatalogueVendorDetail,
} from '@/lib/toolCatalogueApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';

type DetailState = { loading: boolean; error?: string; data?: CatalogueVendorDetail };

export function ToolIntelligencePanel() {
  const { engagement, isEngagementAdmin } = useEngagement();
  const tools = useMemo(() => engagement?.tools_in_play ?? [], [engagement?.tools_in_play]);

  const [vendors, setVendors] = useState<Map<string, CatalogueVendor> | null>(null);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setVendors(null); setVendorError(null);
    fetchCatalogueVendors()
      .then(v => { if (alive) setVendors(new Map(v.map(x => [x.tool_slug, x]))); })
      .catch(e => { if (alive) { setVendors(new Map()); setVendorError(e instanceof Error ? e.message : String(e)); } });
    return () => { alive = false; };
  }, [refreshTick]);

  const loadDetail = async (slug: string) => {
    setDetails(d => ({ ...d, [slug]: { loading: true } }));
    try {
      const data = await fetchCatalogueVendorDetail(slug, 30);
      setDetails(d => ({ ...d, [slug]: { loading: false, data } }));
    } catch (e) {
      setDetails(d => ({ ...d, [slug]: { loading: false, error: e instanceof Error ? e.message : String(e) } }));
    }
  };

  const toggleOpen = (slug: string) => {
    const next = !open[slug];
    setOpen(o => ({ ...o, [slug]: next }));
    if (next && !details[slug]) void loadDetail(slug);
  };

  if (!engagement) return null;

  if (tools.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tool Intelligence</CardTitle>
          <CardDescription>
            {isEngagementAdmin
              ? 'No tools in play yet. Set them under Settings → Tools in play and this tab reads the Intelligence Engine live for each one.'
              : 'Your adviser has not set the tools in play for this engagement yet.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Tool Intelligence</h3>
          <p className="text-sm text-muted-foreground">
            What the Intelligence Engine holds on each system you run — how current it is,
            and where it is thin. Read live; nothing here is stored in this engagement.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setDetails({}); setRefreshTick(t => t + 1); }}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {vendors === null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Reading the Intelligence Engine…</div>
      )}
      {vendorError && (
        <div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="w-4 h-4" /> Couldn't reach the Intelligence Engine: {vendorError}</div>
      )}

      {vendors && tools.map(slug => {
        const v = vendors.get(slug);
        const d = details[slug];
        const isOpen = !!open[slug];
        return (
          <Card key={slug}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{v?.tool_name ?? slug}</CardTitle>
                  <CardDescription>
                    {v ? (
                      <>
                        {v.vendor ?? '—'}{v.category ? ` · ${v.category}` : ''} · {freshnessLabel(v.last_harvest)}
                      </>
                    ) : (
                      'Not in the engine catalogue yet — the engine has no captured knowledge for this tool.'
                    )}
                  </CardDescription>
                </div>
                {v && (
                  <div className="flex flex-wrap gap-1 justify-end">
                    <Badge variant="secondary">{v.chunk_count} chunks</Badge>
                    <Badge variant="outline">{v.pages_live}/{v.pages_tracked} pages live</Badge>
                    {v.pages_thin > 0 && <Badge variant="outline">{v.pages_thin} thin</Badge>}
                    {v.pages_error > 0 && <Badge variant="destructive">{v.pages_error} errors</Badge>}
                  </div>
                )}
              </div>
            </CardHeader>
            {v && (
              <CardContent className="pt-0">
                {(v.chunk_count === 0 || v.pages_thin > v.pages_live) && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Thin spot: the engine holds little or nothing usable on this tool yet. Recommendations should say so rather than guess.
                  </p>
                )}
                <Button variant="ghost" size="sm" onClick={() => toggleOpen(slug)}>
                  {isOpen ? 'Hide' : 'Show'} what the engine knows
                </Button>
                {isOpen && (
                  <div className="mt-2 space-y-2">
                    {d?.loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>}
                    {d?.error && <div className="text-sm text-destructive">{d.error}</div>}
                    {d?.data && d.data.chunks.length === 0 && <div className="text-sm text-muted-foreground">No chunks captured yet.</div>}
                    {d?.data && d.data.chunks.map(c => (
                      <div key={c.chunk_id} className="rounded-md border p-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span>{c.summary || c.doc_title || c.chunk_id}</span>
                          {c.source_url && (
                            <a href={c.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground shrink-0" title={c.source_url}>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {c.content_type ?? 'chunk'}{c.doc_title ? ` · ${c.doc_title}` : ''}
                        </div>
                      </div>
                    ))}
                    {d?.data && d.data.pages.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Pages tracked ({d.data.pages.length})</summary>
                        <ul className="mt-1 space-y-0.5">
                          {d.data.pages.map(p => (
                            <li key={p.page_url} className="flex items-center gap-2">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${p.status === 'error' ? 'bg-red-500' : p.status === 'thin' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                              <a href={p.page_url} target="_blank" rel="noreferrer" className="hover:underline truncate">{p.title || p.page_url}</a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
