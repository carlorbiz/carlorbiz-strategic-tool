import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackButtonsProps {
  currentScore?: -1 | 0 | 1;
  onFeedback: (score: -1 | 1) => void;
}

export function FeedbackButtons({ currentScore, onFeedback }: FeedbackButtonsProps) {
  return (
    <div className="flex items-center gap-1 px-1">
      <span className="text-xs text-muted-foreground mr-1">Helpful?</span>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6',
          currentScore === 1 && 'text-green-600 bg-green-100'
        )}
        onClick={() => onFeedback(1)}
        disabled={currentScore !== undefined}
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6',
          currentScore === -1 && 'text-red-600 bg-red-100'
        )}
        onClick={() => onFeedback(-1)}
        disabled={currentScore !== undefined}
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
    </div>
  );
}
