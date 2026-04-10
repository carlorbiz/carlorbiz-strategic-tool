import React, { createContext, useContext, useState, useCallback } from 'react';
import { ChatMessage, ChatContextType, TriageOption } from '@/types/chat';
import { queryNeraStreaming, transformSources, submitNeraFeedback } from '@/lib/neraApi';
import { useAuth } from './AuthContext';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

function generateId(): string {
  return crypto.randomUUID();
}

function generateSessionId(): string {
  const stored = sessionStorage.getItem('nera_session_id');
  if (stored) return stored;

  const newId = generateId();
  sessionStorage.setItem('nera_session_id', newId);
  return newId;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const { user } = useAuth();

  const processQuery = useCallback(async (queryText: string, _displayText: string) => {
    setIsLoading(true);
    setIsStreaming(false);

    const assistantMsgId = generateId();
    let messageCreated = false;

    try {
      await queryNeraStreaming(
        queryText,
        sessionId,
        {
          onMeta: (meta) => {
            if (meta.type === 'clarification') {
              // Clarification: full message arrives immediately (not streamed)
              const msg: ChatMessage = {
                id: assistantMsgId,
                role: 'assistant',
                content: meta.answer || '',
                timestamp: new Date(),
                responseType: 'clarification',
                options: meta.options,
                queryId: meta.query_id,
              };
              setMessages(prev => [...prev, msg]);
              messageCreated = true;
              setIsLoading(false);
            } else {
              // Answer: create shell message, deltas will fill content
              const msg: ChatMessage = {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                sources: meta.sources?.length ? transformSources(meta.sources) : undefined,
                timestamp: new Date(),
                responseType: 'answer',
                queryId: meta.query_id,
              };
              setMessages(prev => [...prev, msg]);
              messageCreated = true;
              setIsLoading(false);
              setIsStreaming(true);
            }
          },
          onDelta: (text) => {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMsgId
                  ? { ...msg, content: msg.content + text }
                  : msg
              )
            );
          },
          onDone: () => {
            setIsStreaming(false);
          },
          onError: (errorMsg) => {
            if (!messageCreated) {
              const errorMessage: ChatMessage = {
                id: assistantMsgId,
                role: 'assistant',
                content: `Sorry, I encountered an error: ${errorMsg}. Please try again.`,
                timestamp: new Date(),
                responseType: 'answer',
              };
              setMessages(prev => [...prev, errorMessage]);
            }
            setIsLoading(false);
            setIsStreaming(false);
          },
        },
        user?.id
      );
    } catch {
      if (!messageCreated) {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again later.',
          timestamp: new Date(),
          responseType: 'answer',
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [sessionId, user]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || isStreaming) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    await processQuery(text, text);
  }, [isLoading, isStreaming, processQuery]);

  // Triage option selection — displays the label but sends the value
  const selectOption = useCallback(async (option: TriageOption) => {
    if (isLoading || isStreaming) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: option.label,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    await processQuery(option.value, option.label);
  }, [isLoading, isStreaming, processQuery]);

  const submitFeedback = useCallback(async (messageId: string, score: -1 | 1) => {
    const message = messages.find(m => m.id === messageId);

    // Optimistically update UI
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, feedbackScore: score }
          : msg
      )
    );

    // Submit feedback to nera_queries table via Edge Function
    if (message?.queryId) {
      await submitNeraFeedback(message.queryId, score, user?.id);
    }
  }, [messages, user]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    sessionStorage.removeItem('nera_session_id');
    window.location.reload();
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoading,
        isStreaming,
        sessionId,
        sendMessage,
        selectOption,
        submitFeedback,
        clearHistory,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
