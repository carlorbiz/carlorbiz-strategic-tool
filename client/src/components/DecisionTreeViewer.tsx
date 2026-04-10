import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, RotateCcw, ChevronRight, CheckCircle2, HelpCircle, ExternalLink, ImageIcon } from "lucide-react";
import type { DecisionTree, DecisionTreeNode, DecisionTreeResultNode } from "@/types/cms";

const STORAGE_BASE = "https://ksfdabyledggbeweeqta.supabase.co/storage/v1/object/public/content-images";

/** Render a screenshot with lightbox-style click-to-expand */
function NodeImage({ url, alt }: { url: string; alt?: string }) {
  const [expanded, setExpanded] = useState(false);
  // Resolve relative paths against storage base
  const src = url.startsWith("http") ? url : `${STORAGE_BASE}/${url.replace(/^\//, "")}`;

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl overflow-hidden border-2 border-border/50 hover:border-[var(--color-brand-accent)]/40 transition-all hover:shadow-lg cursor-zoom-in group"
      >
        <img
          src={src}
          alt={alt || "Screenshot"}
          className="w-full h-auto object-contain bg-white"
          loading="lazy"
        />
        <div className="bg-muted/80 px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5 group-hover:text-foreground transition-colors">
          <ImageIcon className="h-3 w-3" />
          {alt || "Click to enlarge"}
        </div>
      </button>
      {expanded && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setExpanded(false)}
        >
          <img
            src={src}
            alt={alt || "Screenshot"}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
}

interface DecisionTreeViewerProps {
  tree: DecisionTree;
  onBack: () => void;
  onNavigateToTab?: (tabSlug: string) => void;
  isAuthenticated?: boolean;
}

interface BreadcrumbEntry {
  nodeId: string;
  question: string;
  answer: string;
}

function isResultNode(node: DecisionTreeNode): node is DecisionTreeResultNode {
  return 'type' in node && node.type === 'result';
}

/**
 * Resolve the effective starting node based on auth state.
 * - Authenticated users: if root has a "tpa" option, skip the role question and start there.
 * - Unauthenticated users: filter out any "tpa" options from the root (they choose PM or Supervisor).
 */
function resolveEntryNode(root: DecisionTreeNode, isAuthenticated: boolean): DecisionTreeNode {
  if (isResultNode(root)) return root;

  // Look for a TPA-targeted option (node ID contains "tpa")
  const tpaOption = root.options.find(o => !isResultNode(o.next) && o.next.id.startsWith("tpa"));

  if (isAuthenticated && tpaOption) {
    // Authenticated (TPA): skip role question, go straight to TPA branch
    return tpaOption.next;
  }

  if (!isAuthenticated && tpaOption) {
    // Public: filter out TPA option, show only PM/Supervisor
    const filtered = root.options.filter(o => o !== tpaOption);
    if (filtered.length === root.options.length) return root; // nothing to filter
    return { ...root, options: filtered };
  }

  return root;
}

