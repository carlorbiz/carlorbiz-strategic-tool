import { Button } from '@/components/ui/button';
import { TriageOption } from '@/types/chat';
import { useChat } from '@/contexts/ChatContext';

interface TriageOptionsProps {
  options: TriageOption[];
  disabled?: boolean;
}

export function TriageOptions({ options, disabled = false }: TriageOptionsProps) {
  const { selectOption, isLoading } = useChat();

  return (
    <div className="flex flex-col gap-2 mt-3">
      {options.map((option, index) => (
        <Button
          key={index}
          variant="outline"
          className="justify-start text-left h-auto py-2 px-3 whitespace-normal text-sm"
          disabled={disabled || isLoading}
          onClick={() => selectOption(option)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
