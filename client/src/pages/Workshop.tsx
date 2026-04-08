import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { queryNeraStreaming } from '@/lib/neraApi';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, Camera, MessageSquare, BarChart3, FileText,
  QrCode, Send, Bot, User, Loader2, Image, Trash2,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import type {
  WorkshopDecision, WorkshopPhoto, WorkshopChatMessage,
  PriorityLevel, DecisionStatus, ChatFunction,
} from '@shared/types';

const WORKSHOP_AI_URL =
  import.meta.env.VITE_WORKSHOP_AI_API_URL ||
  `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/workshop-ai`;

const WORKSHOP_OCR_URL =
  import.meta.env.VITE_WORKSHOP_OCR_API_URL ||
  `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/workshop-ocr`;

type WorkshopTab = 'qr' | 'photos' | 'decisions' | 'chat' | 'report';

const tabConfig = [
  { id: 'qr' as const, label: 'QR Upload', icon: QrCode },
  { id: 'photos' as const, label: 'Photos & OCR', icon: Image },
  { id: 'decisions' as const, label: 'Decisions', icon: BarChart3 },
  { id: 'chat' as const, label: 'AI Assistant', icon: MessageSquare },
  { id: 'report' as const, label: 'Report', icon: FileText },
];

export default function Workshop() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<WorkshopTab>('qr');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Photos
  const [photos, setPhotos] = useState<WorkshopPhoto[]>([]);

  // Decisions
  const [decisions, setDecisions] = useState<WorkshopDecision[]>([]);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [newDecision, setNewDecision] = useState({
    category: '',
    title: '',
    description: '',
    priority: 'MEDIUM' as PriorityLevel,
  });

  // Chat
  const [chatMessages, setChatMessages] = useState<WorkshopChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatFunction, setChatFunction] = useState<ChatFunction>('question');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [neraSessionId] = useState(
    () => `ws-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );

  // Load session data
  useEffect(() => {
    if (!supabase || !sessionId) {
      setLoading(false);
      return;
    }

    const loadSession = async () => {
      const { data } = await supabase!
        .from('workshop_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      setSession(data);

      // Load photos
      const { data: photoData } = await supabase!
        .from('workshop_photos')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      if (photoData) setPhotos(photoData);

      // Load decisions
      const { data: decisionData } = await supabase!
        .from('workshop_decisions')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      if (decisionData) setDecisions(decisionData);

      setLoading(false);
    };

    loadSession();
  }, [sessionId]);

  // Auto-scroll chat
  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [chatMessages]);

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${session?.access_token || sessionId}`
    : '';

  // Decision management
  const addDecision = async () => {
    if (!supabase || !sessionId || !newDecision.title) return;
    const { data } = await supabase
      .from('workshop_decisions')
      .insert({
        session_id: sessionId,
        category: newDecision.category,
        title: newDecision.title,
        description: newDecision.description,
        priority: newDecision.priority,
        status: 'proposed' as DecisionStatus,
        created_by: user?.user_id,
      })
      .select()
      .single();
    if (data) {
      setDecisions((prev) => [data, ...prev]);
      setNewDecision({ category: '', title: '', description: '', priority: 'MEDIUM' });
      setShowDecisionForm(false);
    }
  };

  const updateDecisionStatus = async (id: string, status: DecisionStatus) => {
    if (!supabase) return;
    await supabase.from('workshop_decisions').update({ status }).eq('id', id);
    setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
  };

  // AI Chat
  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatStreaming) return;

    const userMsg: WorkshopChatMessage = {
      id: `user-${Date.now()}`,
      session_id: sessionId || '',
      role: 'user',
      content: chatInput.trim(),
      chat_function: chatFunction,
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatStreaming(true);

    const assistantId = `assistant-${Date.now()}`;
    setChatMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        session_id: sessionId || '',
        role: 'assistant',
        content: '',
        chat_function: chatFunction,
        created_at: new Date().toISOString(),
      },
    ]);

    const contextPrefix =
      chatFunction === 'swot_categorisation'
        ? '[SWOT Analysis Request] '
        : chatFunction === 'narrative_summary'
          ? '[Narrative Summary Request] '
          : '';

    try {
      await queryNeraStreaming(
        WORKSHOP_AI_URL,
        contextPrefix + userMsg.content,
        neraSessionId,
        {
          onMeta: () => {},
          onDelta: (text) => {
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + text } : m,
              ),
            );
          },
          onDone: () => setIsChatStreaming(false),
          onError: (error) => {
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `Error: ${error}` }
                  : m,
              ),
            );
            setIsChatStreaming(false);
          },
        },
        {
          user_id: user?.user_id,
          workshop_session_id: sessionId,
          context: `workshop-${chatFunction}`,
        },
      );
    } catch {
      setIsChatStreaming(false);
    }
  }, [chatInput, isChatStreaming, chatFunction, neraSessionId, sessionId, user?.user_id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const priorityColour = (p: PriorityLevel) =>
    p === 'HIGH' ? 'bg-red-100 text-red-800' : p === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';

  const statusColour = (s: DecisionStatus) =>
    s === 'approved' ? 'bg-green-100 text-green-800' : s === 'rejected' ? 'bg-red-100 text-red-800' : s === 'deferred' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800';

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground no-underline">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-heading font-semibold text-foreground text-sm">
                {session?.name || 'Workshop Session'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {session?.client_name || 'Live Facilitation'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="border-b border-border bg-card px-2 shrink-0">
        <div className="flex overflow-x-auto gap-1">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* QR Code Tab */}
        {activeTab === 'qr' && (
          <div className="p-6 max-w-lg mx-auto text-center">
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">
              Participant Upload
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Display this QR code for workshop participants to upload photos of sticky notes,
              whiteboards, and other materials directly from their phones.
            </p>
            <div className="bg-white p-8 rounded-xl border border-border inline-block mb-4">
              <QRCodeSVG value={joinUrl} size={256} level="H" />
            </div>
            <p className="text-xs text-muted-foreground break-all">{joinUrl}</p>
          </div>
        )}

        {/* Photos & OCR Tab */}
        {activeTab === 'photos' && (
          <div className="p-6 max-w-4xl mx-auto">
            <h2 className="font-heading text-xl font-bold text-foreground mb-4">
              Uploaded Photos ({photos.length})
            </h2>
            {photos.length === 0 ? (
              <div className="text-center py-12">
                <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No photos uploaded yet. Share the QR code with participants.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    <img
                      src={photo.image_url}
                      alt="Workshop upload"
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            photo.ocr_status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : photo.ocr_status === 'processing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : photo.ocr_status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          OCR: {photo.ocr_status}
                        </span>
                        {photo.priority && (
                          <span className={`text-xs px-2 py-0.5 rounded ${priorityColour(photo.priority)}`}>
                            {photo.priority}
                          </span>
                        )}
                      </div>
                      {photo.ocr_text && (
                        <p className="text-xs text-foreground line-clamp-3">{photo.ocr_text}</p>
                      )}
                      {photo.swot_category && (
                        <span className="text-xs text-primary font-medium mt-1 block">
                          SWOT: {photo.swot_category}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Decisions Tab */}
        {activeTab === 'decisions' && (
          <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold text-foreground">
                Workshop Decisions ({decisions.length})
              </h2>
              <button
                onClick={() => setShowDecisionForm(!showDecisionForm)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                {showDecisionForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Add Decision
              </button>
            </div>

            {showDecisionForm && (
              <div className="bg-card rounded-xl border border-border p-4 mb-6 space-y-3">
                <input
                  value={newDecision.category}
                  onChange={(e) => setNewDecision((p) => ({ ...p, category: e.target.value }))}
                  placeholder="Category (e.g., Workforce, Infrastructure)"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                />
                <input
                  value={newDecision.title}
                  onChange={(e) => setNewDecision((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Decision title"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                />
                <textarea
                  value={newDecision.description}
                  onChange={(e) => setNewDecision((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Description"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm resize-none"
                />
                <div className="flex items-center gap-3">
                  <select
                    value={newDecision.priority}
                    onChange={(e) =>
                      setNewDecision((p) => ({ ...p, priority: e.target.value as PriorityLevel }))
                    }
                    className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                  <button
                    onClick={addDecision}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                  >
                    Save Decision
                  </button>
                </div>
              </div>
            )}

            {decisions.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No decisions recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {decisions.map((d) => (
                  <div key={d.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-heading font-semibold text-foreground">{d.title}</h3>
                        <span className="text-xs text-muted-foreground">{d.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${priorityColour(d.priority)}`}>
                          {d.priority}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${statusColour(d.status)}`}>
                          {d.status}
                        </span>
                      </div>
                    </div>
                    {d.description && (
                      <p className="text-sm text-muted-foreground mb-3">{d.description}</p>
                    )}
                    {isAdmin && d.status === 'proposed' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateDecisionStatus(d.id, 'approved')}
                          className="text-xs px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateDecisionStatus(d.id, 'deferred')}
                          className="text-xs px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                        >
                          Defer
                        </button>
                        <button
                          onClick={() => updateDecisionStatus(d.id, 'rejected')}
                          className="text-xs px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Chat Tab */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Function selector */}
            <div className="px-4 py-2 border-b border-border bg-muted/50 shrink-0">
              <div className="flex gap-2 max-w-3xl mx-auto">
                {(['question', 'swot_categorisation', 'narrative_summary'] as ChatFunction[]).map(
                  (fn) => (
                    <button
                      key={fn}
                      onClick={() => setChatFunction(fn)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                        chatFunction === fn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {fn === 'question'
                        ? 'Ask Question'
                        : fn === 'swot_categorisation'
                          ? 'SWOT Analysis'
                          : 'Narrative Summary'}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Messages */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4">
              <div className="max-w-3xl mx-auto space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <Bot className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">
                      Select a function and ask the AI assistant to help with your workshop.
                    </p>
                  </div>
                )}
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <Bot className="w-6 h-6 text-primary shrink-0 mt-1" />
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.role === 'assistant' && !msg.content && isChatStreaming && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <User className="w-6 h-6 text-secondary shrink-0 mt-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-border bg-card px-4 py-3 shrink-0">
              <div className="max-w-3xl mx-auto flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  placeholder={
                    chatFunction === 'swot_categorisation'
                      ? 'Paste OCR text or describe items to categorise...'
                      : chatFunction === 'narrative_summary'
                        ? 'Describe what to summarise for the report...'
                        : 'Ask a question about the workshop data...'
                  }
                  rows={1}
                  className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm resize-none"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || isChatStreaming}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {isChatStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report Tab */}
        {activeTab === 'report' && (
          <div className="p-6 max-w-3xl mx-auto">
            <h2 className="font-heading text-xl font-bold text-foreground mb-4">
              Workshop Report
            </h2>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium mb-2">Generate Board Strategy Document</p>
                <p className="text-sm text-muted-foreground mb-6">
                  This will compile all workshop decisions, OCR results, AI analysis, and
                  stakeholder input into a Board-approved strategy document.
                </p>
                <div className="space-y-2 text-sm text-left max-w-sm mx-auto mb-6">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Decisions recorded:</span>
                    <span className="font-medium text-foreground">{decisions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Photos processed:</span>
                    <span className="font-medium text-foreground">{photos.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Approved decisions:</span>
                    <span className="font-medium text-foreground">
                      {decisions.filter((d) => d.status === 'approved').length}
                    </span>
                  </div>
                </div>
                <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
                  Generate PDF Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