export function DecisionTreeViewer({ tree, onBack, onNavigateToTab, isAuthenticated = false }: DecisionTreeViewerProps) {
  const entryNode = useMemo(() => resolveEntryNode(tree.tree_data, isAuthenticated), [tree.tree_data, isAuthenticated]);
  const [currentNode, setCurrentNode] = useState<DecisionTreeNode>(entryNode);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleOptionSelect = useCallback((optionLabel: string, nextNode: DecisionTreeNode) => {
    if (isResultNode(currentNode)) return;

    setIsTransitioning(true);
    setBreadcrumbs(prev => [
      ...prev,
      { nodeId: currentNode.id, question: currentNode.question, answer: optionLabel }
    ]);

    // Brief transition for visual feedback
    setTimeout(() => {
      setCurrentNode(nextNode);
      setIsTransitioning(false);
    }, 150);
  }, [currentNode]);

  const handleGoBack = useCallback(() => {
    if (breadcrumbs.length === 0) {
      onBack();
      return;
    }

    // Walk the tree to find the parent node
    const targetBreadcrumbs = breadcrumbs.slice(0, -1);

    let node = entryNode;
    for (const crumb of targetBreadcrumbs) {
      if (!isResultNode(node)) {
        const option = node.options.find(o => o.label === crumb.answer);
        if (option) node = option.next;
      }
    }

    setIsTransitioning(true);
    setBreadcrumbs(targetBreadcrumbs);
    setTimeout(() => {
      setCurrentNode(node);
      setIsTransitioning(false);
    }, 150);
  }, [breadcrumbs, entryNode, onBack]);

  const handleRestart = useCallback(() => {
    setIsTransitioning(true);
    setBreadcrumbs([]);
    setTimeout(() => {
      setCurrentNode(entryNode);
      setIsTransitioning(false);
    }, 150);
  }, [entryNode]);

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-4rem)] px-4 py-8 md:py-12">
      {/* Header */}
      <div className="max-w-3xl w-full mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to guides
        </button>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{tree.icon}</span>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            {tree.title}
          </h1>
        </div>
        {tree.description && (
          <div className="text-muted-foreground prose prose-sm prose-stone dark:prose-invert max-w-none [&_p]:m-0 [&_p+p]:mt-2 [&_a]:text-[var(--color-brand-accent)] [&_a]:underline">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }) => {
                  if (href?.startsWith("#tab:") && onNavigateToTab) {
                    const slug = href.slice(5);
                    return (
                      <a
                        href={href}
                        onClick={(e) => { e.preventDefault(); onNavigateToTab(slug); }}
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  }
                  return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                },
              }}
            >
              {tree.description}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Breadcrumb trail */}
      {breadcrumbs.length > 0 && (
        <div className="max-w-3xl w-full mb-6">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <button
              onClick={handleRestart}
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Start
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 flex-shrink-0" />
                <span className="font-medium text-foreground">{crumb.answer}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current node */}
      <div
        className={`max-w-3xl w-full transition-all duration-150 ${
          isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        }`}
      >
        {isResultNode(currentNode) ? (
          /* ── Result Node ── */
          <Card className="border-2 border-green-500/30 bg-green-50/50 dark:bg-green-950/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-heading text-xl font-bold text-foreground mb-1">
                    {currentNode.title}
                  </h2>
                  {currentNode.source_tab_slug && (
                    <Badge variant="outline" className="text-xs">
                      Sourced from content
                    </Badge>
                  )}
                </div>
              </div>

              {currentNode.image_url && (
                <div className="my-4">
                  <NodeImage url={currentNode.image_url} alt={currentNode.image_alt} />
                </div>
              )}

              {currentNode.content_markdown && (
                <>
                  <Separator className="my-4" />
                  <div className="prose prose-stone dark:prose-invert max-w-none prose-sm prose-headings:font-heading prose-a:text-primary">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {currentNode.content_markdown}
                    </ReactMarkdown>
                  </div>
                </>
              )}

              {currentNode.source_tab_slug && onNavigateToTab && (
                <div className="mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onNavigateToTab(currentNode.source_tab_slug!)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Read the full guide
                  </Button>
                </div>
              )}

              <Separator className="my-6" />
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleGoBack} className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Go back
                </Button>
                <Button variant="outline" size="sm" onClick={handleRestart} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Start over
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* ── Question Node ── */
          <>
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-6 w-6 text-[var(--color-brand-accent)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-heading text-xl font-bold text-foreground">
                      {currentNode.question}
                    </h2>
                    {currentNode.help_text && (
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        {currentNode.help_text}
                      </p>
                    )}
                  </div>
                </div>

                {currentNode.image_url && (
                  <div className="mt-4">
                    <NodeImage url={currentNode.image_url} alt={currentNode.image_alt} />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              {currentNode.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(option.label, option.next)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card shadow-sm text-left transition-all hover:border-[var(--color-brand-accent)]/40 hover:shadow-md hover:translate-x-1 group"
                >
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-[var(--color-brand-accent)]/10 flex items-center justify-center group-hover:bg-[var(--color-brand-accent)]/20 transition-colors">
                    <span className="text-sm font-bold text-[var(--color-brand-accent)]">
                      {String.fromCharCode(65 + idx)}
                    </span>
                  </div>
                  <span className="flex-1 font-medium text-foreground text-sm">
                    {option.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[var(--color-brand-accent)] transition-colors" />
                </button>
              ))}
            </div>

            {breadcrumbs.length > 0 && (
              <div className="mt-6">
                <Button variant="ghost" size="sm" onClick={handleGoBack} className="gap-1.5 text-muted-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Go back
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
