// PillarsPanel — surfaces the organisation's (or department's) strategic
// pillars at the top of the engagement dashboard. These are the *intent* the
// corpus is being harvested in service of, distinct from the themes/streams
// that organise the corpus itself.
//
// Empty state is meaningful: an engagement without pillars is a library, not
// a rhythm — a corpus with nothing to be challenged against. The panel says
// so plainly rather than hiding silently.

import { useEngagement } from '@/contexts/EngagementContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Compass } from 'lucide-react';

const LEVEL_LABEL: Record<string, string> = {
  organisational: 'Organisational strategy',
  departmental: 'Departmental strategy',
  programmatic: 'Programme strategy',
};

export function PillarsPanel() {
  const { pillars, engagement, aiConfig } = useEngagement();
  if (!engagement) return null;

  // Sovereignty commitment display + empty-state nudge only show on the
  // sovereignty-watch consulting profile to avoid noise on research /
  // strategic-plan engagements where sovereignty isn't the active lens.
  const isSovereigntyProfile = aiConfig?.profile_key === 'sovereignty-watch';

  // Group by level — most engagements will use a single level, but the panel
  // surfaces the distinction when both are present (an org running both Path A
  // and Path B will have organisational + departmental pillars side by side).
  const level = pillars[0]?.pillar_level ?? 'departmental';
  const levelLabel = LEVEL_LABEL[level] ?? 'Strategic pillars';

  return (
    <div data-tour="pillars-panel">
      <div className="flex items-center gap-2 mb-3">
        <Compass className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Strategic pillars</h2>
        {pillars.length > 0 && (
          <Badge variant="outline" className="text-xs">{levelLabel}</Badge>
        )}
      </div>

      {pillars.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            <p>
              No strategic pillars defined yet. Pillars are the organisational or
              departmental priorities the corpus is harvested in service of — without
              them, this engagement is a library, not a rhythm. Add pillars from
              the Settings tab.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pillars.map((p) => (
            <Card key={p.id} className="border-l-4 border-l-primary/60">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 mt-1 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight">{p.title}</h3>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                        {p.description}
                      </p>
                    )}
                    {p.distinctiveness_claim ? (
                      <p className="text-xs mt-2 line-clamp-3 border-l-2 border-primary/40 pl-2">
                        <span className="font-medium">Point of difference: </span>
                        <span className="text-muted-foreground">{p.distinctiveness_claim}</span>
                      </p>
                    ) : (
                      <p className="text-xs mt-2 text-amber-700/80 dark:text-amber-400/80 italic">
                        No point-of-difference articulated yet — a pillar a peer could equally claim is not yet distinct.
                      </p>
                    )}
                    {p.sovereignty_claim ? (
                      <p className="text-xs mt-2 line-clamp-3 border-l-2 border-amber-500/50 pl-2">
                        <span className="font-medium">Sovereignty commitment: </span>
                        <span className="text-muted-foreground">{p.sovereignty_claim}</span>
                      </p>
                    ) : isSovereigntyProfile ? (
                      <p className="text-xs mt-2 text-amber-700/80 dark:text-amber-400/80 italic">
                        No sovereignty commitment articulated yet — a pillar without a stated control posture is not yet defensible.
                      </p>
                    ) : null}
                    {p.success_signal && (
                      <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">
                        <span className="font-medium not-italic">Success signal: </span>
                        {p.success_signal}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
