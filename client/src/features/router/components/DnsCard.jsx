import { ShieldCheckIcon, ShieldOffIcon } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatPercent } from '@/lib/format';
import { useSetDnsProtection } from '../hooks/useDnsStatus';

const numberFormat = new Intl.NumberFormat();

function Stat({ label, value }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function TopList({ title, items, labelKey, emptyText }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {items?.length ? (
        <ol className="flex flex-col divide-y text-sm">
          {items.map((item) => (
            <li key={item[labelKey]} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate font-mono text-xs" title={item[labelKey]}>
                {item[labelKey]}
              </span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{numberFormat.format(item.count)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

function ProtectionSwitch({ enabled, isAdmin }) {
  const setProtection = useSetDnsProtection();

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="dns-protection"
        checked={enabled}
        disabled={!isAdmin || setProtection.isPending}
        onCheckedChange={(next) =>
          setProtection.mutate(next, {
            onSuccess: () => toast.success(next ? 'Ad blocking turned on' : 'Ad blocking paused'),
            onError: (error) => toast.error(error.message),
          })
        }
      />
      <Label htmlFor="dns-protection" className="flex items-center gap-1.5">
        {enabled ? (
          <ShieldCheckIcon className="size-4 text-success" aria-hidden="true" />
        ) : (
          <ShieldOffIcon className="size-4 text-warning" aria-hidden="true" />
        )}
        {enabled ? 'Protection on' : 'Protection off'}
      </Label>
    </div>
  );
}

// status: the GET /api/dns/status answer for a configured AdGuard Home.
export function DnsCard({ status, isAdmin }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>DNS ad blocking</CardTitle>
          <CardDescription>AdGuard Home{status.version ? ` ${status.version}` : ''}</CardDescription>
        </div>
        {status.reachable ? (
          <ProtectionSwitch enabled={Boolean(status.protectionEnabled)} isAdmin={isAdmin} />
        ) : (
          <StatusBadge status="offline">Not reachable</StatusBadge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!status.reachable ? (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {status.error || 'AdGuard Home did not answer.'} Check ADGUARD_URL and the login in server/.env.
          </p>
        ) : (
          <>
            {!isAdmin && <p className="text-xs text-muted-foreground">Only admins can turn protection on or off.</p>}
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Queries" value={numberFormat.format(status.queries ?? 0)} />
              <Stat label="Blocked" value={numberFormat.format(status.blocked ?? 0)} />
              <Stat label="Blocked share" value={formatPercent(status.blockedPct, 1)} />
              <Stat label="Avg. answer time" value={`${(status.avgProcessingMs ?? 0).toFixed(1)} ms`} />
            </dl>
            <div className="grid gap-5 md:grid-cols-2">
              <TopList
                title="Top blocked domains"
                items={status.topBlocked}
                labelKey="domain"
                emptyText="Nothing blocked yet."
              />
              <TopList title="Top clients" items={status.topClients} labelKey="client" emptyText="No queries yet." />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
