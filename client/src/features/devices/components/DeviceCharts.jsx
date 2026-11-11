import { ActivityIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MetricChart } from '@/components/common/MetricChart';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime, formatPercent, formatTime } from '@/lib/format';
import { useDeviceHistory } from '../hooks/useDeviceHistory';
import { useDeviceLiveSeries } from '../hooks/useDeviceLiveSeries';
import { HISTORY_RANGES } from '../queryKeys';

const USAGE_SERIES = [
  { key: 'cpu', label: 'CPU', color: 'var(--chart-1)' },
  { key: 'memPct', label: 'RAM', color: 'var(--chart-2)' },
];

const formatSeconds = (ts) =>
  ts ? new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

export function LiveUsageChart({ deviceId, isOnline }) {
  const { data: points = [] } = useDeviceLiveSeries(deviceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live usage</CardTitle>
        <CardDescription>Last 5 minutes, updates every 5 seconds</CardDescription>
      </CardHeader>
      <CardContent>
        {points.length < 2 ? (
          <EmptyState
            icon={ActivityIcon}
            title={isOnline ? 'Collecting data' : 'Device is offline'}
            description={
              isOnline ? 'The chart appears after a few updates.' : 'Live data shows when the agent connects.'
            }
          />
        ) : (
          <MetricChart
            data={points}
            series={USAGE_SERIES}
            yDomain={[0, 100]}
            valueFormatter={(value) => formatPercent(value)}
            timeFormatter={formatSeconds}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function HistoryUsageChart({ deviceId }) {
  const [range, setRange] = useState('1h');
  const { data, isPending, isError, error, refetch, isRefetching } = useDeviceHistory(deviceId, range);
  const timeFormatter = (ts) => (ts ? (range === '1h' ? formatTime(ts) : formatDateTime(ts)) : '');

  let content;
  if (isPending) {
    content = <Skeleton className="h-64 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else if (data.points.length < 2) {
    content = (
      <EmptyState
        icon={ActivityIcon}
        title="No history yet"
        description="One sample is saved every minute while the agent is connected."
      />
    );
  } else {
    content = (
      <MetricChart
        data={data.points}
        series={USAGE_SERIES}
        yDomain={[0, 100]}
        valueFormatter={(value) => formatPercent(value)}
        timeFormatter={timeFormatter}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>
          Average CPU and RAM{data ? `, ${data.binMinutes} min steps` : ''}
        </CardDescription>
        <CardAction>
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              {HISTORY_RANGES.map(({ value, label }) => (
                <TabsTrigger key={value} value={value} aria-label={label}>
                  {value}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
