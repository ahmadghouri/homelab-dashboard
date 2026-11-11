import { BellIcon, DatabaseIcon, GlobeIcon, MonitorIcon, ServerIcon, WifiIcon } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/useMe';
import { useHealth } from '@/features/health/hooks/useHealth';

// Summary cards get real data as each module is built (see PENDING.md).
const SUMMARY_CARDS = [
  { title: 'PCs online', icon: MonitorIcon, description: 'Live data after M2 (agent)' },
  { title: 'Network devices', icon: WifiIcon, description: 'Live data after M3 (scanner)' },
  { title: 'Internet speed', icon: GlobeIcon, description: 'Live data after M5' },
  { title: 'Open alerts', icon: BellIcon, description: 'Live data after M4' },
];

function SystemStatus() {
  const { data, isPending, isError } = useHealth();

  if (isPending) {
    return <Skeleton className="h-16 w-full" />;
  }

  const apiStatus = isError ? 'offline' : 'online';
  const dbStatus = data?.database === 'connected' ? 'online' : 'offline';

  return (
    <ul className="flex flex-col divide-y">
      <li className="flex items-center justify-between gap-2 py-2">
        <span className="flex items-center gap-2 text-sm">
          <ServerIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          API server
        </span>
        <StatusBadge status={apiStatus} />
      </li>
      <li className="flex items-center justify-between gap-2 py-2">
        <span className="flex items-center gap-2 text-sm">
          <DatabaseIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          Database
        </span>
        <StatusBadge status={isError ? 'unknown' : dbStatus} />
      </li>
    </ul>
  );
}

export function OverviewPage() {
  const { data: user } = useMe();

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name}`}
        description="Health of your PCs, network, and services at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <StatCard key={card.title} {...card} value="--" />
        ))}
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>System status</CardTitle>
          <CardDescription>Refreshes every 10 seconds</CardDescription>
        </CardHeader>
        <CardContent>
          <SystemStatus />
        </CardContent>
      </Card>
    </>
  );
}
