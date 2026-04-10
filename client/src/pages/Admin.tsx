import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCMS } from "@/contexts/CMSContext";
import { useAuth } from "@/contexts/AuthContext";
import { TabContent, TabFolder, AppSettings } from "@/types/cms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Save, Copy, ChevronUp, ChevronDown, ImagePlus, Loader2, LogOut, FolderOpen, FileUp, X, Download, Archive, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { InsightsTab } from "@/components/admin/InsightsTab";
import { DecisionTreeTab } from "@/components/admin/DecisionTreeEditor";
import { DateRangeFilter, DateRange } from "@/components/admin/DateRangeFilter";
import { loadFollowUpContacts, updateFollowUpStatus, FollowUpContact } from "@/lib/followUpApi";

export default function Admin() {
  const { settings, tabs, folders, refreshData, updateTab, createTab, deleteTab, updateSettings, createFolder, updateFolder, deleteFolder } = useCMS();
  const { signOut, profile } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState("content");
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const isSystemAdmin = profile?.role === 'internal_admin';
  const isClientAdmin = profile?.role === 'client_admin';
  const canManageContent = isSystemAdmin;
  const canViewExports = isSystemAdmin || isClientAdmin;

  // Local state for editing to avoid constant re-renders/saves
  const [localTab, setLocalTab] = useState<TabContent | null>(null);
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpContact[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pipelineBusy, setPipelineBusy] = useState<null | 'convert' | 'process' | 'extract' | 'full'>(null);
  const [pipelineChunkSize, setPipelineChunkSize] = useState<number>(8);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [chunkExtractionResult, setChunkExtractionResult] = useState<any>(null);

  // Sync local settings when context settings change (after save/refresh)
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleEditTab = (tab: TabContent) => {
    setEditingTabId(tab.id);
    setLocalTab({ ...tab });
  };

  const handleSaveTab = async () => {
    if (!localTab) return;
    try {
      await updateTab(localTab);
      toast.success("Tab saved successfully");
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to save tab: ${msg}`);
      console.error("Save tab error:", error);
    }
  };

  const handleCreateTab = async () => {
    const newTab = {
      slug: `new-tab-${Date.now()}`,
      label: "New Tab",
      icon: "📝",
      content: "# New Content\n\nStart writing here...",
      order_index: tabs.length,
      is_supplementary: false,
      is_visible: true,
      folder_id: null as string | null,
      file_url: null as string | null,
      toc_max_depth: null as number | null,
      requires_auth: false,
      content_type: 'text' as const,
      summary: null as string | null,
      page_slug: null as string | null
    };
    try {
      await createTab(newTab);
      toast.success("New tab created");
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to create tab: ${msg}`);
      console.error("Create tab error:", error);
    }
  };

  const handleDuplicateTab = async (tab: TabContent) => {
    const newTab = {
      ...tab,
      slug: `${tab.slug}-copy`,
      label: `${tab.label} (Copy)`,
      order_index: tabs.length,
    };
    // Remove ID to let DB generate new one
    const { id, ...tabData } = newTab;
    try {
      await createTab(tabData);
      toast.success("Tab duplicated");
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to duplicate tab: ${msg}`);
      console.error("Duplicate tab error:", error);
    }
  };

  const handleDeleteTab = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tab?")) return;
    try {
      await deleteTab(id);
      if (editingTabId === id) {
        setEditingTabId(null);
        setLocalTab(null);
      }
      toast.success("Tab deleted");
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to delete tab: ${msg}`);
      console.error("Delete tab error:", error);
    }
  };

  const handleMoveTab = async (tab: TabContent, direction: 'up' | 'down') => {
    // Scope movement to tabs within the same folder
    const folderId = tab.folder_id ?? null;
    const sameFolderTabs = tabs
      .filter(t => (t.folder_id ?? null) === folderId)
      .sort((a, b) => a.order_index - b.order_index);

    const currentIndex = sameFolderTabs.findIndex(t => t.id === tab.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Check bounds within the folder
    if (targetIndex < 0 || targetIndex >= sameFolderTabs.length) return;

    const targetTab = sameFolderTabs[targetIndex];

    try {
      // Swap order_index values
      await updateTab({ ...tab, order_index: targetTab.order_index });
      await updateTab({ ...targetTab, order_index: tab.order_index });
      toast.success("Tab order updated");
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to reorder tabs: ${msg}`);
      console.error("Reorder tab error:", error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings(localSettings);
      toast.success("Settings saved");
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to save settings: ${msg}`);
      console.error("Save settings error:", error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !localTab) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}-${safeName}`;

      const { data, error } = await supabase.storage
        .from('content-images')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('content-images')
        .getPublicUrl(data.path);

      const imageMarkdown = `\n![${file.name}](${publicUrl})\n`;
      const textarea = textareaRef.current;

      if (textarea) {
        const start = textarea.selectionStart;
        const before = localTab.content.substring(0, start);
        const after = localTab.content.substring(start);
        setLocalTab({ ...localTab, content: before + imageMarkdown + after });
      } else {
        setLocalTab({ ...localTab, content: localTab.content + imageMarkdown });
      }

      toast.success('Image uploaded and inserted');
    } catch (error: any) {
      const msg = error?.message || 'Upload failed';
      toast.error(`Image upload failed: ${msg}`);
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !localTab || !supabase) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File must be under 50MB');
      return;
    }

    setUploadingFile(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}-${safeName}`;

      const { data, error } = await supabase.storage
        .from('downloads')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('downloads')
        .getPublicUrl(data.path);

      setLocalTab({ ...localTab, file_url: publicUrl });
      toast.success('File uploaded');
    } catch (error: any) {
      const msg = error?.message || 'Upload failed';
      toast.error(`File upload failed: ${msg}`);
      console.error('File upload error:', error);
    } finally {
      setUploadingFile(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const invokeEdge = async (fnName: string, body: Record<string, unknown>) => {
    if (!supabase) throw new Error('Supabase is not configured');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL / anon key missing from frontend environment');
    }

    // Get current session, refreshing if close to expiry.
    // autoRefreshToken is disabled (lock bypass causes concurrent refresh races),
    // so we manually refresh when the token has <5 min remaining.
    let { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (session?.expires_at) {
      const expiresInSec = session.expires_at - Math.floor(Date.now() / 1000);
      if (expiresInSec < 300) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session) {
          session = refreshed.session;
        }
      }
    }
    if (sessionError || !session?.access_token) {
      throw new Error('You are not signed in. Please sign out and sign back in.');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let parsed: Record<string, any> | null = null;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const detail = parsed?.error || parsed?.message || responseText || `HTTP ${response.status}`;
      // If gateway rejects the JWT, try ONE refresh and retry
      if (response.status === 401 && /jwt/i.test(detail)) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session?.access_token) {
          throw new Error('Your session has expired. Please sign out and sign back in.');
        }
        const retryResponse = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${refreshed.session.access_token}`,
          },
          body: JSON.stringify(body),
        });
        const retryText = await retryResponse.text();
        let retryParsed: Record<string, any> | null = null;
        try { retryParsed = retryText ? JSON.parse(retryText) : null; } catch { retryParsed = null; }
        if (!retryResponse.ok) {
          const retryDetail = retryParsed?.error || retryParsed?.message || retryText || `HTTP ${retryResponse.status}`;
          throw new Error(`Edge Function ${fnName} failed (${retryResponse.status}): ${retryDetail}`);
        }
        return (retryParsed ?? {}) as Record<string, any>;
      }
      throw new Error(`Edge Function ${fnName} failed (${response.status}): ${detail}`);
    }

    return (parsed ?? {}) as Record<string, any>;
  };

  const handleProcessPdfToMarkdown = async (mode: 'generic' | 'ntcer', saveToTab = false): Promise<boolean> => {
    if (!localTab) return;
    if (!supabase) {
      toast.error('Supabase is not configured');
      return false;
    }
    if (!localTab.file_url) {
      toast.error('Upload a PDF file to this tab first');
      return false;
    }
    if (!/\.pdf($|\?)/i.test(localTab.file_url)) {
      toast.error('This pipeline currently expects a PDF file');
      return false;
    }

    setPipelineBusy(mode === 'ntcer' ? 'process' : 'convert');
    setPipelineResult(null);
    try {
      const fnName = mode === 'ntcer' ? 'process-pdf' : 'convert-pdf-to-markdown';
      const chunkSize = Math.max(2, Math.min(20, pipelineChunkSize || 8));

      if (mode === 'generic') {
        const baseBody: Record<string, unknown> = {
          tab_id: localTab.id,
          save: false,
          pages_per_chunk: chunkSize,
        };

        const first = await invokeEdge(fnName, { ...baseBody, chunk_index: 0 });
        const totalPages = Number(first?.total_pages || 0);
        const chunksTotal = Number(first?.chunks_total || (totalPages ? Math.ceil(totalPages / chunkSize) : 1));

        const markdownParts: string[] = [];
        let tokensIn = 0;
        let tokensOut = 0;

        if (first?.markdown) markdownParts.push(first.markdown);
        tokensIn += Number(first?.tokens?.input || 0);
        tokensOut += Number(first?.tokens?.output || 0);

        for (let i = 1; i < chunksTotal; i++) {
          const chunkData = await invokeEdge(fnName, { ...baseBody, chunk_index: i });
          if (chunkData?.markdown) markdownParts.push(chunkData.markdown);
          tokensIn += Number(chunkData?.tokens?.input || 0);
          tokensOut += Number(chunkData?.tokens?.output || 0);
        }

        const markdown = markdownParts.join('\n\n');
        const data = {
          success: true,
          markdown,
          chars: markdown.length,
          total_pages: totalPages,
          chunks_processed: chunksTotal,
          chunks_total: chunksTotal,
          tokens: { input: tokensIn, output: tokensOut },
          saved: false,
        };

        if (saveToTab) {
          await updateTab({ ...localTab, content: markdown });
          setLocalTab((prev: TabContent | null) => (prev ? { ...prev, content: markdown } : prev));
          await refreshData();
          data.saved = true;
        }

        setPipelineResult({ fnName, data, mode, saveToTab });
        toast.success(saveToTab ? 'PDF processed and saved to tab' : 'PDF processed — review output below');
        return true;
      }

      const body: Record<string, unknown> = {
        tab_id: localTab.id,
        save: saveToTab,
        pages_per_chunk: chunkSize,
      };

      const data = await invokeEdge(fnName, body);
      setPipelineResult({ fnName, data, mode, saveToTab });

      if (data?.markdown && saveToTab) {
        setLocalTab((prev: TabContent | null) => prev ? { ...prev, content: data.markdown } : prev);
        await refreshData();
      }

      if (data?.success === false) {
        toast.error(data?.error || 'PDF processing returned validation errors');
        return false;
      } else {
        toast.success(saveToTab ? 'PDF processed and saved to tab' : 'PDF processed — review output below');
        return true;
      }
    } catch (error: any) {
      const msg = error?.message || 'Pipeline failed';
      toast.error(`Pipeline error: ${msg}`);
      console.error('Content pipeline error:', error);
      return false;
    } finally {
      setPipelineBusy(null);
    }
  };

  const handleExtractKnowledgeChunks = async (): Promise<boolean> => {
    if (!localTab) return;
    if (!supabase) {
      toast.error('Supabase is not configured');
      return false;
    }

    setPipelineBusy('extract');
    setChunkExtractionResult(null);
    try {
      const baseBody = { tab_id: localTab.id };
      const first = await invokeEdge('extract-tab-chunks', { ...baseBody, segment_index: 0 });
      let finalResult = first;

      const tabResult = Array.isArray(first?.results) ? first.results[0] : null;
      const totalSegments = Number(tabResult?.segments_total || 1);

      if (totalSegments > 1) {
        for (let i = 1; i < totalSegments; i++) {
          finalResult = await invokeEdge('extract-tab-chunks', { ...baseBody, segment_index: i });
        }
      }

      setChunkExtractionResult(finalResult);

      const finalTabResult = Array.isArray(finalResult?.results) ? finalResult.results[0] : null;
      if (finalTabResult?.status === 'complete') {
        toast.success(`Extracted ${finalTabResult.chunks} chunk(s) for ${finalTabResult.slug}`);
        return true;
      } else if (finalTabResult?.status) {
        toast.error(`Chunk extraction status: ${finalTabResult.status}${finalTabResult?.error ? ` — ${finalTabResult.error}` : ''}`);
        return false;
      } else {
        toast.success('Knowledge chunk extraction completed');
        return true;
      }
    } catch (error: any) {
      const msg = error?.message || 'Chunk extraction failed';
      toast.error(`Chunk extraction error: ${msg}`);
      console.error('extract-tab-chunks error:', error);
      return false;
    } finally {
      setPipelineBusy(null);
    }
  };

  const handleProcessMedia = async (saveAndChunk = false): Promise<boolean> => {
    if (!localTab) return false;
    if (!localTab.file_url) { toast.error('Add a video/audio URL first'); return false; }
    setPipelineBusy(saveAndChunk ? 'full' : 'convert');
    try {
      const result = await invokeEdge('process-media', { tab_id: localTab.id, media_url: localTab.file_url, save: true });
      const markdown = result?.markdown || result?.transcript;
      if (markdown) { setLocalTab({ ...localTab, content: markdown }); await updateTab({ ...localTab, content: markdown }); toast.success('Media transcribed and saved'); }
      else { toast.success('Media processed'); }
      await refreshData();
      if (saveAndChunk) { const extracted = await handleExtractKnowledgeChunks(); if (!extracted) return false; toast.success('Media processed + knowledge chunks extracted'); }
      return true;
    } catch (error: any) { toast.error(`Media processing failed: ${error?.message || error}`); return false; }
    finally { setPipelineBusy(null); }
  };

  const handleIngestUrl = async (saveAndChunk = false): Promise<boolean> => {
    if (!localTab) return false;
    if (!localTab.file_url) { toast.error('Add a URL first'); return false; }
    setPipelineBusy(saveAndChunk ? 'full' : 'convert');
    try {
      const result = await invokeEdge('ingest-url', { tab_id: localTab.id, url: localTab.file_url });
      const chars = result?.content_chars || 0;
      if (chars > 0) {
        toast.success(`Extracted ${chars} characters from URL`);
        refreshData().catch(() => {});
        if (saveAndChunk) {
          const extracted = await handleExtractKnowledgeChunks();
          if (!extracted) return false;
          toast.success('URL ingested + knowledge chunks extracted');
        }
      } else {
        toast.error('No content extracted from URL');
      }
      return chars > 0;
    } catch (error: any) {
      toast.error(`URL ingest failed: ${error?.message || error}`);
      return false;
    } finally {
      setPipelineBusy(null);
    }
  };

  const handleRunFullContentPipeline = async () => {
    if (!localTab) return;
    setPipelineBusy('full');
    try {
      const processed = await handleProcessPdfToMarkdown('generic', true);
      if (!processed) return;
      const extracted = await handleExtractKnowledgeChunks();
      if (!extracted) return;
      toast.success('Full content pipeline run complete');
    } finally {
      setPipelineBusy(null);
    }
  };

  const handleCreateFolder = async () => {
    const newFolder = {
      slug: `folder-${Date.now()}`,
      label: "New Folder",
      icon: "📁",
      order_index: folders.length
    };
    try {
      await createFolder(newFolder);
      toast.success("Folder created");
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to create folder: ${msg}`);
    }
  };

  const handleSaveFolder = async (folder: TabFolder) => {
    try {
      await updateFolder(folder);
      toast.success("Folder saved");
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to save folder: ${msg}`);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Delete this folder? Tabs inside will become unassigned.")) return;
    try {
      await deleteFolder(id);
      toast.success("Folder deleted");
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to delete folder: ${msg}`);
    }
  };

  // ── Feedback tab state ──────────────────────────────────────
  interface FeedbackCampaignRow {
    id: string;
    campaign_slug: string;
    title: string;
    status: string;
    created_at: string;
  }
  interface FeedbackSessionRow {
    id: string;
    campaign_id: string;
    status: string;
    transcript: unknown;
    structured_feedback: unknown;
    engagement_level: string | null;
    areas_covered: string[] | null;
    notable_insights: string | null;
    willing_to_chat: boolean | null;
    preferred_contact: string | null;
    started_at: string;
    completed_at: string | null;
  }

  interface NeraQueryRow {
    id: string;
    session_id: string | null;
    query_text: string;
    response_text: string;
    sources_cited: string[] | null;
    retrieval_method: string | null;
    feedback_score: number | null;
    detected_intent: string | null;
    detected_pathway: string | null;
    detected_classification: string | null;
    response_latency_ms: number | null;
    created_at: string;
  }

  const [feedbackCampaigns, setFeedbackCampaigns] = useState<FeedbackCampaignRow[]>([]);
  const [feedbackSessions, setFeedbackSessions] = useState<FeedbackSessionRow[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [neraQueries, setNeraQueries] = useState<NeraQueryRow[]>([]);
  const [neraLoading, setNeraLoading] = useState(false);
  const [neraExpandedId, setNeraExpandedId] = useState<string | null>(null);

  // Date range filters
  const [feedbackDateRange, setFeedbackDateRange] = useState<DateRange>({ from: null, to: null });
  const [neraDateRange, setNeraDateRange] = useState<DateRange>({ from: null, to: null });

  const [neraExportColumns, setNeraExportColumns] = useState<string[]>([]);
  const [feedbackExportColumns, setFeedbackExportColumns] = useState<string[]>([]);
  const [followUpExportColumns, setFollowUpExportColumns] = useState<string[]>([]);

  const NERA_EXPORT_FIELDS = [
    { key: 'timestamp', label: 'Timestamp' },
    { key: 'query_text', label: 'Query' },
    { key: 'response_text', label: 'Response' },
    { key: 'detected_intent', label: 'Intent' },
    { key: 'detected_pathway', label: 'Pathway' },
    { key: 'detected_classification', label: 'Classification' },
    { key: 'sources_cited', label: 'Sources' },
    { key: 'feedback_score', label: 'Feedback Score' },
    { key: 'response_latency_ms', label: 'Latency (ms)' },
    { key: 'retrieval_method', label: 'Retrieval Method' },
    { key: 'session_id', label: 'Session ID' },
  ];

  const FEEDBACK_EXPORT_FIELDS = [
    { key: 'status', label: 'Status' },
    { key: 'started_at', label: 'Started' },
    { key: 'completed_at', label: 'Completed' },
    { key: 'participant_role', label: 'Participant Role' },
    { key: 'resources_used', label: 'Resources Used' },
    { key: 'strengths', label: 'Strengths' },
    { key: 'gaps', label: 'Gaps' },
    { key: 'accuracy_concerns', label: 'Accuracy Concerns' },
    { key: 'suggestions', label: 'Suggestions' },
    { key: 'format_preferences', label: 'Format Preferences' },
    { key: 'willing_to_chat', label: 'Willing to Chat' },
    { key: 'engagement_level', label: 'Engagement Level' },
    { key: 'areas_covered', label: 'Areas Covered' },
    { key: 'notable_insights', label: 'Notable Insights' },
    { key: 'session_id', label: 'Session ID (Technical)' },
  ];

  const FOLLOWUP_EXPORT_FIELDS = [
    { key: 'name', label: 'Name' },
    { key: 'contact_method', label: 'Contact Method' },
    { key: 'contact_details', label: 'Contact Details' },
    { key: 'availability_notes', label: 'Availability' },
    { key: 'status', label: 'Status' },
    { key: 'admin_notes', label: 'Admin Notes' },
    { key: 'created_at', label: 'Submitted' },
    { key: 'id', label: 'Follow-up ID (Technical)' },
  ];

  const loadFeedbackData = async (dateRange?: DateRange) => {
    if (!supabase) return;
    setFeedbackLoading(true);
    const range = dateRange ?? feedbackDateRange;
    try {
      let sessionsQuery = supabase
        .from('feedback_sessions')
        .select('id, campaign_id, status, transcript, structured_feedback, engagement_level, areas_covered, notable_insights, willing_to_chat, preferred_contact, started_at, completed_at');
      if (range.from) sessionsQuery = sessionsQuery.gte('started_at', range.from.toISOString());
      if (range.to) sessionsQuery = sessionsQuery.lte('started_at', range.to.toISOString());

      const [campaignsRes, sessionsRes] = await Promise.all([
        supabase.from('feedback_campaigns').select('id, campaign_slug, title, status, created_at'),
        sessionsQuery,
      ]);
      // Silently handle missing tables — these are template features not yet provisioned
      if (campaignsRes.data) setFeedbackCampaigns(campaignsRes.data);
      if (sessionsRes.data) setFeedbackSessions(sessionsRes.data);
    } catch (err: any) {
      if (err?.code !== 'PGRST205') console.error('Failed to load feedback data:', err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Load feedback data when switching to the feedback tab or changing date filter
  useEffect(() => {
    if (activeSection === 'feedback') loadFeedbackData(feedbackDateRange);
  }, [activeSection, feedbackDateRange]);

  // Load follow-up contacts when switching to that tab (or on initial load for badge count)
  const loadFollowUps = async () => {
    setFollowUpsLoading(true);
    try {
      const data = await loadFollowUpContacts();
      setFollowUps(data);
    } catch (err: any) {
      // Silence missing table error — follow_up_contacts doesn't exist in this project yet
      if (err?.code !== 'PGRST205') console.error('Failed to load follow-up contacts:', err);
    } finally {
      setFollowUpsLoading(false);
    }
  };

  // Only load follow-ups when the tab is active — no eager load on mount
  useEffect(() => {
    if (activeSection === 'followups') loadFollowUps();
  }, [activeSection]);

  // ── Nera Queries ────────────────────────────────────────────
  const NERA_PAGE_SIZE = 100;
  const [neraPage, setNeraPage] = useState(0);
  const [neraHasMore, setNeraHasMore] = useState(false);

  const loadNeraQueries = async (dateRange?: DateRange, page = 0) => {
    if (!supabase) return;
    setNeraLoading(true);
    const range = dateRange ?? neraDateRange;
    try {
      let query = supabase
        .from('nera_queries')
        .select('id, session_id, query_text, response_text, sources_cited, retrieval_method, feedback_score, detected_intent, detected_pathway, detected_classification, response_latency_ms, created_at')
        .order('created_at', { ascending: false });
      if (range.from) query = query.gte('created_at', range.from.toISOString());
      if (range.to) query = query.lte('created_at', range.to.toISOString());
      query = query.range(page * NERA_PAGE_SIZE, (page + 1) * NERA_PAGE_SIZE);

      const { data } = await query;
      if (data) {
        setNeraQueries(prev => page === 0 ? data : [...prev, ...data]);
        setNeraHasMore(data.length > NERA_PAGE_SIZE);
        setNeraPage(page);
      }
    } catch (err) {
      console.error('Failed to load Nera queries:', err);
    } finally {
      setNeraLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'nera') loadNeraQueries(neraDateRange, 0);
  }, [activeSection, neraDateRange]);

  const handleExportNeraCSV = () => {
    const esc = (val: unknown): string => {
      if (val == null) return '';
      const str = Array.isArray(val) ? val.join('; ') : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'Timestamp', 'Query', 'Response', 'Intent', 'Pathway', 'Classification',
      'Retrieval Method', 'Sources', 'Feedback Score', 'Latency (ms)', 'Session ID',
    ];

    const rows = neraQueries.map(q => [
      esc(q.created_at ? new Date(q.created_at).toLocaleString('en-AU') : ''),
      esc(q.query_text),
      esc(q.response_text),
      esc(q.detected_intent),
      esc(q.detected_pathway),
      esc(q.detected_classification),
      esc(q.retrieval_method),
      esc(q.sources_cited),
      esc(q.feedback_score),
      esc(q.response_latency_ms),
      esc(q.session_id),
    ].join(','));

    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nera-queries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${neraQueries.length} Nera queries as CSV`);
  };

  const handleFollowUpStatusChange = async (id: string, status: FollowUpContact['status'], notes?: string) => {
    const success = await updateFollowUpStatus(id, status, notes);
    if (success) {
      setFollowUps(prev => prev.map(f => f.id === id ? { ...f, status, admin_notes: notes ?? f.admin_notes } : f));
      toast.success(`Status updated to ${status}`);
    } else {
      toast.error('Failed to update status');
    }
  };

  const handleExportFeedback = (campaignId: string) => {
    const campaign = feedbackCampaigns.find(c => c.id === campaignId);
    const sessions = feedbackSessions.filter(s => s.campaign_id === campaignId);
    const exportData = {
      campaign: campaign,
      exported_at: new Date().toISOString(),
      total_sessions: sessions.length,
      sessions: sessions,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-${campaign?.campaign_slug || campaignId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${sessions.length} sessions`);
  };

  const handleExportFeedbackCSV = (campaignId: string) => {
    const campaign = feedbackCampaigns.find(c => c.id === campaignId);
    const sessions = feedbackSessions.filter(s => s.campaign_id === campaignId);

    // CSV helper: escape a value for Excel compatibility
    const esc = (val: unknown): string => {
      if (val == null) return '';
      const str = Array.isArray(val) ? val.join('; ') : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'Session ID', 'Status', 'Started', 'Completed',
      'Participant Role', 'Resources Used', 'Strengths', 'Gaps',
      'Accuracy Concerns', 'Suggestions', 'Format Preferences',
      'Willing to Chat', 'Engagement Level', 'Areas Covered', 'Notable Insights',
    ];

    const rows = sessions.map(s => {
      const fb = (s.structured_feedback as Record<string, unknown>) || {};
      return [
        esc(s.id),
        esc(s.status),
        esc(s.started_at ? new Date(s.started_at).toLocaleString('en-AU') : ''),
        esc(s.completed_at ? new Date(s.completed_at).toLocaleString('en-AU') : ''),
        esc(fb.participant_role),
        esc(fb.resources_used),
        esc(fb.strengths),
        esc(fb.gaps),
        esc(fb.accuracy_concerns),
        esc(fb.suggestions),
        esc(fb.format_preferences),
        esc(s.willing_to_chat),
        esc(s.engagement_level),
        esc(s.areas_covered),
        esc(s.notable_insights),
      ].join(',');
    });

    // BOM for Excel UTF-8 detection
    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-${campaign?.campaign_slug || campaignId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${sessions.length} sessions as CSV`);
  };

  const handleArchiveFeedback = async (campaignId: string) => {
    if (!supabase) return;
    const sessions = feedbackSessions.filter(s => s.campaign_id === campaignId && s.transcript !== null);
    if (sessions.length === 0) {
      toast.info('No transcripts to archive');
      return;
    }
    if (!confirm(`Archive ${sessions.length} session transcript(s)? This clears the raw transcript from the database but keeps structured feedback and all metadata. Make sure you've exported first.`)) return;

    setArchiving(true);
    try {
      const { error } = await supabase
        .from('feedback_sessions')
        .update({ transcript: null })
        .eq('campaign_id', campaignId);
      if (error) throw error;
      toast.success(`Archived ${sessions.length} transcripts`);
      await loadFeedbackData();
    } catch (err) {
      toast.error('Archive failed');
      console.error(err);
    } finally {
      setArchiving(false);
    }
  };

  // Group tabs by folder for the sidebar display
  const sortedFolders = [...folders].sort((a, b) => a.order_index - b.order_index);
  const tabsByFolder = new Map<string | null, TabContent[]>();
  for (const tab of tabs) {
    const key = tab.folder_id ?? null;
    if (!tabsByFolder.has(key)) tabsByFolder.set(key, []);
    tabsByFolder.get(key)!.push(tab);
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-heading">Admin Dashboard</h1>
            {profile?.email && (
              <p className="text-sm text-muted-foreground mt-1">{profile.email}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={async () => {
              toast.info('Refreshing data...');
              await refreshData();
              toast.success('Data refreshed');
            }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" onClick={() => setLocation("/")}>
              View Site
            </Button>
            <Button variant="outline" onClick={() => {
              // Don't await signOut — if the token is expired, the server call hangs.
              // Clear local state and redirect immediately. Server session expires on its own.
              signOut().catch(() => {});
              window.location.replace('/login');
            }}>
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>

        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-6">
          <TabsList>
            <TabsTrigger value="content">Content & Tabs</TabsTrigger>
            <TabsTrigger value="settings">Global Settings</TabsTrigger>
            <TabsTrigger value="theme">Theme & Styling</TabsTrigger>
            <TabsTrigger value="trees">Decision Trees</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="nera">Nera Queries</TabsTrigger>
            <TabsTrigger value="followups">
              Follow-ups
              {followUps.filter(f => f.status === 'pending').length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-xs font-medium">
                  {followUps.filter(f => f.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* CONTENT MANAGEMENT TAB */}
          <TabsContent value="content" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Sidebar: Folders & Tab List */}
              <div className="md:col-span-4 space-y-4">
                {/* Folder Management */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" /> Folders
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={handleCreateFolder}>
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {sortedFolders.map((folder) => (
                      <div key={folder.id} className="flex items-center gap-2 p-2 rounded-md border">
                        <Input
                          className="h-8 w-12 text-center px-1"
                          value={folder.icon}
                          onChange={(e) => handleSaveFolder({ ...folder, icon: e.target.value })}
                        />
                        <Input
                          className="h-8 flex-1"
                          value={folder.label}
                          onChange={(e) => handleSaveFolder({ ...folder, label: e.target.value })}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {(tabsByFolder.get(folder.id) || []).length} tabs
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteFolder(folder.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {folders.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">No folders yet</p>
                    )}
                  </CardContent>
                </Card>

                {/* Tab List (grouped by page, then folder) */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Content</CardTitle>
                      <Button size="sm" onClick={handleCreateTab}>
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
                    {/* Tabs grouped by folder */}
                    {sortedFolders.map((folder) => {
                      const folderTabs = tabsByFolder.get(folder.id) || [];
                      if (folderTabs.length === 0) return null;
                      return (
                        <div key={folder.id}>
                          <p className="text-xs font-semibold text-[#2D7E32] uppercase tracking-wider mb-1 px-1">
                            {folder.icon} {folder.label}
                          </p>
                          <div className="space-y-1 ml-2 border-l-2 border-[#2D7E32]/20 pl-2">
                            {folderTabs.map((tab) => (
                              <div
                                key={tab.id}
                                className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors ${
                                  editingTabId === tab.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                                }`}
                                onClick={() => handleEditTab(tab)}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="text-base">{tab.icon}</span>
                                  <span className="font-medium truncate text-sm">{tab.label}</span>
                                  {tab.page_slug && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2D7E32]/10 text-[#2D7E32] font-medium">{tab.page_slug}</span>}
                                  {!tab.is_visible && <span className="text-xs text-muted-foreground">(Hidden)</span>}
                                  {tab.requires_auth && <span className="text-xs text-orange-500 font-medium">(Auth)</span>}
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={folderTabs.findIndex(t => t.id === tab.id) === 0} onClick={(e) => { e.stopPropagation(); handleMoveTab(tab, 'up'); }}>
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={folderTabs.findIndex(t => t.id === tab.id) === folderTabs.length - 1} onClick={(e) => { e.stopPropagation(); handleMoveTab(tab, 'down'); }}>
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDuplicateTab(tab); }}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteTab(tab.id); }}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Unassigned tabs (no folder) */}
                    {(() => {
                      const unassignedTabs = tabsByFolder.get(null) || [];
                      if (unassignedTabs.length === 0) return null;
                      return (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                            Unassigned
                          </p>
                          <div className="space-y-1">
                            {unassignedTabs.map((tab) => (
                              <div
                                key={tab.id}
                                className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors ${
                                  editingTabId === tab.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                                }`}
                                onClick={() => handleEditTab(tab)}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="text-base">{tab.icon}</span>
                                  <span className="font-medium truncate text-sm">{tab.label}</span>
                                  {tab.page_slug && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2D7E32]/10 text-[#2D7E32] font-medium">{tab.page_slug}</span>}
                                  {!tab.is_visible && <span className="text-xs text-muted-foreground">(Hidden)</span>}
                                  {tab.requires_auth && <span className="text-xs text-orange-500 font-medium">(Auth)</span>}
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={unassignedTabs.findIndex(t => t.id === tab.id) === 0} onClick={(e) => { e.stopPropagation(); handleMoveTab(tab, 'up'); }}>
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={unassignedTabs.findIndex(t => t.id === tab.id) === unassignedTabs.length - 1} onClick={(e) => { e.stopPropagation(); handleMoveTab(tab, 'down'); }}>
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDuplicateTab(tab); }}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteTab(tab.id); }}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              {/* Main Area: Editor */}
              <div className="md:col-span-8">
                {localTab ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Edit Tab: {localTab.label}</CardTitle>
                        <Button onClick={handleSaveTab}>
                          <Save className="h-4 w-4 mr-2" /> Save Changes
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Page Assignment — most important field */}
                      <div className="rounded-lg border-2 border-[#2D7E32]/20 bg-[#2D7E32]/5 p-4 space-y-3">
                        <h4 className="font-heading font-bold text-sm text-[#2D7E32]">Page Assignment</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Page</Label>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={localTab.page_slug || ''}
                              onChange={(e) => setLocalTab({ ...localTab, page_slug: e.target.value || null })}
                            >
                              <option value="">Hub only (no page)</option>
                              <option value="about-me">About Me</option>
                              <option value="services">Services</option>
                              <option value="insights">Insights</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Content Type</Label>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={localTab.content_type || 'text'}
                              onChange={(e) => setLocalTab({ ...localTab, content_type: e.target.value as any })}
                            >
                              <option value="text">Text (Markdown)</option>
                              <option value="video">Video (YouTube/Vimeo/MP4)</option>
                              <option value="pdf">PDF Document</option>
                              <option value="cards">Card Grid (JSON)</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Summary (shown when accordion is collapsed)</Label>
                          <div className="flex gap-2">
                            <Input
                              value={localTab.summary || ''}
                              onChange={(e) => setLocalTab({ ...localTab, summary: e.target.value || null })}
                              placeholder="One-line teaser for this section..."
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!supabase || !!pipelineBusy || (!localTab.content?.trim() && !localTab.label)}
                              onClick={async () => {
                                setPipelineBusy('convert');
                                try {
                                  const result = await invokeEdge('generate-summary', { tab_id: localTab.id, save: true });
                                  const summary = result?.summary;
                                  if (summary) {
                                    setLocalTab({ ...localTab, summary });
                                    toast.success('Summary generated');
                                  }
                                  await refreshData();
                                } catch (e: any) {
                                  toast.error(`Summary failed: ${e?.message || e}`);
                                } finally {
                                  setPipelineBusy(null);
                                }
                              }}
                            >
                              {pipelineBusy === 'convert' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">Auto-generate from content using AI, or type your own.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Label</Label>
                          <Input
                            value={localTab.label}
                            onChange={(e) => setLocalTab({ ...localTab, label: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Icon (Emoji)</Label>
                          <Input
                            value={localTab.icon}
                            onChange={(e) => setLocalTab({ ...localTab, icon: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4">
                        <div className="flex items-center space-x-2 pt-4">
                          <Switch
                            checked={localTab.is_visible}
                            onCheckedChange={(c) => setLocalTab({ ...localTab, is_visible: c })}
                          />
                          <Label>Visible</Label>
                        </div>
                        <div className="flex items-center space-x-2 pt-4">
                          <Switch
                            checked={localTab.is_supplementary}
                            onCheckedChange={(c) => setLocalTab({ ...localTab, is_supplementary: c })}
                          />
                          <Label>Supplementary</Label>
                        </div>
                        <div className="flex items-center space-x-2 pt-4">
                          <Switch
                            checked={localTab.requires_auth}
                            onCheckedChange={(c) => setLocalTab({ ...localTab, requires_auth: c })}
                          />
                          <Label>Login Only</Label>
                        </div>
                        <div className="space-y-2">
                          <Label>TOC Depth</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={localTab.toc_max_depth ?? ''}
                            onChange={(e) => setLocalTab({ ...localTab, toc_max_depth: e.target.value ? Number(e.target.value) : null })}
                          >
                            <option value="">All (default)</option>
                            <option value="2">H2 only</option>
                            <option value="3">H2 + H3</option>
                            <option value="4">H2 + H3 + H4</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Folder (Hub only)</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={localTab.folder_id || ''}
                            onChange={(e) => setLocalTab({ ...localTab, folder_id: e.target.value || null })}
                          >
                            <option value="">No folder</option>
                            {sortedFolders.map((folder) => (
                              <option key={folder.id} value={folder.id}>
                                {folder.icon} {folder.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Content Source — adapts to content_type */}
                      <div className="space-y-2">
                        <Label>
                          {localTab.content_type === 'video' ? 'Video URL (YouTube, Vimeo, or direct MP4)' :
                           localTab.content_type === 'pdf' ? 'PDF File' :
                           localTab.content_type === 'cards' ? 'Card Data (JSON in file_url field)' :
                           'File (optional)'}
                        </Label>

                        {/* URL input for video type */}
                        {localTab.content_type === 'video' && (
                          <div className="space-y-2">
                            <Input
                              value={localTab.file_url || ''}
                              onChange={(e) => setLocalTab({ ...localTab, file_url: e.target.value || null })}
                              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                            />
                            {localTab.file_url && /youtube|youtu\.be|vimeo/i.test(localTab.file_url) && (
                              <p className="text-xs text-green-600 flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                Video URL detected — will render as embedded player
                              </p>
                            )}
                          </div>
                        )}

                        {/* URL input for cards type */}
                        {localTab.content_type === 'cards' && (
                          <div className="space-y-2">
                            <Textarea
                              value={localTab.file_url || ''}
                              onChange={(e) => setLocalTab({ ...localTab, file_url: e.target.value || null })}
                              placeholder='[{"title":"Card Title","tagline":"Description","href":"https://...","category":"Group"}]'
                              rows={4}
                              className="font-mono text-xs"
                            />
                            <p className="text-xs text-muted-foreground">JSON array of cards. Each card: title, tagline, href, category (optional).</p>
                          </div>
                        )}

                        {/* File upload for pdf type or generic */}
                        {(localTab.content_type === 'pdf' || localTab.content_type === 'text') && (
                          <>
                        {localTab.file_url ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                              <FileUp className="h-4 w-4 text-primary shrink-0" />
                              <a
                                href={localTab.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline truncate flex-1"
                              >
                                {localTab.file_url.split('/').pop()}
                              </a>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive shrink-0"
                                onClick={() => setLocalTab({ ...localTab, file_url: null })}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            {localTab.content_type === 'pdf' && (
                            <div className="flex flex-wrap items-center gap-3 text-xs px-1">
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                PDF uploaded
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className={`h-2 w-2 rounded-full ${localTab.content && localTab.content.trim().length > 0 ? 'bg-green-500' : 'bg-amber-400'}`} />
                                {localTab.content && localTab.content.trim().length > 0 ? 'Markdown generated' : 'Markdown pending'}
                              </span>
                              {/\.pdf($|\?)/i.test(localTab.file_url) && (
                                <span className="text-muted-foreground">
                                  Users will see inline PDF viewer
                                </span>
                              )}
                            </div>
                            )}
                            <p className="text-xs text-muted-foreground">Or paste a URL directly:</p>
                            <Input
                              value={localTab.file_url || ''}
                              onChange={(e) => setLocalTab({ ...localTab, file_url: e.target.value || null })}
                              placeholder="https://..."
                            />
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Upload a file or paste a URL:</p>
                            <Input
                              value={localTab.file_url || ''}
                              onChange={(e) => setLocalTab({ ...localTab, file_url: e.target.value || null })}
                              placeholder="https://... (or upload below)"
                              className="mb-2"
                            />
                            <input
                              ref={pdfInputRef}
                              type="file"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                              className="hidden"
                              onChange={handleFileUpload}
                              disabled={uploadingFile || !supabase}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingFile || !supabase}
                              onClick={() => pdfInputRef.current?.click()}
                            >
                              {uploadingFile ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <FileUp className="h-4 w-4 mr-1" />
                              )}
                              Upload File
                            </Button>
                            <p className="text-xs text-muted-foreground mt-1">
                              PDF, Word, Excel, or PowerPoint (max 50MB). PDFs display in an inline viewer; other formats show as download cards.
                            </p>
                          </div>
                        )}
                          </>
                        )}
                      </div>

                      <Card className="border-dashed">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Content Pipeline</CardTitle>
                          <CardDescription>
                            {localTab.content_type === 'video' ? 'Transcribe video via Gemini AI and extract knowledge chunks.'
                              : localTab.file_url && /gamma\.app|docs\.google\.com|canva\.com/.test(localTab.file_url) ? 'Fetch content from embedded URL and extract knowledge chunks.'
                              : 'PDF to Markdown conversion and knowledge chunk refresh.'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {!supabase && (
                            <p className="text-sm text-muted-foreground">
                              Supabase is not configured. Pipeline actions are unavailable.
                            </p>
                          )}

                          {localTab.content_type === 'video' && (
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" size="sm" disabled={!supabase || !localTab.file_url || !!pipelineBusy} onClick={() => handleProcessMedia(false)}>
                                {pipelineBusy === 'convert' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Transcribe Video
                              </Button>
                              <Button type="button" variant="outline" size="sm" disabled={!supabase || !!pipelineBusy} onClick={handleExtractKnowledgeChunks}>
                                {pipelineBusy === 'extract' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Refresh Knowledge Chunks
                              </Button>
                              <Button type="button" size="sm" disabled={!supabase || !localTab.file_url || !!pipelineBusy} onClick={() => handleProcessMedia(true)}>
                                {pipelineBusy === 'full' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Full Run (Transcribe + Chunks)
                              </Button>
                            </div>
                          )}

                          {localTab.file_url && /gamma\.app|docs\.google\.com|canva\.com|\.html?($|\?)/.test(localTab.file_url) && localTab.content_type !== 'video' && (
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" size="sm" disabled={!supabase || !localTab.file_url || !!pipelineBusy} onClick={() => handleIngestUrl(false)}>
                                {pipelineBusy === 'convert' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Fetch URL Content
                              </Button>
                              <Button type="button" variant="outline" size="sm" disabled={!supabase || !!pipelineBusy} onClick={handleExtractKnowledgeChunks}>
                                {pipelineBusy === 'extract' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Refresh Knowledge Chunks
                              </Button>
                              <Button type="button" size="sm" disabled={!supabase || !localTab.file_url || !!pipelineBusy} onClick={() => handleIngestUrl(true)}>
                                {pipelineBusy === 'full' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Full Run (Fetch + Chunks)
                              </Button>
                              <p className="w-full text-xs text-muted-foreground">
                                Fetches text content from the URL. For JavaScript-rendered pages (Gamma, Canva), paste content manually into the Content field instead.
                              </p>
                            </div>
                          )}

                          <div className="grid gap-3 md:grid-cols-[140px_1fr] md:items-center">
                            <Label>Chunk Size (pages)</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={2}
                                max={20}
                                value={pipelineChunkSize}
                                onChange={(e) => setPipelineChunkSize(Number(e.target.value) || 8)}
                                className="w-24"
                              />
                              <span className="text-xs text-muted-foreground">
                                Pages per chunk for PDF processing (default 8)
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!supabase || !localTab.file_url || !!pipelineBusy}
                              onClick={() => handleProcessPdfToMarkdown('generic', false)}
                            >
                              {pipelineBusy === 'convert' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Convert PDF (Preview)
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!supabase || !!pipelineBusy}
                              onClick={handleExtractKnowledgeChunks}
                            >
                              {pipelineBusy === 'extract' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Refresh Knowledge Chunks
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!supabase || !localTab.file_url || !!pipelineBusy}
                              onClick={handleRunFullContentPipeline}
                            >
                              {pipelineBusy === 'full' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Full Run (Process + Save + Chunks)
                            </Button>
                          </div>

                          {!localTab.file_url && (
                            <p className="text-xs text-muted-foreground">
                              Upload a PDF in “Downloadable File” above to enable PDF processing for this tab.
                            </p>
                          )}

                          {pipelineResult?.data && (
                            <div className="rounded-md border p-3 space-y-2 bg-muted/20">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-medium">Last run:</span>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{pipelineResult.fnName}</code>
                                {typeof pipelineResult.data.success === 'boolean' && (
                                  <span className={pipelineResult.data.success ? 'text-green-600' : 'text-amber-700'}>
                                    {pipelineResult.data.success ? 'Success' : 'Validation flagged'}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                                {pipelineResult.data.total_pages ? <span>Pages: {pipelineResult.data.total_pages}</span> : null}
                                {pipelineResult.data.chunks_processed ? <span>Chunks: {pipelineResult.data.chunks_processed}</span> : null}
                                {pipelineResult.data.chars ? <span>Chars: {Number(pipelineResult.data.chars).toLocaleString()}</span> : null}
                                {pipelineResult.data.tokens?.input ? <span>Tokens in: {Number(pipelineResult.data.tokens.input).toLocaleString()}</span> : null}
                                {pipelineResult.data.tokens?.output ? <span>Tokens out: {Number(pipelineResult.data.tokens.output).toLocaleString()}</span> : null}
                              </div>
                              {pipelineResult.data.error && (
                                <p className="text-xs text-amber-700">{pipelineResult.data.error}</p>
                              )}
                              {pipelineResult.data.validation?.missingSections?.length > 0 && (
                                <p className="text-xs text-amber-700">
                                  Missing sections: {pipelineResult.data.validation.missingSections.join(', ')}
                                </p>
                              )}
                              {pipelineResult.data.markdown && !pipelineResult.data.saved && (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setLocalTab({ ...localTab, content: pipelineResult.data.markdown });
                                      toast.success('Loaded converted markdown into editor. Click Save Changes to persist.');
                                    }}
                                  >
                                    Load Markdown Into Editor
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!!pipelineBusy}
                                    onClick={() => handleProcessPdfToMarkdown('generic', true)}
                                  >
                                    Save Converted Markdown Directly
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {chunkExtractionResult && (
                            <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
                              <p>
                                Extraction version: <code>{chunkExtractionResult.extraction_version || 'unknown'}</code>
                              </p>
                              {Array.isArray(chunkExtractionResult.results) && chunkExtractionResult.results[0] && (
                                <p>
                                  Result: <code>{chunkExtractionResult.results[0].status}</code> · Chunks: {chunkExtractionResult.results[0].chunks ?? 0}
                                  {chunkExtractionResult.results[0].error ? ` · Error: ${chunkExtractionResult.results[0].error}` : ''}
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Content (Markdown)</Label>
                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                              disabled={uploading || !supabase}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploading || !supabase}
                              onClick={() => fileInputRef.current?.click()}
                            >
                              {uploading ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <ImagePlus className="h-4 w-4 mr-1" />
                              )}
                              Insert Image
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          ref={textareaRef}
                          className="min-h-[400px] font-mono text-sm"
                          value={localTab.content}
                          onChange={(e) => setLocalTab({ ...localTab, content: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Supports Markdown: # Heading, **Bold**, - List, [Link](url), ![Image](url)
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg p-12">
                    Select a tab to edit
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* GLOBAL SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Global Settings</CardTitle>
                <CardDescription>Manage site-wide text and configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>App Title</Label>
                  <Input
                    value={localSettings.app_title}
                    onChange={(e) => setLocalSettings({ ...localSettings, app_title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Header Subtitle</Label>
                  <Input
                    value={localSettings.header_subtitle}
                    onChange={(e) => setLocalSettings({ ...localSettings, header_subtitle: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Footer Copyright Text</Label>
                  <Input
                    value={localSettings.footer_text}
                    onChange={(e) => setLocalSettings({ ...localSettings, footer_text: e.target.value })}
                  />
                </div>
                <Button onClick={handleSaveSettings}>
                  <Save className="h-4 w-4 mr-2" /> Save Settings
                </Button>
              </CardContent>
            </Card>

            {/* Footer Sections */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Footer Sections</CardTitle>
                    <CardDescription>Configure the footer columns (supports Markdown for lists)</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const sections = localSettings.footer_sections || [];
                      setLocalSettings({
                        ...localSettings,
                        footer_sections: [...sections, { title: 'New Section', content: 'Enter content here...' }]
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Section
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {(localSettings.footer_sections || []).map((section, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Section {index + 1}</Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          const sections = [...(localSettings.footer_sections || [])];
                          sections.splice(index, 1);
                          setLocalSettings({ ...localSettings, footer_sections: sections });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={section.title}
                        onChange={(e) => {
                          const sections = [...(localSettings.footer_sections || [])];
                          sections[index] = { ...sections[index], title: e.target.value };
                          setLocalSettings({ ...localSettings, footer_sections: sections });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea
                        className="min-h-[100px]"
                        value={section.content}
                        onChange={(e) => {
                          const sections = [...(localSettings.footer_sections || [])];
                          sections[index] = { ...sections[index], content: e.target.value };
                          setLocalSettings({ ...localSettings, footer_sections: sections });
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Supports Markdown. For lists, use: - Item 1\n- Item 2\n- Item 3
                      </p>
                    </div>
                  </div>
                ))}
                {(!localSettings.footer_sections || localSettings.footer_sections.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">
                    No footer sections. Click "Add Section" to create one.
                  </p>
                )}
                <Button onClick={handleSaveSettings}>
                  <Save className="h-4 w-4 mr-2" /> Save Footer Sections
                </Button>
              </CardContent>
            </Card>

            {/* Welcome Page Banner */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Welcome Page Banner</CardTitle>
                    <CardDescription>Display an announcement or notice on the welcome/landing page</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="banner-enabled" className="text-sm text-muted-foreground">
                      {localSettings.welcome_banner?.enabled ? 'Visible' : 'Hidden'}
                    </Label>
                    <Switch
                      id="banner-enabled"
                      checked={localSettings.welcome_banner?.enabled ?? false}
                      onCheckedChange={(checked) =>
                        setLocalSettings({
                          ...localSettings,
                          welcome_banner: {
                            enabled: checked,
                            content: localSettings.welcome_banner?.content ?? '',
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Banner Content</Label>
                  <Textarea
                    className="min-h-[120px]"
                    placeholder="e.g. **New:** Updated content is now available."
                    value={localSettings.welcome_banner?.content ?? ''}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        welcome_banner: {
                          enabled: localSettings.welcome_banner?.enabled ?? false,
                          content: e.target.value,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports Markdown: **bold**, [links](url), - lists
                  </p>
                </div>
                <Button onClick={handleSaveSettings}>
                  <Save className="h-4 w-4 mr-2" /> Save Banner
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DECISION TREES TAB */}
          <TabsContent value="trees" className="space-y-6">
            <DecisionTreeTab />
          </TabsContent>

          {/* FEEDBACK TAB */}
          <TabsContent value="feedback" className="space-y-6">
            <DateRangeFilter value={feedbackDateRange} onChange={setFeedbackDateRange} />
            {feedbackLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : feedbackCampaigns.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No feedback campaigns found. Run the feedback migration to get started.
                </CardContent>
              </Card>
            ) : (
              feedbackCampaigns.map((campaign) => {
                const sessions = feedbackSessions.filter(s => s.campaign_id === campaign.id);
                const completed = sessions.filter(s => s.status === 'completed').length;
                const inProgress = sessions.filter(s => s.status === 'in_progress').length;
                const withTranscript = sessions.filter(s => s.transcript !== null).length;
                const withFeedback = sessions.filter(s => s.structured_feedback !== null).length;

                return (
                  <Card key={campaign.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{campaign.title}</CardTitle>
                          <CardDescription>
                            Slug: <code className="text-xs bg-muted px-1 py-0.5 rounded">{campaign.campaign_slug}</code>
                            {' '}&middot;{' '}
                            Status: <span className={campaign.status === 'active' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>{campaign.status}</span>
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => loadFeedbackData(feedbackDateRange)}>
                          Refresh
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="border rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold">{sessions.length}</div>
                          <div className="text-xs text-muted-foreground">Total Sessions</div>
                        </div>
                        <div className="border rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-green-600">{completed}</div>
                          <div className="text-xs text-muted-foreground">Completed</div>
                        </div>
                        <div className="border rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-amber-600">{inProgress}</div>
                          <div className="text-xs text-muted-foreground">In Progress</div>
                        </div>
                        <div className="border rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-blue-600">{withFeedback}</div>
                          <div className="text-xs text-muted-foreground">With Structured Feedback</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <Button onClick={() => handleExportFeedbackCSV(campaign.id)} disabled={sessions.length === 0}>
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV ({sessions.length})
                        </Button>
                        <Button variant="outline" onClick={() => handleExportFeedback(campaign.id)} disabled={sessions.length === 0}>
                          <Download className="h-4 w-4 mr-2" />
                          Export JSON
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleArchiveFeedback(campaign.id)}
                          disabled={archiving || withTranscript === 0}
                        >
                          {archiving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Archive className="h-4 w-4 mr-2" />
                          )}
                          Archive Transcripts ({withTranscript})
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        CSV exports structured feedback in a format ready for Excel. JSON includes full transcripts and raw data.
                        Archive clears raw transcripts from the database but keeps structured feedback, insights, and metadata.
                      </p>

                      {/* Session list */}
                      {sessions.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold">Sessions</h3>
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left px-3 py-2 font-medium">Started</th>
                                  <th className="text-left px-3 py-2 font-medium">Status</th>
                                  <th className="text-left px-3 py-2 font-medium">Engagement</th>
                                  <th className="text-left px-3 py-2 font-medium">Transcript</th>
                                  <th className="text-left px-3 py-2 font-medium">Feedback</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sessions
                                  .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                                  .map((session) => (
                                    <tr key={session.id} className="border-t">
                                      <td className="px-3 py-2 text-muted-foreground">
                                        {new Date(session.started_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                          session.status === 'completed' ? 'bg-green-100 text-green-700' :
                                          session.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                                          'bg-gray-100 text-gray-600'
                                        }`}>
                                          {session.status}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-muted-foreground">{session.engagement_level || '—'}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{session.transcript ? 'Yes' : 'Archived'}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{session.structured_feedback ? 'Yes' : '—'}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* INSIGHTS TAB */}
          <TabsContent value="insights" className="space-y-6">
            {feedbackCampaigns.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No feedback campaigns found. Create a campaign first.
                </CardContent>
              </Card>
            ) : (
              feedbackCampaigns.map((campaign) => (
                <InsightsTab
                  key={campaign.id}
                  campaignId={campaign.id}
                  campaignTitle={campaign.title}
                />
              ))
            )}
          </TabsContent>

          {/* NERA QUERIES TAB */}
          <TabsContent value="nera" className="space-y-6">
            <DateRangeFilter value={neraDateRange} onChange={setNeraDateRange} />
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Nera Query Log</CardTitle>
                    <CardDescription>
                      Interactions with the Nera AI assistant. Use this to spot patterns, failed lookups, and content gaps.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => loadNeraQueries(neraDateRange, 0)} disabled={neraLoading}>
                      {neraLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button onClick={handleExportNeraCSV} disabled={neraQueries.length === 0}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV ({neraQueries.length})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {neraLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : neraQueries.length === 0 ? (
                  <p className="text-muted-foreground py-4">No Nera queries recorded yet.</p>
                ) : (
                  <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                      <div className="border rounded-lg p-3 text-center">
                        <div className="text-xl font-bold">{neraQueries.length}</div>
                        <div className="text-xs text-muted-foreground">Total Queries</div>
                      </div>
                      <div className="border rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-green-600">
                          {neraQueries.filter(q => q.feedback_score === 1).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Positive</div>
                      </div>
                      <div className="border rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-red-600">
                          {neraQueries.filter(q => q.feedback_score === -1).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Negative</div>
                      </div>
                      <div className="border rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-amber-600">
                          {neraQueries.filter(q => q.retrieval_method === 'no_results').length}
                        </div>
                        <div className="text-xs text-muted-foreground">No Results</div>
                      </div>
                      <div className="border rounded-lg p-3 text-center">
                        <div className="text-xl font-bold">
                          {neraQueries.length > 0
                            ? Math.round(neraQueries.reduce((sum, q) => sum + (q.response_latency_ms || 0), 0) / neraQueries.length)
                            : 0}ms
                        </div>
                        <div className="text-xs text-muted-foreground">Avg Latency</div>
                      </div>
                    </div>

                    {/* Query list */}
                    <div className="space-y-1">
                      {neraQueries.map((q) => (
                        <div key={q.id} className="border rounded-lg overflow-hidden">
                          <button
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                            onClick={() => setNeraExpandedId(neraExpandedId === q.id ? null : q.id)}
                          >
                            {/* Feedback indicator */}
                            <span className={`h-2 w-2 rounded-full shrink-0 ${
                              q.feedback_score === 1 ? 'bg-green-500' :
                              q.feedback_score === -1 ? 'bg-red-500' :
                              'bg-gray-300'
                            }`} />
                            {/* Retrieval method badge */}
                            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                              q.retrieval_method === 'no_results' ? 'bg-amber-100 text-amber-700' :
                              q.retrieval_method === 'semantic' ? 'bg-blue-100 text-blue-700' :
                              q.retrieval_method === 'keyword' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {q.retrieval_method || '—'}
                            </span>
                            {/* Query text */}
                            <span className="text-sm flex-1 truncate">{q.query_text}</span>
                            {/* Timestamp */}
                            <span className="text-xs text-muted-foreground shrink-0">
                              {new Date(q.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </button>

                          {neraExpandedId === q.id && (
                            <div className="border-t px-4 py-3 bg-muted/20 space-y-3 text-sm">
                              <div className="flex flex-wrap gap-3 text-xs">
                                {q.detected_intent && (
                                  <span className="text-muted-foreground">Intent: <span className="text-foreground font-medium">{q.detected_intent}</span></span>
                                )}
                                {q.detected_pathway && (
                                  <span className="text-foreground">Pathway: <span className="text-foreground font-medium">{q.detected_pathway}</span></span>
                                )}
                                {q.detected_classification && (
                                  <span className="text-muted-foreground">Classification: <span className="text-foreground font-medium">{q.detected_classification}</span></span>
                                )}
                                {q.response_latency_ms != null && (
                                  <span className="text-muted-foreground">Latency: <span className="text-foreground font-medium">{q.response_latency_ms}ms</span></span>
                                )}
                              </div>
                              {q.sources_cited && q.sources_cited.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  Sources: {q.sources_cited.join(', ')}
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Response:</p>
                                <div className="bg-background rounded border p-3 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                                  {q.response_text}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Load more */}
                    {neraHasMore && (
                      <div className="text-center pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={neraLoading}
                          onClick={() => loadNeraQueries(neraDateRange, neraPage + 1)}
                        >
                          {neraLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Load more
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FOLLOW-UPS TAB */}
          <TabsContent value="followups" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Follow-up Contact Requests</CardTitle>
                <CardDescription>
                  People who agreed to a follow-up conversation during their feedback interview.
                  Contact details are stored separately from their anonymous responses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {followUpsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : followUps.length === 0 ? (
                  <p className="text-muted-foreground py-4">No follow-up requests yet.</p>
                ) : (
                  <div className="space-y-3">
                    {followUps.map((contact) => {
                      const methodLabel = contact.contact_method === 'teams' ? 'Teams' : contact.contact_method === 'phone' ? 'Phone' : 'Email';
                      const statusColors: Record<string, string> = {
                        pending: 'bg-amber-100 text-amber-800',
                        contacted: 'bg-blue-100 text-blue-800',
                        completed: 'bg-green-100 text-green-800',
                        declined: 'bg-gray-100 text-gray-600',
                      };
                      return (
                        <div key={contact.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{contact.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[contact.status] || ''}`}>
                                  {contact.status}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {methodLabel}: <span className="text-foreground font-medium">{contact.contact_details}</span>
                              </div>
                              {contact.availability_notes && (
                                <div className="text-sm text-muted-foreground">
                                  Availability: {contact.availability_notes}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                Submitted {new Date(contact.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {contact.admin_notes && (
                                <div className="text-xs text-muted-foreground italic">
                                  Notes: {contact.admin_notes}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {contact.status === 'pending' && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleFollowUpStatusChange(contact.id, 'contacted')}>
                                    Mark Contacted
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleFollowUpStatusChange(contact.id, 'declined')}>
                                    Decline
                                  </Button>
                                </>
                              )}
                              {contact.status === 'contacted' && (
                                <Button size="sm" variant="outline" onClick={() => handleFollowUpStatusChange(contact.id, 'completed')}>
                                  Mark Completed
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* THEME SETTINGS TAB */}
          <TabsContent value="theme">
            <Card>
              <CardHeader>
                <CardTitle>Theme & Styling</CardTitle>
                <CardDescription>Customize the look and feel of your application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        className="w-12 h-10 p-1"
                        value={localSettings.theme?.primary_color || '#2F5233'}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          theme: { ...localSettings.theme, primary_color: e.target.value }
                        })}
                      />
                      <Input
                        value={localSettings.theme?.primary_color || '#2F5233'}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          theme: { ...localSettings.theme, primary_color: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        className="w-12 h-10 p-1"
                        value={localSettings.theme?.secondary_color || '#D9EAD3'}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          theme: { ...localSettings.theme, secondary_color: e.target.value }
                        })}
                      />
                      <Input
                        value={localSettings.theme?.secondary_color || '#D9EAD3'}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          theme: { ...localSettings.theme, secondary_color: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Heading Font</Label>
                    <Input
                      value={localSettings.theme?.font_heading || 'Merriweather'}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        theme: { ...localSettings.theme, font_heading: e.target.value }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">Must be a valid Google Font name or system font</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Body Font</Label>
                    <Input
                      value={localSettings.theme?.font_body || 'Inter'}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        theme: { ...localSettings.theme, font_body: e.target.value }
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Corner Radius</Label>
                    <Input
                      value={localSettings.theme?.radius || '0.75rem'}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        theme: { ...localSettings.theme, radius: e.target.value }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">e.g., 0.5rem, 12px, 1rem</p>
                  </div>
                </div>

                <Button onClick={handleSaveSettings}>
                  <Save className="h-4 w-4 mr-2" /> Save Theme
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
