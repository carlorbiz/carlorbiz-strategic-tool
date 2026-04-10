import { useState, useCallback } from "react";
import { useCMS } from "@/contexts/CMSContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus, Trash2, Save, ChevronRight, ChevronDown, HelpCircle, CheckCircle2,
  ArrowLeft, RefreshCw, AlertTriangle, Eye, Pencil, GripVertical
} from "lucide-react";
import type {
  DecisionTree, DecisionTreeNode, DecisionTreeQuestionNode, DecisionTreeResultNode
} from "@/types/cms";

function isResultNode(node: DecisionTreeNode): node is DecisionTreeResultNode {
  return 'type' in node && node.type === 'result';
}

// Generate a short unique ID for tree nodes
function nodeId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createEmptyQuestion(): DecisionTreeQuestionNode {
  return {
    id: nodeId(),
    question: "New question",
    options: [
      { label: "Option A", next: createEmptyResult() },
      { label: "Option B", next: createEmptyResult() },
    ],
  };
}

function createEmptyResult(): DecisionTreeResultNode {
  return {
    type: "result",
    id: nodeId(),
    title: "Result",
    content_markdown: "",
  };
}

// ─── Node Editor (recursive) ───────────────────────────────────────────

interface NodeEditorProps {
  node: DecisionTreeNode;
  onChange: (updated: DecisionTreeNode) => void;
  onDelete?: () => void;
  depth: number;
  tabs: { slug: string; label: string; content: string; updated_at?: string }[];
}

