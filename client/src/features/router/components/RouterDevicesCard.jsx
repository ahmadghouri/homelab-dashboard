import { ErrorState } from '@/components/common/ErrorState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouterDevices } from '../hooks/useRouterDevices';
import { RouterDevicesTable } from './RouterDevicesTable';

// Router devices with live usage, refreshed every 10 s while this card is on screen.
export function RouterDevicesCard({ isAdmin }) {
  const { data: devices, isPending, isError, error, refetch, isRefetching } = useRouterDevices({ live: true });

  let content;
  if (isPending) {
    content = <Skeleton className="h-72 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else {
    content = <RouterDevicesTable devices={devices} isAdmin={isAdmin} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Devices</CardTitle>
        <CardDescription>
          Devices from the network scan. Track a device to see its speed and data used; updates every 10 seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
