import { useState } from 'react';
import { subDays, startOfDay, format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange as RDPDateRange } from 'react-day-picker';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESETS = [
  { label: 'All time', days: null },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
] as const;

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [customOpen, setCustomOpen] = useState(false);

  const activePreset = PRESETS.find((p) => {
    if (p.days === null) return value.from === null && value.to === null;
    if (!value.from) return false;
    const expected = startOfDay(subDays(new Date(), p.days));
    return Math.abs(value.from.getTime() - expected.getTime()) < 86400000 && value.to === null;
  });

  const handlePreset = (days: number | null) => {
    if (days === null) {
      onChange({ from: null, to: null });
    } else {
      onChange({ from: startOfDay(subDays(new Date(), days)), to: null });
    }
  };

  const label = activePreset
    ? activePreset.label
    : value.from
      ? `${format(value.from, 'd MMM yyyy')}${value.to ? ` – ${format(value.to, 'd MMM yyyy')}` : ' – now'}`
      : 'All time';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESETS.map((preset) => (
        <Button
          key={preset.label}
          variant={activePreset?.label === preset.label ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => handlePreset(preset.days)}
        >
          {preset.label}
        </Button>
      ))}
      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={!activePreset && value.from ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
          >
            <CalendarIcon className="h-3 w-3 mr-1" />
            {!activePreset && value.from ? label : 'Custom'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={
              value.from
                ? { from: value.from, to: value.to ?? undefined }
                : undefined
            }
            onSelect={(range: RDPDateRange | undefined) => {
              if (range?.from) {
                onChange({ from: startOfDay(range.from), to: range.to ? startOfDay(range.to) : null });
                if (range.to) setCustomOpen(false);
              }
            }}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