function NodeEditor({ node, onChange, onDelete, depth, tabs }: NodeEditorProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (isResultNode(node)) {
    return (
      <div className="border rounded-lg p-3 bg-green-50/50 dark:bg-green-950/10 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span className="text-xs font-medium text-green-700">Result</span>
          {node.source_tab_slug && node.last_synced_at && (
            <Badge variant="outline" className="text-xs ml-auto">
              Synced {new Date(node.last_synced_at).toLocaleDateString()}
            </Badge>
          )}
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="ml-auto h-7 w-7 p-0 text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              value={node.title}
              onChange={e => onChange({ ...node, title: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">Image URL</Label>
            <Input
              value={node.image_url || ""}
              onChange={e => onChange({ ...node, image_url: e.target.value || undefined })}
              placeholder="rghub/p-pm-dashboard.png or full https:// URL"
              className="h-8 text-sm font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Image alt text</Label>
            <Input
              value={node.image_alt || ""}
              onChange={e => onChange({ ...node, image_alt: e.target.value || undefined })}
              placeholder="Describe the screenshot"
              className="h-8 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">Content (Markdown)</Label>
            <Textarea
              value={node.content_markdown || ""}
              onChange={e => onChange({ ...node, content_markdown: e.target.value })}
              rows={4}
              className="text-sm font-mono"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Sync from tab</Label>
              <select
                value={node.source_tab_slug || ""}
                onChange={e => onChange({
                  ...node,
                  source_tab_slug: e.target.value || undefined,
                  source_section: undefined,
                  last_synced_at: undefined,
                })}
                className="w-full h-8 text-sm border rounded px-2 bg-background"
              >
                <option value="">None (static content only)</option>
                {tabs.map(t => (
                  <option key={t.slug} value={t.slug}>{t.label}</option>
                ))}
              </select>
            </div>
            {node.source_tab_slug && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-8"
                onClick={() => {
                  const sourceTab = tabs.find(t => t.slug === node.source_tab_slug);
                  if (!sourceTab) {
                    toast.error("Source tab not found");
                    return;
                  }
                  // Pull content from tab — take first 2000 chars as a reasonable excerpt
                  const content = sourceTab.content.slice(0, 2000);
                  onChange({
                    ...node,
                    content_markdown: content,
                    last_synced_at: new Date().toISOString(),
                  });
                  toast.success(`Synced content from "${sourceTab.label}"`);
                }}
              >
                <RefreshCw className="h-3 w-3" />
                Sync now
              </Button>
            )}
          </div>

          {node.source_tab_slug && (
            <div>
              <Label className="text-xs">Section heading (optional — leave blank for full tab)</Label>
              <Input
                value={node.source_section || ""}
                onChange={e => onChange({ ...node, source_section: e.target.value || undefined })}
                placeholder="e.g. Eligibility Requirements"
                className="h-8 text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => onChange(createEmptyQuestion())}
          >
            Convert to question
          </Button>
        </div>
      </div>
    );
  }

  // Question node
  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <HelpCircle className="h-3.5 w-3.5 text-[var(--color-brand-accent)]" />
          Question
        </button>
        <span className="text-xs text-muted-foreground truncate flex-1">
          {node.question}
        </span>
        <Badge variant="secondary" className="text-xs">
          {node.options.length} options
        </Badge>
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 w-7 p-0 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 pl-2 border-l-2 border-[var(--color-brand-accent)]/20">
          <div>
            <Label className="text-xs">Question text</Label>
            <Input
              value={node.question}
              onChange={e => onChange({ ...node, question: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">Help text (optional)</Label>
            <Input
              value={node.help_text || ""}
              onChange={e => onChange({ ...node, help_text: e.target.value || undefined })}
              placeholder="Additional context for the user"
              className="h-8 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">Image URL (optional)</Label>
            <Input
              value={node.image_url || ""}
              onChange={e => onChange({ ...node, image_url: e.target.value || undefined })}
              placeholder="rghub/s-supervisor-login-dropdown.png or full URL"
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Options</Label>
            {node.options.map((option, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-bold text-[var(--color-brand-accent)] w-5">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <Input
                    value={option.label}
                    onChange={e => {
                      const newOptions = [...node.options];
                      newOptions[idx] = { ...option, label: e.target.value };
                      onChange({ ...node, options: newOptions });
                    }}
                    className="h-8 text-sm flex-1"
                    placeholder="Option label"
                  />
                  {node.options.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => {
                        const newOptions = node.options.filter((_, i) => i !== idx);
                        onChange({ ...node, options: newOptions });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Nested node editor */}
                <div className="ml-7">
                  <NodeEditor
                    node={option.next}
                    onChange={updatedNext => {
                      const newOptions = [...node.options];
                      newOptions[idx] = { ...option, next: updatedNext };
                      onChange({ ...node, options: newOptions });
                    }}
                    onDelete={undefined}
                    depth={depth + 1}
                    tabs={tabs}
                  />
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => {
                const newOptions = [
                  ...node.options,
                  { label: `Option ${String.fromCharCode(65 + node.options.length)}`, next: createEmptyResult() }
                ];
                onChange({ ...node, options: newOptions });
              }}
            >
              <Plus className="h-3 w-3" />
              Add option
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Editor Component ─────────────────────────────────────────────

export function DecisionTreeTab() {
  const { decisionTrees, tabs, createDecisionTree, updateDecisionTree, deleteDecisionTree } = useCMS();
  const [editingTree, setEditingTree] = useState<DecisionTree | null>(null);
  const [localTree, setLocalTree] = useState<DecisionTree | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const tabsForSync = tabs.map(t => ({
    slug: t.slug,
    label: t.label,
    content: t.content,
  }));

  const handleCreateTree = async () => {
    const newTree = {
      slug: `guide-${Date.now()}`,
      title: "New Interactive Guide",
      description: "Answer a few questions to find what you need.",
      icon: "🧭",
      tree_data: createEmptyQuestion(),
      requires_auth: false,
      is_visible: false,
      order_index: decisionTrees.length,
      category: null,
    };
    try {
      await createDecisionTree(newTree);
      toast.success("Decision tree created");
    } catch (error: any) {
      toast.error(`Failed to create: ${error?.message || error}`);
    }
  };

  const handleEditTree = (tree: DecisionTree) => {
    setEditingTree(tree);
    setLocalTree({ ...tree, tree_data: JSON.parse(JSON.stringify(tree.tree_data)) });
  };

  const handleSaveTree = async () => {
    if (!localTree) return;
    try {
      await updateDecisionTree(localTree);
      setEditingTree(null);
      setLocalTree(null);
      toast.success("Decision tree saved");
    } catch (error: any) {
      toast.error(`Failed to save: ${error?.message || error}`);
    }
  };

  const handleDeleteTree = async (id: string) => {
    if (!confirm("Are you sure you want to delete this decision tree?")) return;
    try {
      await deleteDecisionTree(id);
      if (editingTree?.id === id) {
        setEditingTree(null);
        setLocalTree(null);
      }
      toast.success("Decision tree deleted");
    } catch (error: any) {
      toast.error(`Failed to delete: ${error?.message || error}`);
    }
  };

  // Count nodes in a tree for display
  const countNodes = (node: DecisionTreeNode): { questions: number; results: number } => {
    if (isResultNode(node)) return { questions: 0, results: 1 };
    let questions = 1;
    let results = 0;
    for (const option of node.options) {
      const sub = countNodes(option.next);
      questions += sub.questions;
      results += sub.results;
    }
    return { questions, results };
  };

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {/* Left: Tree list */}
      <div className="md:col-span-4 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Decision Trees</CardTitle>
              <Button size="sm" className="gap-1 h-7" onClick={handleCreateTree}>
                <Plus className="h-3.5 w-3.5" />
                New
              </Button>
            </div>
            <CardDescription className="text-xs">
              Interactive guides shown on the landing page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {decisionTrees.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No decision trees yet. Create one to get started.
              </p>
            )}
            {decisionTrees.map(tree => {
              const counts = countNodes(tree.tree_data);
              return (
                <div
                  key={tree.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    editingTree?.id === tree.id
                      ? 'border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)]/5'
                      : 'hover:border-[var(--color-brand-accent)]/40'
                  }`}
                  onClick={() => handleEditTree(tree)}
                >
                  <span className="text-lg">{tree.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tree.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {counts.questions}Q / {counts.results}R
                      </span>
                      {!tree.is_visible && (
                        <Badge variant="outline" className="text-xs">Draft</Badge>
                      )}
                      {tree.requires_auth && (
                        <Badge variant="secondary" className="text-xs">TPA</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={e => { e.stopPropagation(); handleDeleteTree(tree.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Right: Editor */}
      <div className="md:col-span-8">
        {localTree ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Edit: {localTree.title}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-7"
                    onClick={() => { setEditingTree(null); setLocalTree(null); }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" className="gap-1 h-7" onClick={handleSaveTree}>
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Meta fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={localTree.title}
                    onChange={e => setLocalTree({ ...localTree, title: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Slug</Label>
                  <Input
                    value={localTree.slug}
                    onChange={e => setLocalTree({ ...localTree, slug: e.target.value })}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Icon</Label>
                  <Input
                    value={localTree.icon}
                    onChange={e => setLocalTree({ ...localTree, icon: e.target.value })}
                    className="h-8 text-sm text-center"
                  />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Input
                    value={localTree.category || ""}
                    onChange={e => setLocalTree({ ...localTree, category: e.target.value || null })}
                    placeholder="e.g. ntcer, proda, rghub"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Order</Label>
                  <Input
                    type="number"
                    value={localTree.order_index}
                    onChange={e => setLocalTree({ ...localTree, order_index: parseInt(e.target.value) || 0 })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Description</Label>
                <Input
                  value={localTree.description || ""}
                  onChange={e => setLocalTree({ ...localTree, description: e.target.value || null })}
                  placeholder="Short description shown on the guide card"
                  className="h-8 text-sm"
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={localTree.is_visible}
                    onCheckedChange={checked => setLocalTree({ ...localTree, is_visible: checked })}
                  />
                  <Label className="text-xs">Visible on landing page</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={localTree.requires_auth}
                    onCheckedChange={checked => setLocalTree({ ...localTree, requires_auth: checked })}
                  />
                  <Label className="text-xs">TPA only (requires login)</Label>
                </div>
              </div>

              <Separator />

              {/* Tree structure editor */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">Decision Tree Structure</Label>
                </div>

                <NodeEditor
                  node={localTree.tree_data}
                  onChange={updatedNode => setLocalTree({ ...localTree, tree_data: updatedNode })}
                  depth={0}
                  tabs={tabsForSync}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a decision tree from the list to edit, or create a new one.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
