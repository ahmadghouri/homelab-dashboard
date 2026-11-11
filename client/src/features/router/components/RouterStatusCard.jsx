import { CableIcon } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDuration, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

function Stat({ label, value }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums" title={String(value)}>
        {value}
      </dd>
    </div>
  );
}

function WanLines({ wans }) {
  if (!wans?.length) {
    return <p className="text-sm text-muted-foreground">No default route found on the router.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {wans.map((wan) => (
        <li
          key={`${wan.name}-${wan.gateway ?? ''}`}
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2',
            wan.active && 'border-success/50 bg-success/5',
          )}
        >
          <CableIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-mono text-sm">{wan.name}</span>
            {wan.gateway && (
              <span className="truncate text-xs text-muted-foreground">
                Gateway {wan.gateway}
                {wan.distance != null ? ` · distance ${wan.distance}` : ''}
              </span>
            )}
          </span>
          <StatusBadge status={wan.running ? 'up' : 'down'} />
          {wan.active ? (
            <Badge className="bg-success/15 text-success">In use</Badge>
          ) : (
            <Badge variant="secondary">Backup</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

// status: the GET /api/router/status answer for a configured router.
export function RouterStatusCard({ status }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="truncate">{status.identity || 'Router'}</CardTitle>
          <CardDescription>MikroTik RouterOS{status.version ? ` ${status.version}` : ''}</CardDescription>
        </div>
        <StatusBadge status={status.reachable ? 'online' : 'offline'}>
          {status.reachable ? 'Connected' : 'Not reachable'}
        </StatusBadge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!status.reachable && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {status.error || 'The router did not answer.'} Check ROUTER_URL and the router user in server/.env.
          </p>
        )}
        {status.reachable && (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Uptime" value={formatDuration(status.uptimeSec)} />
              <Stat label="CPU load" value={formatPercent(status.cpuLoad)} />
              <Stat label="Internet lines" value={status.wans?.length ?? 0} />
            </dl>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Internet lines (WAN)</h3>
              <WanLines wans={status.wans} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
