import { HourglassIcon, MonitorIcon, MonitorOffIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/useMe';
import { isAdmin } from '@/features/auth/utils';
import { useDevices } from '@/features/devices/hooks/useDevices';
import { ConnectionsSummary } from '@/features/multilink/components/ConnectionsSummary';
import { LinesGrid } from '@/features/multilink/components/LinesGrid';
import { ModeCard } from '@/features/multilink/components/ModeCard';
import { MultiLinkOffCard } from '@/features/multilink/components/MultiLinkOffCard';
import { ProxySetupGuide } from '@/features/multilink/components/ProxySetupGuide';
import { ThroughputChart } from '@/features/multilink/components/ThroughputChart';
import { useMultiLink } from '@/features/multilink/hooks/useMultiLink';
import { formatRelativeTime } from '@/lib/format';

const TITLE = 'Multi-Link';
const DESCRIPTION = 'Use several internet lines on one PC at the same time.';

function DeviceSelect({ devices, value, onChange }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <Label htmlFor="multilink-device" className="shrink-0">
        PC
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="multilink-device" className="w-full sm:w-56">
          <SelectValue placeholder="Choose a PC" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device) => (
            <SelectItem key={device.id} value={device.id}>
              {device.name}
              {device.status !== 'online' && ' (offline)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LoadingCards() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </>
  );
}

function OfflineBanner({ deviceName, at }) {
  return (
    <div role="status" className="flex gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
      <MonitorOffIcon className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <p className="font-medium">{deviceName} is offline</p>
        <p className="text-muted-foreground">
          This is the last known state, from {formatRelativeTime(at)}. Speed tests and usage resets come back when the
          agent reconnects. Settings you save now are sent to the PC then.
        </p>
      </div>
    </div>
  );
}

function MultiLinkContent({ device }) {
  const { data: user } = useMe();
  const { data, isPending, isError, error, refetch, isRefetching } = useMultiLink(device.id);
  const admin = isAdmin(user);

  if (isPending) {
    return <LoadingCards />;
  }
  if (isError) {
    return <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  }

  const { multilink } = data;
  const online = data.online && device.status === 'online';

  if (!multilink) {
    return online ? (
      <EmptyState
        icon={HourglassIcon}
        title="Waiting for the agent"
        description={`${device.name} is online but has not reported its internet lines yet. They arrive within 5 seconds; if they never do, update the agent on the PC to the latest version.`}
      />
    ) : (
      <EmptyState
        icon={MonitorOffIcon}
        title={`${device.name} is offline`}
        description="Start the agent on the PC to see and combine its internet lines."
      />
    );
  }

  const offlineBanner = !online && <OfflineBanner deviceName={device.name} at={multilink.at} />;

  if (!multilink.enabled) {
    return (
      <>
        {offlineBanner}
        <MultiLinkOffCard multilink={multilink} />
      </>
    );
  }

  return (
    <>
      {offlineBanner}
      <ConnectionsSummary multilink={multilink} />
      <ModeCard deviceId={device.id} data={data} isAdmin={admin} />
      <LinesGrid
        deviceId={device.id}
        data={data}
        isAdmin={admin}
        disabledReason={online ? null : 'The PC is offline.'}
      />
      <ThroughputChart deviceId={device.id} />
      <ProxySetupGuide httpPort={multilink.proxy?.httpPort} socksPort={multilink.proxy?.socksPort} />
      <p className="text-xs text-muted-foreground">Updated {formatRelativeTime(multilink.at)}.</p>
    </>
  );
}

function PageShell({ children, actions }) {
  return (
    <>
      <PageHeader title={TITLE} description={DESCRIPTION} actions={actions} />
      {children}
    </>
  );
}

export function MultiLinkPage() {
  const { data: devices, isPending, isError, error, refetch, isRefetching } = useDevices();
  const [searchParams, setSearchParams] = useSearchParams();

  if (isPending) {
    return (
      <PageShell>
        <LoadingCards />
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell>
        <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />
      </PageShell>
    );
  }

  if (devices.length === 0) {
    return (
      <PageShell>
        <EmptyState
          icon={MonitorIcon}
          title="No PCs yet"
          description="Add a PC and run the agent on it to combine its internet lines here."
          action={
            <Button asChild>
              <Link to="/devices">Go to Devices</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  // The URL keeps the choice; without one (or an unknown id) take the first online PC.
  const device =
    devices.find((item) => item.id === searchParams.get('device')) ??
    devices.find((item) => item.status === 'online') ??
    devices[0];

  const selectDevice = (id) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('device', id);
        return next;
      },
      { replace: true },
    );

  return (
    <PageShell
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <StatusBadge status={device.status === 'online' ? 'online' : 'offline'} />
          <DeviceSelect devices={devices} value={device.id} onChange={selectDevice} />
        </div>
      }
    >
      {/* Keyed so dialogs and local state reset when another PC is chosen. */}
      <MultiLinkContent key={device.id} device={device} />
    </PageShell>
  );
}
