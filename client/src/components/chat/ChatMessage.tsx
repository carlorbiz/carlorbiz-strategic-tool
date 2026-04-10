import { ChatMessage as ChatMessageType } from '@/types/chat';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FeedbackButtons } from './FeedbackButtons';
import { TriageOptions } from './TriageOptions';

interface ChatMessageProps {
  message: ChatMessageType;
  onFeedback?: (score: -1 | 1) => void;
  isLatest?: boolean;
}

export function ChatMessage({ message, onFeedback, isLatest = false }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] space-y-2', isUser ? 'items-end' : 'items-start')}>
        <Card
          className={cn(
            'px-4 py-3',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          )}
        >
          {isUser ? (
            <p className="text-sm">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full text-sm border-collapse border border-border">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border bg-muted/50 px-3 py-1.5 text-left font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-3 py-1.5">
                      {children}
                    </td>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 mb-1 px-4 py-2 rounded-md bg-primary text-primary-foreground no-underline text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Triage options — only on the latest clarification message */}
          {message.responseType === 'clarification' && message.options && isLatest && (
            <TriageOptions options={message.options} />
          )}
        </Card>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.sources.map((source, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {source.title}
              </Badge>
            ))}
          </div>
        )}

        {/* Feedback buttons — only on answer messages, not clarifications */}
        {!isUser && message.responseType !== 'clarification' && onFeedback && (
          <FeedbackButtons
            currentScore={message.feedbackScore}
            onFeedback={onFeedback}
          />
        )}

        {/* Timestamp */}
        <p className={cn('text-xs text-muted-foreground px-1', isUser ? 'text-right' : 'text-left')}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
