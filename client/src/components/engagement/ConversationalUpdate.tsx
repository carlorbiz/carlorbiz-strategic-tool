import { useState, useRef, useEffect } from 'react';
import { useConversationalUpdate } from '@/hooks/useConversationalUpdate';
import { useVocabulary } from '@/hooks/useVocabulary';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageCircle, Send, Loader2, CheckCircle2, X, AlertTriangle } from 'lucide-react';

const RAG_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  on_track: { label: 'On Track', color: 'text-green-600' },
  at_risk: { label: 'At Risk', color: 'text-amber-500' },
  blocked: { label: 'Blocked', color: 'text-red-600' },
  done: { label: 'Done', color: 'text-blue-600' },
};

export function ConversationalUpdate() {
  const v = useVocabulary();
  const {
    conversationId,
    messages,
    isLoading,
    pendingConfirmation,
    isComplete,
    error,
    startUpdate,
    sendReply,
    confirmUpdate,
    dismissConfirmation,
    reset,
  } = useConversationalUpdate();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    await sendReply(text);
  };

  const handleConfirm = async () => {
    await confirmUpdate();
    toast.success('Update saved');
  };

  // Not started yet — show the CTA
  if (!conversationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Tell Nera what's happening
          </CardTitle>
          <CardDescription>
            Describe a recent decision, milestone, delay, or change. Nera will figure out
            which {v.commitment_top_singular.toLowerCase()} it relates to and capture it as a structured update.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Round icon-button styled to mirror the bottom-right Nera bubble:
              same primary fill, same circular shape, same MessageCircle icon —
              visually signalling "this is Nera, just in update-capture mode" */}
          <Button
            onClick={startUpdate}
            disabled={isLoading}
            size="lg"
            className="rounded-full px-6 gap-2"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
            ) : (
              <><MessageCircle className="w-5 h-5" /> Start update</>
            )}
          </Button>
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded p-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Complete
  if (isComplete) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-600" />
          <p className="font-medium">Update saved</p>
          <p className="text-sm text-muted-foreground mt-1">
            Nera has captured the update and linked it to the relevant {v.commitment_top_singular.toLowerCase()}.
          </p>
          <Button onClick={reset} variant="outline" className="mt-4">
            Record another update
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active conversation
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Update conversation with Nera
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Messages */}
        <div className="max-h-80 overflow-y-auto space-y-3 p-2 border rounded-lg bg-muted/30">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-background border rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Confirmation card */}
        {pendingConfirmation && (
          <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-950/20 space-y-2">
            <p className="text-sm font-medium">Nera understood this as:</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {v.commitment_top_singular}:
                </span>
                <Badge variant="outline">{pendingConfirmation.commitment_title}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <span className={RAG_STATUS_CONFIG[pendingConfirmation.rag_status]?.color ?? ''}>
                  {RAG_STATUS_CONFIG[pendingConfirmation.rag_status]?.label ?? pendingConfirmation.rag_status}
                </span>
              </div>
              <p className="text-muted-foreground">{pendingConfirmation.narrative}</p>
              {pendingConfirmation.scope_extension_detected && (
                <div className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-xs">Scope extension detected</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleConfirm} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <><CheckCircle2 className="w-3 h-3 mr-1" /> Confirm</>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismissConfirmation}
                disabled={isLoading}
              >
                <X className="w-3 h-3 mr-1" /> Not quite — let me clarify
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        {!pendingConfirmation && (
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Describe what happened..."
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
