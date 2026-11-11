import { ArrowDownIcon, ArrowUpIcon, GlobeIcon, TimerIcon } from 'lucide-react';
import { ErrorState } from '@/components/common/ErrorState';
import { StatCard } from '@/components/common/StatCard';
import { formatRelativeTime } from '@/lib/format';
import { useInternetStatus } from '../hooks/useInternetStatus';
import { useSpeedTests } from '../hooks/useSpeedTests';
import { findLastSuccessfulTest, formatMbps, formatMs } from '../utils';

function ConnectionValue({ online }) {
  if (online === null) {
    return <span className="text-muted-foreground">Checking</span>;
  }
  return online ? <span className="text-success">Online</span> : <span className="text-danger">Offline</span>;
}

function connectionDescription({ online, since, checkedAt }) {
  if (online === null) {
    return 'The first check runs shortly';
  }
  const parts = since ? [`Since ${formatRelativeTime(since)}`] : [];
  if (checkedAt) {
    parts.push(`checked ${formatRelativeTime(checkedAt)}`);
  }
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function testDescription(lastTest, lastSuccessful) {
  if (!lastTest) {
    return 'No speed test yet';
  }
  if (!lastTest.success) {
    return lastSuccessful
      ? `Latest test failed, showing ${formatRelativeTime(lastSuccessful.ts)}`
      : 'Latest test failed';
  }
  return `Tested ${formatRelativeTime(lastTest.ts)}`;
}

export function InternetStatCards() {
  const { data: status, isPending, isError, error, refetch, isRefetching } = useInternetStatus();
  const lastTest = status?.lastSpeedTest ?? null;
  // The status only carries the latest test; when it failed, look back for the latest good one.
  const needsHistory = Boolean(lastTest && !lastTest.success);
  const history = useSpeedTests('30d', { enabled: needsHistory });
  const lastSuccessful = needsHistory ? findLastSuccessfulTest(history.data?.tests) : lastTest;
  const testsLoading = isPending || (needsHistory && history.isPending);

  if (isError) {
    return <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  }

  const description = status ? testDescription(lastTest, lastSuccessful) : undefined;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        title="Connection"
        icon={GlobeIcon}
        isLoading={isPending}
        value={status && <ConnectionValue online={status.online} />}
        description={status && connectionDescription(status)}
      />
      <StatCard
        title="Download"
        icon={ArrowDownIcon}
        isLoading={testsLoading}
        value={formatMbps(lastSuccessful?.downloadMbps)}
        description={description}
      />
      <StatCard
        title="Upload"
        icon={ArrowUpIcon}
        isLoading={testsLoading}
        value={formatMbps(lastSuccessful?.uploadMbps)}
        description={description}
      />
      <StatCard
        title="Ping"
        icon={TimerIcon}
        isLoading={testsLoading}
        value={formatMs(lastSuccessful?.pingMs)}
        description={lastSuccessful ? `Jitter ${formatMs(lastSuccessful.jitterMs)}` : description}
      />
    </div>
  );
}
