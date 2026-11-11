import { MonitorIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/useMe';
import { AddDeviceButton } from '@/features/devices/components/AddDeviceDialog';
import { DeviceCard } from '@/features/devices/components/DeviceCard';
import { useDevices } from '@/features/devices/hooks/useDevices';
import { isAdmin } from '@/features/auth/utils';

function DeviceGrid() {
  const { data: devices, isPending, isError, error, refetch, isRefetching } = useDevices();

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-56 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  }

  if (devices.length === 0) {
    return (
      <EmptyState
        icon={MonitorIcon}
        title="No devices yet"
        description="Add a PC, then run the agent on it with the token you get."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {devices.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
    </div>
  );
}

export function DevicesPage() {
  const { data: user } = useMe();

  return (
    <>
      <PageHeader
        title="Devices"
        description="Live CPU, RAM, disk, and temperature of every PC with the agent."
        actions={isAdmin(user) && <AddDeviceButton />}
      />
      <DeviceGrid />
    </>
  );
}
