// Engagement-scoped chat state for strategic-tool. Mounted *inside*
// EngagementProvider so it always knows which engagement the chat belongs to.
//
// Kept separate from ChatContext (which serves the carlorbiz-website Nera) so
// the website's chat behaviour is not affected by engagement-only changes.

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useEngagement } from './EngagementContext';
import {
  queryStNeraStreaming,
  submitStNeraFeedback,
  transformStSources,
} from '@/lib/stNeraApi';
import type { ChatMessage, ChatSource } from '@/types/chat';

interface StrategicChatContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  sessionId: string;
  /** Is the bottom-right Nera sheet open? Controlled so sample-question chips
   *  can pop it open programmatically. */
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  sendMessage: (text: string) => Promise<void>;
  /** Convenience: opens the sheet and sends the message in one go. Used by
   *  the "Try asking Nera" sample-question chips on the dashboard. */
  askNera: (text: string) => Promise<void>;
  submitFeedback: (messageId: string, score: -1 | 1) => Promise<void>;
  clearHistory: () => void;
}

const StrategicChatContext = createContext<StrategicChatContextType | undefined>(undefined);

function generateId(): string {
  return crypto.randomUUID();
}

function sessionStorageKey(engagementId: string): string {
  return `st_nera_session_${engagementId}`;
}

function getOrCreateSessionId(engagementId: string): string {
  const key = sessionStorageKey(engagementId);
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const fresh = generateId();
  sessionStorage.setItem(key, fresh);
  return fresh;
}

export function StrategicChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { engagement } = useEngagement();
  const engagementId = engagement?.id ?? '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() =>
    engagementId ? getOrCreateSessionId(engagementId) : generateId(),
  );

  // When the engagement changes (e.g. user navigates to a different engagement
  // without unmounting), reset the chat so cross-engagement context can't leak.
  React.useEffect(() => {
    if (!engagementId) return;
    setMessages([]);
    setSessionId(getOrCreateSessionId(engagementId));
  }, [engagementId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || isStreaming || !engagementId) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsLoading(true);
    setIsStreaming(false);

    const assistantMsgId = generateId();
    let messageCreated = false;

    try {
      await queryStNeraStreaming(engagementId, text, sessionId, {
        onMeta: (meta) => {
          const sources: ChatSource[] | undefined = meta.sources?.length
            ? transformStSources(meta.sources)
            : undefined;
          const msg: ChatMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            sources,
            timestamp: new Date(),
            responseType: 'answer',
            queryId: meta.query_id,
          };
          setMessages((prev) => [...prev, msg]);
          messageCreated = true;
          setIsLoading(false);
          setIsStreaming(true);
        },
        onDelta: (text) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: msg.content + text }
                : msg,
            ),
          );
        },
        onDone: () => {
          setIsStreaming(false);
        },
        onError: (errMsg) => {
          if (!messageCreated) {
            const errorMessage: ChatMessage = {
              id: assistantMsgId,
              role: 'assistant',
              content: `Sorry, I encountered an error: ${errMsg}. Please try again.`,
              timestamp: new Date(),
              responseType: 'answer',
            };
            setMessages((prev) => [...prev, errorMessage]);
          }
          setIsLoading(false);
          setIsStreaming(false);
        },
      });
    } catch (err) {
      if (!messageCreated) {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again later.',
          timestamp: new Date(),
          responseType: 'answer',
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
      console.error('StrategicChat: sendMessage failed', err);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [engagementId, sessionId, isLoading, isStreaming]);

  const submitFeedback = useCallback(async (messageId: string, score: -1 | 1) => {
    const message = messages.find((m) => m.id === messageId);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, feedbackScore: score } : msg,
      ),
    );
    if (message?.queryId) {
      try {
        await submitStNeraFeedback(message.queryId, score);
      } catch (err) {
        console.error('StrategicChat: submitFeedback failed', err);
      }
    }
  }, [messages]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    if (engagementId) {
      sessionStorage.removeItem(sessionStorageKey(engagementId));
      setSessionId(getOrCreateSessionId(engagementId));
    }
  }, [engagementId]);

  // Open the Nera sheet and dispatch a question in one go — used by the
  // "Try asking Nera" sample chips on the dashboard.
  const askNera = useCallback(async (text: string) => {
    setOpen(true);
    // Tiny delay so the sheet starts animating in before the streaming begins.
    setTimeout(() => { void sendMessage(text); }, 100);
  }, [sendMessage]);

  // Suppress unused-var warning for user; kept in deps so if auth changes the
  // provider can re-evaluate (the api layer reads the session token directly).
  void user;

  return (
    <StrategicChatContext.Provider
      value={{
        messages,
        isLoading,
        isStreaming,
        sessionId,
        isOpen,
        setOpen,
        sendMessage,
        askNera,
        submitFeedback,
        clearHistory,
      }}
    >
      {children}
    </StrategicChatContext.Provider>
  );
}

export function useStrategicChat(): StrategicChatContextType {
  const ctx = useContext(StrategicChatContext);
  if (!ctx) {
    throw new Error('useStrategicChat must be used within a StrategicChatProvider');
  }
  return ctx;
}
