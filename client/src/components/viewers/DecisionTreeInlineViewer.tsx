import { useState, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, RotateCcw, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCMS } from '@/contexts/CMSContext';
import { EnquiryIntake } from '@/components/viewers/EnquiryIntake';
import type {
  DecisionTreeNode,
  DecisionTreeResultNode,
} from '@/types/cms';

const ENQUIRY_MARKER = '::enquiry::';

interface DecisionTreeInlineViewerProps {
  slug: string;
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
 * Extracts the ::enquiry:: marker from result markdown.
 * Returns { markdown: string, hasEnquiry: boolean }.
 */
function parseResultContent(markdown: string | undefined): { markdown: string; hasEnquiry: boolean } {
  if (!markdown) return { markdown: '', hasEnquiry: false };
  const hasEnquiry = markdown.includes(ENQUIRY_MARKER);
  const cleaned = markdown.replace(ENQUIRY_MARKER, '').trim();
  // Strip trailing --- if it's left hanging after marker removal
  const finalMd = cleaned.replace(/\n?---\s*$/m, '').trim();
  return { markdown: finalMd, hasEnquiry };
}

/**
 * Lightweight decision tree renderer built specifically for embedding inside
 * an accordion. Purpose-built (not reusing DecisionTreeViewer) so we can
 * intercept result nodes and splice in the EnquiryIntake component when the
 * result markdown contains the ::enquiry:: marker.
 */
export function DecisionTreeInlineViewer({ slug }: DecisionTreeInlineViewerProps) {
  const { decisionTrees } = useCMS();

  const tree = useMemo(
    () => decisionTrees.find((t) => t.slug === slug && t.is_visible),
    [decisionTrees, slug]
  );

  const [currentNode, setCurrentNode] = useState<DecisionTreeNode | null>(tree?.tree_data ?? null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);

  const handleOptionSelect = useCallback(
    (optionLabel: string, nextNode: DecisionTreeNode) => {
      if (!currentNode || isResultNode(currentNode)) return;
      setBreadcrumbs((prev) => [
        ...prev,
        { nodeId: currentNode.id, question: currentNode.question, answer: optionLabel },
      ]);
      setCurrentNode(nextNode);
    },
    [currentNode]
  );

  const handleGoBack = useCallback(() => {
    if (!tree || breadcrumbs.length === 0) return;
    const targetBreadcrumbs = breadcrumbs.slice(0, -1);
    let node: DecisionTreeNode = tree.tree_data;
    for (const crumb of targetBreadcrumbs) {
      if (!isResultNode(node)) {
        const option = node.options.find((o) => o.label === crumb.answer);
        if (option) node = option.next;
      }
    }
    setBreadcrumbs(targetBreadcrumbs);
    setCurrentNode(node);
  }, [breadcrumbs, tree]);

  const handleRestart = useCallback(() => {
    if (!tree) return;
    setBreadcrumbs([]);
    setCurrentNode(tree.tree_data);
  }, [tree]);

  if (!tree || !currentNode) {
    return (
      <div className="bg-muted/50 border border-border rounded-lg p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-heading font-semibold text-sm text-foreground mb-1">
            Decision tree not available
          </p>
          <p className="text-sm text-muted-foreground">
            The decision tree &ldquo;{slug}&rdquo; hasn&rsquo;t been published yet. Come back soon.
          </p>
        </div>
      </div>
    );
  }

  // RESULT NODE
  if (isResultNode(currentNode)) {
    const { markdown, hasEnquiry } = parseResultContent(currentNode.content_markdown);

    return (
      <div className="space-y-6">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="italic">&ldquo;{crumb.answer}&rdquo;</span>
                {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
              </span>
            ))}
          </div>
        )}

        {/* Result card */}
        <div
          className="rounded-lg border bg-card p-6 md:p-8"
          style={{ borderTop: '4px solid var(--color-brand-accent)' }}
        >
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle2
              className="h-6 w-6 flex-shrink-0 mt-1"
              style={{ color: 'var(--color-brand-primary)' }}
            />
            <h3 className="font-heading font-bold text-2xl md:text-3xl cb-heading-gradient leading-tight">
              {currentNode.title}
            </h3>
          </div>

          {markdown && (
            <div className="prose prose-sm md:prose-base max-w-none [&_a]:text-[var(--color-brand-accent)] [&_a]:underline hover:[&_a]:no-underline">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Enquiry intake inline (if marker present) */}
        {hasEnquiry && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-muted-foreground italic">
                Want to talk this through with us?
              </p>
            </div>
            <EnquiryIntake
              source={`services-decision-tree:${currentNode.id}`}
              opener={`Hi — I'm Nera. You landed on "${currentNode.title}". I'll ask a few quick questions so Carla has real context when she follows up. To start: what's the situation you're trying to solve?`}
            />
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          {breadcrumbs.length > 0 && (
            <button
              onClick={handleGoBack}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-[var(--color-brand-primary)] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back one step
            </button>
          )}
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-[var(--color-brand-primary)] transition-colors ml-auto"
          >
            <RotateCcw className="h-4 w-4" />
            Start over
          </button>
        </div>
      </div>
    );
  }

  // QUESTION NODE
  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="italic">&ldquo;{crumb.answer}&rdquo;</span>
              {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </div>
      )}

      {/* Question */}
      <div>
        <h3 className="font-heading font-bold text-xl md:text-2xl text-foreground mb-2 leading-tight">
          {currentNode.question}
        </h3>
        {currentNode.help_text && (
          <p className="text-sm text-muted-foreground">{currentNode.help_text}</p>
        )}
      </div>

      {/* Options */}
      <div className="space-y-3">
        {currentNode.options.map((option, i) => (
          <button
            key={i}
            onClick={() => handleOptionSelect(option.label, option.next)}
            className="w-full text-left rounded-lg border-2 border-border bg-card px-5 py-4 hover:border-[var(--color-brand-accent)] hover:shadow-md transition-all flex items-center justify-between gap-4 group"
          >
            <span className="font-body text-sm md:text-base text-foreground group-hover:text-[var(--color-brand-primary)] transition-colors leading-snug">
              {option.label}
            </span>
            <ChevronRight
              className="h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-[var(--color-brand-accent)] transition-colors"
            />
          </button>
        ))}
      </div>

      {/* Navigation */}
      {breadcrumbs.length > 0 && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleGoBack}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-[var(--color-brand-primary)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back one step
          </button>
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-[var(--color-brand-primary)] transition-colors ml-auto"
          >
            <RotateCcw className="h-4 w-4" />
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
