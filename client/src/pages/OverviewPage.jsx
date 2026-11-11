import { BellIcon, DatabaseIcon, GlobeIcon, MonitorIcon, ServerIcon, WifiIcon } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router';
import { SeverityBadge } from '@/features/alerts/components/AlertsTable';
import { useAlerts } from '@/features/alerts/hooks/useAlerts';
import { useMe } from '@/features/auth/hooks/useMe';
import { useDevices } from '@/features/devices/hooks/useDevices';
import { useHealth } from '@/features/health/hooks/useHealth';
import { useInternetStatus } from '@/features/internet/hooks/useInternetStatus';
import { useNetworkDevices } from '@/features/network/hooks/useNetworkDevices';
import { useServices } from '@/features/services/hooks/useServices';
import { formatRelativeTime } from '@/lib/format';

const RECENT_ALERTS = 5;

function CardLink({ to, children }) {
  return (
    <Link
      to={to}
      className="rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-ring [&>*]:hover:border-ring/60"
    >
      {children}
    </Link>
  );
}

function PcsOnlineCard() {
  const { data: devices, isPending, isError } = useDevices();
  const online = devices?.filter((device) => device.status === 'online').length ?? 0;

  return (
    <CardLink to="/devices">
      <StatCard
        title="PCs online"
        icon={MonitorIcon}
        isLoading={isPending}
        value={isError ? '--' : `${online} / ${devices?.length ?? 0}`}
        description={devices?.length === 0 ? 'Add a PC in Devices' : 'Agents connected now'}
      />
    </CardLink>
  );
}

function NetworkCard() {
  const { data, isPending, isError } = useNetworkDevices();
  const devices = data?.devices ?? [];
  const online = devices.filter((device) => device.online).length;
  const unknown = devices.filter((device) => !device.trusted).length;

  return (
    <CardLink to="/network">
      <StatCard
        title="Network devices"
        icon={WifiIcon}
        isLoading={isPending}
        value={isError ? '--' : online}
        description={unknown ? `${unknown} unknown to review` : 'All devices trusted'}
      />
    </CardLink>
  );
}

function OpenAlertsCard() {
  const { data, isPending, isError } = useAlerts('open');
  const critical = data?.alerts.filter((alert) => alert.severity === 'critical').length ?? 0;

  return (
    <CardLink to="/alerts">
      <StatCard
        title="Open alerts"
        icon={BellIcon}
        isLoading={isPending}
        value={isError ? '--' : (data?.openCount ?? 0)}
        description={critical ? `${critical} critical` : 'Nothing critical'}
      />
    </CardLink>
  );
}

function InternetCard() {
  const { data: status, isPending, isError } = useInternetStatus();
  const test = status?.lastSpeedTest?.success ? status.lastSpeedTest : null;

  let description = 'No speed test yet';
  if (status?.online === false) {
    description = `Offline since ${formatRelativeTime(status.since)}`;
  } else if (test) {
    description = `↑ ${test.uploadMbps} Mbps · ${test.pingMs} ms ping`;
  }

  return (
    <CardLink to="/internet">
      <StatCard
        title="Internet download"
        icon={GlobeIcon}
        isLoading={isPending}
        value={isError || !test ? '--' : `${test.downloadMbps} Mbps`}
        description={description}
      />
    </CardLink>
  );
}

function ServicesCard() {
  const { data: services, isPending, isError } = useServices();
  const active = services?.filter((service) => service.enabled) ?? [];
  const down = active.filter((service) => service.status === 'down').length;
  const up = active.filter((service) => service.status === 'up').length;

  return (
    <CardLink to="/services">
      <StatCard
        title="Services up"
        icon={ServerIcon}
        isLoading={isPending}
        value={isError ? '--' : `${up} / ${active.length}`}
        description={
          active.length === 0 ? 'Add a website or service' : down ? `${down} down` : 'All responding'
        }
      />
    </CardLink>
  );
}

function RecentAlerts() {
  const { data, isPending } = useAlerts('open');

  let content;
  if (isPending) {
    content = <Skeleton className="h-24 w-full" />;
  } else if (!data?.alerts.length) {
    content = <p className="text-sm text-muted-foreground">No open alerts. Everything looks fine.</p>;
  } else {
    content = (
      <ul className="flex flex-col divide-y">
        {data.alerts.slice(0, RECENT_ALERTS).map((alert) => (
          <li key={alert.id} className="flex items-start justify-between gap-3 py-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{alert.title}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(alert.createdAt)}</span>
            </div>
            <SeverityBadge severity={alert.severity} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent alerts</CardTitle>
        <CardDescription>
          <Link to="/alerts" className="underline-offset-4 hover:underline">
            See all alerts
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <PcsOnlineCard />
        <NetworkCard />
        <InternetCard />
        <ServicesCard />
        <OpenAlertsCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentAlerts />
        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>Refreshes every 10 seconds</CardDescription>
          </CardHeader>
          <CardContent>
            <SystemStatus />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
