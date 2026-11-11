import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/format';
import { usageLevel } from '@/lib/usage';

const INDICATOR_BY_LEVEL = {
  ok: '[&>[data-slot=progress-indicator]]:bg-success',
  warning: '[&>[data-slot=progress-indicator]]:bg-warning',
  critical: '[&>[data-slot=progress-indicator]]:bg-danger',
};

// A labelled percentage bar that turns amber at 75% and red at 90%.
export function UsageBar({ label, value, detail, className }) {
  const hasValue = typeof value === 'number';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {formatPercent(value)}
          {detail && <span className="ml-1 text-xs font-normal text-muted-foreground">{detail}</span>}
        </span>
      </div>
      <Progress
        value={hasValue ? value : 0}
        aria-label={`${label} ${formatPercent(value)}`}
        className={cn('h-2', hasValue && INDICATOR_BY_LEVEL[usageLevel(value)])}
      />
    </div>
  );
}
