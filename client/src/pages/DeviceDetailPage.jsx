import { ArrowLeftIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/useMe';
import { DeviceActionsMenu } from '@/features/devices/components/DeviceActionsMenu';
import { HistoryUsageChart, LiveUsageChart } from '@/features/devices/components/DeviceCharts';
import {
  DisksCard,
  SystemInfoCard,
  TopProcessesCard,
} from '@/features/devices/components/DeviceDetailsCards';
import { DeviceLiveStats } from '@/features/devices/components/DeviceLiveStats';
import { useDevice } from '@/features/devices/hooks/useDevice';
import { isAdmin } from '@/features/devices/utils';
import { formatRelativeTime } from '@/lib/format';
import { NotFoundPage } from './NotFoundPage';

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
      <Link to="/devices">
        <ArrowLeftIcon aria-hidden="true" />
        All devices
      </Link>
    </Button>
  );
}

export function DeviceDetailPage() {
  const { id } = useParams();
  const { data: user } = useMe();
  const { data: device, isPending, isError, error, refetch, isRefetching } = useDevice(id);

  if (isPending) {
    return (
      <>
        <BackLink />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </>
    );
  }

  if (isError) {
    if (error.status === 404 || error.status === 400) {
      return <NotFoundPage />;
    }
    return <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  }

  const isOnline = device.status === 'online';
  const live = isOnline ? device.live : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <BackLink />
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-3">
              {device.name}
              <StatusBadge status={device.status} />
            </span>
          }
          description={
            isOnline
              ? `${device.hostname} · ${device.osName}`
              : `Last seen ${formatRelativeTime(device.lastSeenAt)}`
          }
          actions={isAdmin(user) && <DeviceActionsMenu device={device} />}
        />
      </div>

      <DeviceLiveStats live={live} />

      <div className="grid gap-4 lg:grid-cols-2">
        <LiveUsageChart deviceId={device.id} isOnline={isOnline} />
        <HistoryUsageChart deviceId={device.id} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DisksCard disks={live?.disks} />
        <SystemInfoCard device={device} />
      </div>

      <TopProcessesCard processes={live?.topProcesses} />
    </>
  );
}
