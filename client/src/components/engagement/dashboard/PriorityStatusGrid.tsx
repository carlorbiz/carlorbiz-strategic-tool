import { useEffect, useState } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { fetchRecentUpdates } from '@/lib/engagementApi';
import type { Commitment, InitiativeUpdate, UpdateRagStatus } from '@/types/engagement';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';

const RAG_CONFIG: Record<UpdateRagStatus, { label: string; color: string; bg: string }> = {
  on_track: { label: 'On track', color: 'text-green-700', bg: 'bg-green-100' },
  at_risk: { label: 'At risk', color: 'text-amber-700', bg: 'bg-amber-100' },
  blocked: { label: 'Blocked', color: 'text-red-700', bg: 'bg-red-100' },
  done: { label: 'Done', color: 'text-blue-700', bg: 'bg-blue-100' },
};

export function PriorityStatusGrid() {
  const { engagement, commitments } = useEngagement();
  const v = useVocabulary();
  const [updates, setUpdates] = useState<InitiativeUpdate[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!engagement) return;
    fetchRecentUpdates(engagement.id, 100).then(setUpdates).catch(console.error);
  }, [engagement?.id]);

  if (!engagement) return null;

  const priorities = commitments
    .filter(c => c.kind === 'top' && c.status === 'active')
    .sort((a, b) => a.order_index - b.order_index);

  // Derive RAG status per commitment from most recent update
  const latestUpdateFor = (commitmentId: string): InitiativeUpdate | undefined => {
    return updates.find(u => u.commitment_id === commitmentId);
  };

  // Roll up: a priority's status = worst status among its initiatives
  const rollUpStatus = (priorityId: string): UpdateRagStatus | null => {
    const initiatives = commitments.filter(
      c => c.parent_id === priorityId && c.kind === 'sub' && c.status === 'active'
    );
    if (initiatives.length === 0) return null;

    const statuses = initiatives
      .map(i => latestUpdateFor(i.id)?.rag_status)
      .filter(Boolean) as UpdateRagStatus[];

    if (statuses.length === 0) return null;
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('at_risk')) return 'at_risk';
    if (statuses.every(s => s === 'done')) return 'done';
    return 'on_track';
  };

  return (
    <div data-tour="themes-grid">
      <h2 className="text-lg font-semibold mb-3">{v.commitment_top_plural}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {priorities.map(p => {
          const initiatives = commitments.filter(
            c => c.parent_id === p.id && c.kind === 'sub' && c.status === 'active'
          );
          const rolledUp = rollUpStatus(p.id);
          const directUpdate = latestUpdateFor(p.id);
          const ragStatus = rolledUp ?? directUpdate?.rag_status ?? null;
          const ragConf = ragStatus ? RAG_CONFIG[ragStatus] : null;
          const isExpanded = expandedId === p.id;

          return (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => setExpandedId(isExpanded ? null : p.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  {ragConf ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ragConf.bg} ${ragConf.color}`}>
                      {ragConf.label}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                      No updates
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {p.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{p.description}</p>
                )}

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {initiatives.length} {initiatives.length === 1
                    ? v.commitment_sub_singular.toLowerCase()
                    : v.commitment_sub_plural.toLowerCase()}
                </div>

                {isExpanded && initiatives.length > 0 && (
                  <div className="mt-3 space-y-2 border-t pt-2">
                    {initiatives.map(i => {
                      const iUpdate = latestUpdateFor(i.id);
                      const iRag = iUpdate ? RAG_CONFIG[iUpdate.rag_status] : null;
                      return (
                        <div key={i.id} className="flex items-center justify-between text-sm">
                          <span className="truncate">{i.title}</span>
                          {iRag ? (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${iRag.bg} ${iRag.color} shrink-0 ml-2`}>
                              {iRag.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">—</span>
                          )}
                        </div>
                      );
                    })}
                    {directUpdate?.narrative && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Latest: {directUpdate.narrative}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {priorities.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            No {v.commitment_top_plural.toLowerCase()} defined yet.
          </p>
        )}
      </div>
    </div>
  );
}
