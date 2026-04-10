import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Check, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import {
  getInsightsState,
  getLatestInsight,
  getSuggestions,
  generateInsights,
  updateSuggestionStatus,
  createChunksFromSuggestion,
  InsightsState,
  ContentInsight,
  ContentSuggestion,
} from '@/lib/insightsApi';

interface InsightsTabProps {
  campaignId: string;
  campaignTitle: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

function priorityColor(score: number): string {
  if (score >= 8) return PRIORITY_COLORS.high;
  if (score >= 5) return PRIORITY_COLORS.medium;
  return PRIORITY_COLORS.low;
}

const TYPE_LABELS: Record<string, string> = {
  new_resource: 'New Resource',
  new_faq: 'New FAQ',
  content_correction: 'Correction',
  content_expansion: 'Expansion',
  content_gap: 'Gap',
};

export function InsightsTab({ campaignId, campaignTitle }: InsightsTabProps) {
  const [state, setState] = useState<InsightsState | null>(null);
  const [insight, setInsight] = useState<ContentInsight | null>(null);
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissId, setDismissId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['themes']));

  const loadData = useCallback(async () => {
    setLoading(true);
    const [stateData, insightData] = await Promise.all([
      getInsightsState(campaignId),
      getLatestInsight(campaignId),
    ]);
    setState(stateData);
    setInsight(insightData);

    if (insightData) {
      const suggestionsData = await getSuggestions(insightData.id);
      setSuggestions(suggestionsData);
    }
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    const result = await generateInsights(campaignId);
    setGenerating(false);
    if (result?.error) {
      setGenerateError(result.error);
    } else if (result) {
      await loadData();
    } else {
      setGenerateError('No response from insights generator');
    }
  };

  const handleStatusUpdate = async (id: string, status: 'accepted' | 'dismissed' | 'deferred' | 'completed') => {
    const reason = status === 'dismissed' ? dismissReason : undefined;
    await updateSuggestionStatus(id, status, reason);
    setDismissId(null);
    setDismissReason('');
    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, status, ...(reason ? { dismiss_reason: reason } : {}) } : s)
    );

    // When accepting a suggestion with draft content, create knowledge chunks for Nera
    if (status === 'accepted') {
      const suggestion = suggestions.find(s => s.id === id);
      if (suggestion?.draft_content) {
        const result = await createChunksFromSuggestion(suggestion);
        if (result.created > 0) {
          toast.success('Knowledge chunk created — Nera will use this content');
        } else if (result.error) {
          toast.error(`Chunk creation failed: ${result.error}`);
        }
      }
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;
  const gapCount = insight?.gap_analysis?.length || 0;
  const flagCount = insight?.accuracy_flags?.length || 0;
  const neraCorrelationCount = insight?.nera_gap_correlation?.length || 0;

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold">{campaignTitle} — Insights</h3>
              {insight ? (
                <p className="text-sm text-muted-foreground">
                  Last generated: {new Date(insight.generated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {' '}({insight.sessions_analysed} sessions, {insight.nera_queries_analysed} Nera queries)
                  {state?.is_stale && (
                    <span className="ml-2 text-amber-600 font-medium">
                      — {state.sessions_since_last_insight} new session{state.sessions_since_last_insight !== 1 ? 's' : ''} since
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No insights generated yet</p>
              )}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              variant={state?.is_stale || !insight ? 'default' : 'outline'}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {generating ? 'Analysing...' : insight ? 'Refresh Insights' : 'Generate Insights'}
            </Button>
          </div>
          {generating && (
            <p className="text-xs text-muted-foreground mt-3">
              Claude is analysing all feedback sessions and Nera query patterns. This may take 15-30 seconds...
            </p>
          )}
          {generateError && (
            <p className="text-sm text-red-600 mt-3">
              Generation failed: {generateError}
            </p>
          )}
        </CardContent>
      </Card>

      {!insight && !generating && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Click "Generate Insights" to analyse your feedback sessions and Nera query logs.
          </CardContent>
        </Card>
      )}

      {insight && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{gapCount}</div>
              <div className="text-xs text-muted-foreground">Gaps Identified</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${flagCount > 0 ? 'text-red-600' : ''}`}>{flagCount}</div>
              <div className="text-xs text-muted-foreground">Accuracy Flags</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-600' : ''}`}>{pendingCount}</div>
              <div className="text-xs text-muted-foreground">Pending Suggestions</div>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{neraCorrelationCount}</div>
              <div className="text-xs text-muted-foreground">Nera Failures Correlated</div>
            </div>
          </div>

          {/* Themes Summary */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleSection('themes')}
            >
              <div className="flex items-center gap-2">
                {expandedSections.has('themes') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">Themes Summary</CardTitle>
              </div>
            </CardHeader>
            {expandedSections.has('themes') && (
              <CardContent>
                <div className="prose prose-sm prose-stone max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {insight.themes_summary}
                  </ReactMarkdown>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Strength Areas */}
          {insight.strength_areas.length > 0 && (
            <Card>
              <CardHeader
                className="cursor-pointer"
                onClick={() => toggleSection('strengths')}
              >
                <div className="flex items-center gap-2">
                  {expandedSections.has('strengths') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base">What's Working Well</CardTitle>
                </div>
              </CardHeader>
              {expandedSections.has('strengths') && (
                <CardContent>
                  <div className="space-y-3">
                    {insight.strength_areas.map((s, i) => (
                      <div key={i} className="border-l-2 border-green-400 pl-3">
                        <p className="font-medium text-sm">{s.area}</p>
                        <p className="text-xs text-muted-foreground">{s.evidence} ({s.session_count} session{s.session_count !== 1 ? 's' : ''})</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Gap Analysis */}
          {insight.gap_analysis.length > 0 && (
            <Card>
              <CardHeader
                className="cursor-pointer"
                onClick={() => toggleSection('gaps')}
              >
                <div className="flex items-center gap-2">
                  {expandedSections.has('gaps') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base">Gap Analysis</CardTitle>
                </div>
              </CardHeader>
              {expandedSections.has('gaps') && (
                <CardContent>
                  <div className="space-y-3">
                    {insight.gap_analysis.map((g, i) => (
                      <div key={i} className="border-l-2 border-amber-400 pl-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{g.topic}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[g.urgency] || PRIORITY_COLORS.medium}`}>
                            {g.urgency}
                          </span>
                          {g.corroborated_by_nera && (
                            <span className="text-xs text-blue-600 font-medium">Nera-corroborated</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Mentioned in {g.frequency} session{g.frequency !== 1 ? 's' : ''}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Accuracy Flags */}
          {insight.accuracy_flags.length > 0 && (
            <Card>
              <CardHeader
                className="cursor-pointer"
                onClick={() => toggleSection('accuracy')}
              >
                <div className="flex items-center gap-2">
                  {expandedSections.has('accuracy') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-base text-red-700">Accuracy Flags</CardTitle>
                </div>
              </CardHeader>
              {expandedSections.has('accuracy') && (
                <CardContent>
                  <div className="space-y-3">
                    {insight.accuracy_flags.map((f, i) => (
                      <div key={i} className="border-l-2 border-red-400 pl-3">
                        <p className="font-medium text-sm">{f.content_area}</p>
                        <p className="text-sm text-muted-foreground">{f.concern}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Content Suggestions Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content Suggestions</CardTitle>
              <CardDescription>
                {pendingCount} pending · {suggestions.filter(s => s.status === 'accepted').length} accepted · {suggestions.filter(s => s.status === 'completed').length} completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No suggestions generated yet.</p>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <div key={suggestion.id} className="border rounded-lg overflow-hidden">
                      {/* Row header */}
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedId(expandedId === suggestion.id ? null : suggestion.id)}
                      >
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold tabular-nums ${priorityColor(suggestion.priority_score)}`}>
                          {suggestion.priority_score}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {TYPE_LABELS[suggestion.suggestion_type] || suggestion.suggestion_type}
                        </span>
                        <span className="text-sm font-medium flex-1 truncate">{suggestion.title}</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          suggestion.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          suggestion.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          suggestion.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                          suggestion.status === 'dismissed' ? 'bg-gray-100 text-gray-500' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {suggestion.status}
                        </span>
                        {expandedId === suggestion.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </button>

                      {/* Expanded details */}
                      {expandedId === suggestion.id && (
                        <div className="border-t px-4 py-3 bg-muted/20 space-y-3">
                          <p className="text-sm">{suggestion.description}</p>

                          {/* Evidence */}
                          {suggestion.evidence && (
                            <div className="space-y-1">
                              {suggestion.evidence.quotes && suggestion.evidence.quotes.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Quotes from feedback:</p>
                                  {suggestion.evidence.quotes.map((q, i) => (
                                    <p key={i} className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1">"{q}"</p>
                                  ))}
                                </div>
                              )}
                              {suggestion.evidence.nera_queries && suggestion.evidence.nera_queries.length > 0 && (
                                <p className="text-xs text-blue-600">
                                  Nera query evidence: {suggestion.evidence.nera_queries.join('; ')}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Draft content */}
                          {suggestion.draft_content && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Suggested outline:</p>
                              <div className="prose prose-xs prose-stone max-w-none bg-background rounded p-3 border">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {suggestion.draft_content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}

                          {/* Related tabs */}
                          {suggestion.related_tabs.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Related: {suggestion.related_tabs.map(t => <code key={t} className="bg-muted px-1 py-0.5 rounded mx-0.5">{t}</code>)}
                            </p>
                          )}

                          {/* Dismiss reason */}
                          {suggestion.status === 'dismissed' && suggestion.dismiss_reason && (
                            <p className="text-xs text-muted-foreground italic">Dismissed: {suggestion.dismiss_reason}</p>
                          )}

                          {/* Actions */}
                          {suggestion.status === 'pending' && (
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs"
                                onClick={() => handleStatusUpdate(suggestion.id, 'accepted')}
                              >
                                <Check className="h-3 w-3 mr-1" /> Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleStatusUpdate(suggestion.id, 'deferred')}
                              >
                                <Clock className="h-3 w-3 mr-1" /> Defer
                              </Button>
                              {dismissId === suggestion.id ? (
                                <div className="flex items-center gap-1 flex-1">
                                  <Input
                                    value={dismissReason}
                                    onChange={(e) => setDismissReason(e.target.value)}
                                    placeholder="Reason (optional)"
                                    className="h-7 text-xs flex-1"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => handleStatusUpdate(suggestion.id, 'dismissed')}
                                  >
                                    Confirm
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-muted-foreground"
                                  onClick={() => setDismissId(suggestion.id)}
                                >
                                  <X className="h-3 w-3 mr-1" /> Dismiss
                                </Button>
                              )}
                            </div>
                          )}
                          {suggestion.status === 'accepted' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleStatusUpdate(suggestion.id, 'completed')}
                            >
                              <Check className="h-3 w-3 mr-1" /> Mark Completed
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
