import { useRef, useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ChatMessage } from '../chat/ChatMessage';
import { ChatInput } from '../chat/ChatInput';
import { ChatMessage as ChatMessageType } from '@/types/chat';

interface FeedbackChatProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  isStreaming: boolean;
  onSend: (message: string) => void;
  onQuickSubmit: () => Promise<void>;
  showQuickSubmit: boolean;
  campaignTitle: string;
}

export function FeedbackChat({
  messages,
  isLoading,
  isStreaming,
  onSend,
  onQuickSubmit,
  showQuickSubmit,
  campaignTitle,
}: FeedbackChatProps) {
  const [submitting, setSubmitting] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? 'auto' : 'smooth',
    });
  }, [messages, isLoading, isStreaming]);

  // Build the resources URL from the current origin (same domain)
  const resourcesUrl = window.location.origin;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <img src="/logo.png" alt="Logo" className="h-8" />
        <div className="flex-1">
          <h1 className="text-sm font-semibold">{campaignTitle}</h1>
          <p className="text-xs text-muted-foreground">
            Feedback conversation with Nera
          </p>
        </div>
        <button
          onClick={() => setResourcesOpen(true)}
          className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[var(--color-brand-accent)]/30 bg-[var(--color-brand-accent)]/5 text-[var(--color-brand-accent)] hover:bg-[var(--color-brand-accent)]/10 transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Browse Resources
        </button>
        {showQuickSubmit && (
          <button
            onClick={async () => {
              setSubmitting(true);
              await onQuickSubmit();
            }}
            disabled={submitting || isLoading || isStreaming}
            className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            title="Save your feedback so far and exit — nothing will be lost"
          >
            {submitting ? 'Saving...' : 'Quick Submit'}
          </button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-2xl mx-auto space-y-4 p-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && !isStreaming && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse flex gap-1">
                    <div
                      className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Just a moment — putting that together for you.
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="max-w-2xl mx-auto w-full">
        <ChatInput
          onSend={onSend}
          isLoading={isLoading || isStreaming}
          placeholder="Type your response..."
        />
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 text-center">
        <p className="text-xs text-muted-foreground">
          This conversation is anonymous. Your feedback shapes better resources.
        </p>
      </div>

      {/* Resource Browser Panel */}
      <Sheet open={resourcesOpen} onOpenChange={setResourcesOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl p-0"
        >
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>Browse Resources</SheetTitle>
            <SheetDescription>
              Explore the handbook and resources while you chat with Nera.
              Close this panel to return to your conversation.
            </SheetDescription>
          </SheetHeader>
          <iframe
            src={resourcesUrl}
            className="flex-1 w-full border-t"
            title="Resource Hub"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
