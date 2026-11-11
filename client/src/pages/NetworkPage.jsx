import {
  LoaderCircleIcon,
  NetworkIcon,
  RadarIcon,
  ShieldAlertIcon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/useMe';
import { isAdmin } from '@/features/auth/utils';
import { NetworkDevicesTable } from '@/features/network/components/NetworkDevicesTable';
import { useNetworkDevices } from '@/features/network/hooks/useNetworkDevices';
import { useScanNetwork } from '@/features/network/hooks/useNetworkMutations';
import { formatRelativeTime } from '@/lib/format';

function ScanButton({ scanning }) {
  const scan = useScanNetwork();
  const busy = scanning || scan.isPending;

  return (
    <Button
      onClick={() =>
        scan.mutate(undefined, {
          onSuccess: (result) =>
            toast.success(`Scan finished: ${result.found} devices${result.new ? `, ${result.new} new` : ''}`),
          onError: (error) => toast.error(error.message),
        })
      }
      disabled={busy}
    >
      {busy ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <RadarIcon aria-hidden="true" />}
      {busy ? 'Scanning' : 'Scan now'}
    </Button>
  );
}

function scanDescription(scan) {
  if (scan.lastError) {
    return `Last scan failed: ${scan.lastError}`;
  }
  if (!scan.lastScanAt) {
    return 'First scan is starting';
  }
  return `Last scan ${formatRelativeTime(scan.lastScanAt)} on ${scan.subnet}`;
}

export function NetworkPage() {
  const { data: user } = useMe();
  const { data, isPending, isError, error, refetch, isRefetching } = useNetworkDevices();
  const admin = isAdmin(user);

  const header = (
    <PageHeader
      title="Network"
      description={data ? scanDescription(data.scan) : 'Everything connected to your network.'}
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/network/map">
              <NetworkIcon aria-hidden="true" />
              Map view
            </Link>
          </Button>
          {admin && data && <ScanButton scanning={data.scan.scanning} />}
        </>
      }
    />
  );

  if (isPending) {
    return (
      <>
        {header}
        <Skeleton className="h-96 w-full rounded-xl" />
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

  const { devices } = data;
  const online = devices.filter((device) => device.online).length;
  const unknown = devices.filter((device) => !device.trusted).length;

  return (
    <>
      {header}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Devices seen" icon={WifiIcon} value={devices.length} />
        <StatCard title="Online now" icon={WifiIcon} value={online} />
        <StatCard title="Offline" icon={WifiOffIcon} value={devices.length - online} />
        <StatCard
          title="Unknown"
          icon={ShieldAlertIcon}
          value={unknown}
          description={unknown ? 'Review and mark as trusted' : 'All devices reviewed'}
        />
      </div>
      <Card>
        <CardContent>
          <NetworkDevicesTable devices={devices} isAdmin={admin} />
        </CardContent>
      </Card>
    </>
  );
}
