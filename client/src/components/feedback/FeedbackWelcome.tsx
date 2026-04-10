import { Button } from '@/components/ui/button';

interface FeedbackWelcomeProps {
  title: string;
  description: string | null;
  welcomeMessage: string | null;
  onStart: () => void;
}

export function FeedbackWelcome({
  title,
  description,
  welcomeMessage,
  onStart,
}: FeedbackWelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background">
      <div className="max-w-lg w-full space-y-8 text-center">
        <img
          src="/logo.png"
          alt="Logo"
          className="h-12 mx-auto"
        />

        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>

        {welcomeMessage && (
          <div className="bg-muted rounded-lg p-4 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                N
              </div>
              <p className="text-sm leading-relaxed">{welcomeMessage}</p>
            </div>
          </div>
        )}

        <Button onClick={onStart} size="lg" className="w-full sm:w-auto px-8">
          Start Conversation
        </Button>

        <p className="text-xs text-muted-foreground">
          This conversation is anonymous. Your feedback shapes better resources.
        </p>
      </div>
    </div>
  );
}
