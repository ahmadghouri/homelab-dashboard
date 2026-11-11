import { SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { DEVICE_KINDS, KIND_LABELS } from './deviceKind';
import { KIND_STYLES } from './kindStyles';

// Search (highlights matches), "Online only", and one toggle chip per device kind with its count.
// The chips double as the color legend for kinds.
export function TopologyToolbar({ search, onSearchChange, onlineOnly, onOnlineOnlyChange, kindCounts, hiddenKinds, onToggleKind, matchCount }) {
  const kinds = DEVICE_KINDS.filter((kind) => kindCounts[kind] > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative w-full sm:w-72">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Highlight name, IP, MAC, vendor"
              aria-label="Highlight devices"
              className="pl-8"
            />
          </div>
          {matchCount !== null && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {matchCount === 1 ? '1 match' : `${matchCount} matches`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch id="topology-online-only" checked={onlineOnly} onCheckedChange={onOnlineOnlyChange} />
          <Label htmlFor="topology-online-only">Online only</Label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show device kinds">
        {kinds.map((kind) => {
          const { Icon, color } = KIND_STYLES[kind];
          const shown = !hiddenKinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={shown}
              onClick={() => onToggleKind(kind)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                shown ? 'bg-muted text-foreground' : 'border-dashed text-muted-foreground opacity-70 hover:opacity-100',
              )}
            >
              <Icon className="size-3.5" style={{ color: shown ? color : undefined }} aria-hidden="true" />
              {KIND_LABELS[kind]}
              <span className="tabular-nums text-muted-foreground">{kindCounts[kind]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
