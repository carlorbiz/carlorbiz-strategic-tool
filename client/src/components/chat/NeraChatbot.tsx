import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Trash2, LogIn, Maximize2, Minimize2 } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';

export function NeraChatbot() {
  const { messages, isLoading, isStreaming, sendMessage, selectOption, submitFeedback, clearHistory } = useChat();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const isMobile = useMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
  }, [messages, isLoading, isStreaming]);

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
              : 'sm:max-w-[450px]'
        )}
      >
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              N
            </div>
            <div>
              <SheetTitle className="text-left">Nera</SheetTitle>
              <p className="text-xs text-muted-foreground">Your AI Knowledge Assistant</p>
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
          {/* Messages area */}
          <ScrollArea className="flex-1 min-h-0 py-4">
            <div className={cn(
              'space-y-4 px-1',
              isExpanded && 'max-w-3xl mx-auto'
            )}>
              {messages.length === 0 && isAuthenticated && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Ask me anything about the content.</p>
                  <p className="text-xs mt-2">I can help you find information and answer questions.</p>
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

              {/* Scroll anchor */}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input area or login prompt */}
          {authLoading ? (
            <div className="p-4 border-t text-center text-muted-foreground">
              Loading...
            </div>
          ) : isAuthenticated ? (
            <div className={cn(isExpanded && 'max-w-3xl mx-auto w-full')}>
              <ChatInput
                onSend={sendMessage}
                isLoading={isLoading || isStreaming}
              />
            </div>
          ) : (
            <div className="p-4 border-t space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Please log in to chat with Nera
              </p>
              <Button
                className="w-full"
                onClick={() => setLocation('/login')}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Login to Continue
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
