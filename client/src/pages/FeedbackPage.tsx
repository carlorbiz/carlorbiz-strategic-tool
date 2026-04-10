import { useState, useEffect, useCallback, useRef } from 'react';
import { useRoute } from 'wouter';
import { ChatMessage } from '@/types/chat';
import { FeedbackWelcome } from '@/components/feedback/FeedbackWelcome';
import { FeedbackChat } from '@/components/feedback/FeedbackChat';
import {
  loadCampaignBySlug,
  createFeedbackSession,
  sendFeedbackMessage,
  quickSubmitSession,
  FeedbackCampaign,
  ConversationMessage,
} from '@/lib/feedbackApi';

const STORAGE_KEY_PREFIX = 'feedback_session_';

function generateId(): string {
  return crypto.randomUUID();
}

function stripJsonBlock(text: string): string {
  return text.replace(/```json[\s\S]*?```/g, '').trim();
}

export default function FeedbackPage() {
  const [, params] = useRoute('/feedback/:campaignSlug');
  const campaignSlug = params?.campaignSlug || '';

  const [campaign, setCampaign] = useState<FeedbackCampaign | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Track streamed text for JSON extraction
  const fullTextRef = useRef('');

  // Load campaign on mount
  useEffect(() => {
    if (!campaignSlug) return;

    (async () => {
      const data = await loadCampaignBySlug(campaignSlug);
      setCampaign(data);
      setPageLoading(false);

      // Check localStorage for existing session
      if (data) {
        const stored = localStorage.getItem(STORAGE_KEY_PREFIX + data.id);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setSessionId(parsed.sessionId);
            setSessionToken(parsed.sessionToken);
            setConversationHistory(parsed.conversationHistory || []);

            // Restore messages from conversation history
            const restored: ChatMessage[] = [];
            if (data.welcome_message) {
              restored.push({
                id: 'welcome',
                role: 'assistant',
                content: data.welcome_message,
                timestamp: new Date(parsed.startedAt || Date.now()),
              });
            }
            for (const turn of parsed.conversationHistory || []) {
              restored.push({
                id: generateId(),
                role: turn.role,
                content: turn.content,
                timestamp: new Date(turn.timestamp),
              });
            }
            setMessages(restored);
            setStarted(true);
          } catch {
            localStorage.removeItem(STORAGE_KEY_PREFIX + data.id);
          }
        }
      }
    })();
  }, [campaignSlug]);

  // Persist session to localStorage after each exchange
  useEffect(() => {
    if (!campaign || !sessionId || !sessionToken) return;
    localStorage.setItem(
      STORAGE_KEY_PREFIX + campaign.id,
      JSON.stringify({
        sessionId,
        sessionToken,
        conversationHistory,
        startedAt: new Date().toISOString(),
      })
    );
  }, [campaign, sessionId, sessionToken, conversationHistory]);

  const handleStart = useCallback(async () => {
    if (!campaign) return;

    const session = await createFeedbackSession(campaign.id);
    if (!session) {
      setError('Failed to start session. Please try again.');
      return;
    }

    setSessionId(session.id);
    setSessionToken(session.session_token);
    setStarted(true);

    // Show welcome message as static display
    if (campaign.welcome_message) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: campaign.welcome_message,
          timestamp: new Date(),
        },
      ]);
    }
  }, [campaign]);

  const handleSend = useCallback(
    async (text: string) => {
      if (
        !text.trim() ||
        !campaign ||
        !sessionId ||
        !sessionToken ||
        isLoading ||
        isStreaming
      )
        return;

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const assistantMsgId = generateId();
      fullTextRef.current = '';

      await sendFeedbackMessage(
        {
          campaign_id: campaign.id,
          session_id: sessionId,
          session_token: sessionToken,
          message: text,
          conversation_history: conversationHistory,
        },
        {
          onMeta: () => {
            setIsLoading(false);
            setIsStreaming(true);
            // Create shell message
            setMessages((prev) => [
              ...prev,
              {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
              },
            ]);
          },
          onDelta: (deltaText) => {
            fullTextRef.current += deltaText;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + deltaText }
                  : m
              )
            );
          },
          onDone: (hasJson) => {
            setIsLoading(false);
            setIsStreaming(false);

            const displayContent = hasJson
              ? stripJsonBlock(fullTextRef.current)
              : fullTextRef.current;

            // Strip JSON from displayed message if present
            if (hasJson) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: displayContent }
                    : m
                )
              );

              // JSON extraction means the session is complete — clean up localStorage
              if (campaign) {
                localStorage.removeItem(STORAGE_KEY_PREFIX + campaign.id);
              }
              setSubmitted(true);
            }

            // Update conversation history
            setConversationHistory((prev) => [
              ...prev,
              {
                role: 'user',
                content: text,
                timestamp: new Date().toISOString(),
              },
              {
                role: 'assistant',
                content: displayContent,
                timestamp: new Date().toISOString(),
              },
            ]);
          },
          onError: (errorMsg) => {
            setIsLoading(false);
            setIsStreaming(false);
            setMessages((prev) => [
              ...prev,
              {
                id: assistantMsgId,
                role: 'assistant',
                content: `Sorry, I encountered an error: ${errorMsg}. Please try again.`,
                timestamp: new Date(),
              },
            ]);
          },
        }
      );
    },
    [campaign, sessionId, sessionToken, conversationHistory, isLoading, isStreaming]
  );

  const handleQuickSubmit = useCallback(async () => {
    if (!campaign || !sessionId || !sessionToken) return;

    await quickSubmitSession(sessionId, sessionToken);
    localStorage.removeItem(STORAGE_KEY_PREFIX + campaign.id);
    setSubmitted(true);
  }, [campaign, sessionId, sessionToken]);

  // Loading state
  if (pageLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Campaign not found
  if (!campaign) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold">Campaign Not Found</h1>
        <p className="text-muted-foreground">
          This feedback campaign doesn't exist or is no longer active.
        </p>
      </div>
    );
  }

  // Campaign closed
  if (campaign.status !== 'active') {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center space-y-4">
        <img src="/logo.png" alt="Logo" className="h-12" />
        <h1 className="text-xl font-semibold">{campaign.title}</h1>
        <p className="text-muted-foreground">
          This feedback campaign has closed. Thank you for your interest.
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  // Submitted — thank you screen
  if (submitted) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center space-y-4">
        <img src="/logo.png" alt="Logo" className="h-12" />
        <h1 className="text-xl font-semibold">Thank you!</h1>
        <p className="text-muted-foreground max-w-md">
          Your feedback has been saved. Every bit of input — even a short
          conversation — helps us build better resources.
        </p>
        <p className="text-sm text-muted-foreground">
          You're welcome to visit this link again anytime to share more
          thoughts.
        </p>
      </div>
    );
  }

  // Welcome screen or chat
  if (!started) {
    return (
      <FeedbackWelcome
        title={campaign.title}
        description={campaign.description}
        welcomeMessage={campaign.welcome_message}
        onStart={handleStart}
      />
    );
  }

  return (
    <FeedbackChat
      messages={messages}
      isLoading={isLoading}
      isStreaming={isStreaming}
      onSend={handleSend}
      onQuickSubmit={handleQuickSubmit}
      showQuickSubmit={conversationHistory.length >= 2}
      campaignTitle={campaign.title}
    />
  );
}
