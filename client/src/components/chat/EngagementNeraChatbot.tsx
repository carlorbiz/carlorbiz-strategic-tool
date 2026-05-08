// Engagement-scoped Nera chatbot. Renders only inside an EngagementProvider +
// StrategicChatProvider. Every message it sends is bound to the active
// engagement_id, and retrieval is server-side scoped to that engagement's
// document corpus.

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { useStrategicChat } from '@/contexts/StrategicChatContext';
import { useEngagement } from '@/contexts/EngagementContext';
import { useVocabulary } from '@/hooks/useVocabulary';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';

export function EngagementNeraChatbot() {
  const { messages, isLoading, isStreaming, sendMessage, submitFeedback, clearHistory } =
    useStrategicChat();
  const { engagement } = useEngagement();
  const v = useVocabulary();
  const isMobile = useMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
  }, [messages, isLoading, isStreaming]);

  if (!engagement) return null;

  const placeholder = `Ask about ${engagement.name}'s ${v.evidence_plural.toLowerCase()} or ${v.commitment_top_plural.toLowerCase()}...`;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isMobile && !isExpanded ? 'bottom' : 'right'}
        className={cn(
          'transition-all duration-300',
          isExpanded
            ? 'w-full sm:max-w-full h-full'
            : isMobile
              ? 'h-[85vh]'
              : 'sm:max-w-[450px]',
        )}
      >
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              N
            </div>
            <div>
              <SheetTitle className="text-left">Nera</SheetTitle>
              <p className="text-xs text-muted-foreground">
                {engagement.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8"
              title={isExpanded ? 'Minimise' : 'Expand'}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearHistory}
                className="h-8 w-8"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0 py-4">
            <div className={cn('space-y-4 px-1', isExpanded && 'max-w-3xl mx-auto')}>
              {messages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">
                    Ask Nera about this engagement.
                  </p>
                  <p className="text-xs mt-2">
                    Nera answers from the {v.evidence_plural.toLowerCase()} and {v.commitment_top_plural.toLowerCase()} for <strong>{engagement.name}</strong> only — nothing leaks across engagements.
                  </p>
                </div>
              )}

              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLatest={index === messages.length - 1}
                  onFeedback={
                    message.role === 'assistant'
                      ? (score) => submitFeedback(message.id, score)
                      : undefined
                  }
                />
              ))}

              {isLoading && !isStreaming && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse flex gap-1">
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-muted-foreground">Just a moment — working on that for you.</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className={cn(isExpanded && 'max-w-3xl mx-auto w-full')}>
            <ChatInput
              onSend={sendMessage}
              isLoading={isLoading || isStreaming}
              placeholder={placeholder}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
