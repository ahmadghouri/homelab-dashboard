import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/useMe';
import { isAdmin } from '@/features/auth/utils';
import { DnsCard } from '@/features/router/components/DnsCard';
import { RouterDevicesCard } from '@/features/router/components/RouterDevicesCard';
import { RouterStatusCard } from '@/features/router/components/RouterStatusCard';
import { DnsSetupCard, RouterSetupCard } from '@/features/router/components/SetupHelpCards';
import { useDnsStatus } from '@/features/router/hooks/useDnsStatus';
import { useRouterStatus } from '@/features/router/hooks/useRouterStatus';

const STATUS_REFRESH_MS = 30 * 1000;

function RouterSection({ admin }) {
  const { data: status, isPending, isError, error, refetch, isRefetching } = useRouterStatus({
    refetchInterval: STATUS_REFRESH_MS,
  });

  if (isPending) {
    return <Skeleton className="h-56 w-full rounded-xl" />;
  }
  if (isError) {
    return (
      <ErrorState
        title="Could not load the router status"
        message={error.message}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
      />
    );
  }
  if (!status.configured) {
    return <RouterSetupCard error={status.error} />;
  }
  return (
    <>
      <RouterStatusCard status={status} />
      {status.reachable && <RouterDevicesCard isAdmin={admin} />}
    </>
  );
}

function DnsSection({ admin }) {
  const { data: status, isPending, isError, error, refetch, isRefetching } = useDnsStatus();

  if (isPending) {
    return <Skeleton className="h-56 w-full rounded-xl" />;
  }
  if (isError) {
    return (
      <ErrorState
        title="Could not load the DNS status"
        message={error.message}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
      />
    );
  }
  return status.configured ? <DnsCard status={status} isAdmin={admin} /> : <DnsSetupCard />;
}

export function RouterPage() {
  const { data: user } = useMe();
  const admin = isAdmin(user);

  return (
    <>
      <PageHeader
        title="Router"
        description="Internet lines, per-device usage, priorities and blocking on your router, plus DNS ad blocking."
      />
      <RouterSection admin={admin} />
      <DnsSection admin={admin} />
    </>
  );
}
