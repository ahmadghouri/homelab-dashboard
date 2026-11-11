import { TableIcon, WifiOffIcon } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NetworkTopology } from '@/features/network/components/topology/NetworkTopology';
import { useNetworkDevices } from '@/features/network/hooks/useNetworkDevices';
import { formatRelativeTime } from '@/lib/format';

function describe(devices, scan) {
  const online = devices.filter((device) => device.online).length;
  const where = scan.subnet ? ` on ${scan.subnet}` : '';
  const when = scan.lastScanAt ? `, last scan ${formatRelativeTime(scan.lastScanAt)}` : '';
  return `${online} of ${devices.length} devices online${where}${when}.`;
}

export function NetworkMapPage() {
  const { data, isPending, isError, error, refetch, isRefetching } = useNetworkDevices();

  const header = (
    <PageHeader
      title="Network map"
      description={data ? describe(data.devices, data.scan) : 'How the devices on your network connect to the router.'}
      actions={
        <Button asChild variant="outline">
          <Link to="/network">
            <TableIcon aria-hidden="true" />
            Table view
          </Link>
        </Button>
      }
    />
  );

  if (isPending) {
    return (
      <>
        {header}
        <Skeleton className="h-[clamp(420px,calc(100svh-9rem),900px)] w-full rounded-xl" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        {header}
        <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />
      </>
    );
  }

  if (data.devices.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={WifiOffIcon}
          title="No devices found yet"
          description="The network scanner has not found any devices yet. Run a scan from the Network page."
          action={
            <Button asChild variant="outline">
              <Link to="/network">Go to Network</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <NetworkTopology devices={data.devices} scan={data.scan} />
    </>
  );
}
