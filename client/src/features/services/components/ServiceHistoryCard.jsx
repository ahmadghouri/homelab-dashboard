import { ActivityIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MetricChart } from '@/components/common/MetricChart';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime, formatPercent, formatTime } from '@/lib/format';
import { useServiceHistory } from '../hooks/useServiceHistory';
import { SERVICE_HISTORY_RANGES } from '../queryKeys';
import { formatResponseMs } from '../utils';

const UPTIME_SERIES = [{ key: 'uptimePct', label: 'Uptime', color: 'var(--chart-2)' }];
const RESPONSE_SERIES = [{ key: 'avgResponseMs', label: 'Response time', color: 'var(--chart-1)' }];

function ChartBlock({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

// Uptime and response time charts for one service.
export function ServiceHistoryCard({ service }) {
  const [range, setRange] = useState('24h');
  const { data, isPending, isError, error, refetch, isRefetching } = useServiceHistory(service.id, range);
  const timeFormatter = (ts) => (ts ? (range === '24h' ? formatTime(ts) : formatDateTime(ts)) : '');

  let content;
  if (isPending) {
    content = <Skeleton className="h-96 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else if (data.points.length < 2) {
    content = (
      <EmptyState
        icon={ActivityIcon}
        title="Not enough checks yet"
        description={
          service.enabled
            ? `The chart appears after a few checks. This service is checked every ${service.intervalSec} s.`
            : 'This service is paused. Resume it to collect checks.'
        }
      />
    );
  } else {
    content = (
      <div className="flex flex-col gap-6">
        <ChartBlock title="Uptime">
          <MetricChart
            data={data.points}
            series={UPTIME_SERIES}
            yDomain={[0, 100]}
            valueFormatter={(value) => formatPercent(value)}
            timeFormatter={timeFormatter}
            className="h-48"
          />
        </ChartBlock>
        <ChartBlock title="Average response time">
          <MetricChart
            data={data.points}
            series={RESPONSE_SERIES}
            valueFormatter={formatResponseMs}
            timeFormatter={timeFormatter}
            className="h-48"
          />
        </ChartBlock>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate">{service.name}</CardTitle>
        <CardDescription>
          Uptime and response time{data ? `, ${data.binMinutes} min steps` : ''}
        </CardDescription>
        <CardAction>
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              {SERVICE_HISTORY_RANGES.map(({ value, label }) => (
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
