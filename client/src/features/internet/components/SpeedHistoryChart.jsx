import { GaugeIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MetricChart } from '@/components/common/MetricChart';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime } from '@/lib/format';
import { useSpeedTests } from '../hooks/useSpeedTests';
import { SPEED_TEST_RANGES } from '../queryKeys';

const SPEED_SERIES = [
  { key: 'download', label: 'Download', color: 'var(--chart-1)' },
  { key: 'upload', label: 'Upload', color: 'var(--chart-2)' },
];

const timeFormatter = (ts) => (ts ? formatDateTime(ts) : '');

// Short enough for the y axis: one decimal only for slow links.
const speedFormatter = (value) =>
  typeof value === 'number' ? `${value < 10 ? value.toFixed(1) : value.toFixed(0)} Mbps` : '';

function chartDescription(tests) {
  if (!tests) {
    return 'Download and upload in Mbps';
  }
  const failed = tests.filter((test) => !test.success).length;
  const count = `${tests.length} ${tests.length === 1 ? 'test' : 'tests'}`;
  return `Download and upload in Mbps, ${count}${failed ? ` (${failed} failed)` : ''}`;
}

export function SpeedHistoryChart() {
  const [range, setRange] = useState('7d');
  const { data, isPending, isError, error, refetch, isRefetching } = useSpeedTests(range);

  const points = (data?.tests ?? [])
    .filter((test) => test.success)
    .map((test) => ({ ts: test.ts, download: test.downloadMbps, upload: test.uploadMbps }));

  let content;
  if (isPending) {
    content = <Skeleton className="h-64 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else if (points.length < 2) {
    content = (
      <EmptyState
        icon={GaugeIcon}
        title="Not enough speed tests yet"
        description="The chart appears after two successful tests in this range."
      />
    );
  } else {
    content = (
      <MetricChart
        data={points}
        series={SPEED_SERIES}
        valueFormatter={speedFormatter}
        yAxisWidth={72}
        timeFormatter={timeFormatter}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Speed history</CardTitle>
        <CardDescription>{chartDescription(data?.tests)}</CardDescription>
        <CardAction>
          <Tabs value={range} onValueChange={setRange}>
            <TabsList aria-label="Time range">
              {SPEED_TEST_RANGES.map(({ value, label }) => (
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
