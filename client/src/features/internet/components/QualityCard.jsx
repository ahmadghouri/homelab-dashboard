import { ActivityIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MetricChart } from '@/components/common/MetricChart';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime, formatRelativeTime, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useQuality } from '../hooks/useQuality';
import { QUALITY_RANGES } from '../queryKeys';
import { formatLossPct, formatMs, lossTone } from '../utils';

const TARGET_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

const latencyFormatter = (value) => (typeof value === 'number' ? `${value.toFixed(0)} ms` : '');
const lossFormatter = (value) => (typeof value === 'number' ? `${value.toFixed(0)}%` : '');

// Chart series keys end up in CSS variables, so keep them to letters only.
function seriesKey(target, suffix) {
  return `${target.replace(/[^a-z]/gi, '')}${suffix}`;
}

function buildSeries(targets, suffix) {
  return targets.map(({ target, name }, index) => ({
    key: seriesKey(target, suffix),
    label: name,
    color: TARGET_COLORS[index % TARGET_COLORS.length],
  }));
}

// One row per timestamp with a latency and a loss value for each target.
function mergePoints(targets) {
  const rows = new Map();
  for (const { target, points } of targets) {
    for (const point of points ?? []) {
      const row = rows.get(point.ts) ?? { ts: point.ts };
      row[seriesKey(target, 'Ms')] = point.avgMs;
      row[seriesKey(target, 'Loss')] = point.lossPct;
      rows.set(point.ts, row);
    }
  }
  return [...rows.values()].sort((a, b) => new Date(a.ts) - new Date(b.ts));
}

function TargetRow({ target }) {
  const { name, latest } = target;
  // The gateway address is unknown when detection fails and nothing was measured yet.
  const host = target.host ?? 'address unknown';
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          {latest ? `${host} · measured ${formatRelativeTime(latest.ts)}` : `${host} · no measurement yet`}
        </p>
      </div>
      <dl className="flex gap-5 text-sm tabular-nums">
        <div>
          <dt className="text-xs text-muted-foreground">Loss</dt>
          <dd className={cn('font-medium', lossTone(latest?.lossPct))}>{formatLossPct(latest?.lossPct)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Latency</dt>
          <dd className="font-medium">{formatMs(latest?.avgMs)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Jitter</dt>
          <dd className="font-medium">{formatMs(latest?.jitterMs)}</dd>
        </div>
      </dl>
    </li>
  );
}

function ChartBlock({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function QualityCharts({ targets, range }) {
  const rows = mergePoints(targets);
  const timeFormatter = (ts) => {
    if (!ts) {
      return '';
    }
    return range === '1h' ? formatTime(ts) : formatDateTime(ts);
  };

  if (rows.length < 2) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="Collecting quality data"
        description="The monitor pings each target once a minute. The chart appears after a few minutes."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartBlock title="Latency (average)">
        <MetricChart
          data={rows}
          series={buildSeries(targets, 'Ms')}
          valueFormatter={latencyFormatter}
          timeFormatter={timeFormatter}
          className="h-52"
        />
      </ChartBlock>
      <ChartBlock title="Packet loss">
        <MetricChart
          data={rows}
          series={buildSeries(targets, 'Loss')}
          valueFormatter={lossFormatter}
          timeFormatter={timeFormatter}
          yDomain={[0, (max) => Math.max(5, Math.ceil(max))]}
          yAxisWidth={44}
          className="h-52"
        />
      </ChartBlock>
    </div>
  );
}

function describeBins(data) {
  if (!data?.binMinutes) {
    return 'Ping to the router and to the internet (1.1.1.1)';
  }
  const bin = data.binMinutes === 1 ? 'every minute' : `averaged per ${data.binMinutes} minutes`;
  return `Ping to the router and to the internet (1.1.1.1), ${bin}`;
}

export function QualityCard() {
  const [range, setRange] = useState('24h');
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } = useQuality(range);

  let content;
  if (isPending) {
    content = <Skeleton className="h-72 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else if (data.targets.length === 0) {
    content = (
      <EmptyState
        icon={ActivityIcon}
        title="No quality data yet"
        description="The monitor starts with the server and measures every minute."
      />
    );
  } else {
    content = (
      <div className={cn('flex flex-col gap-4 transition-opacity', isPlaceholderData && 'opacity-60')}>
        <ul className="divide-y">
          {data.targets.map((target) => (
            <TargetRow key={target.target} target={target} />
          ))}
        </ul>
        <QualityCharts targets={data.targets} range={range} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection quality</CardTitle>
        <CardDescription>{describeBins(data)}</CardDescription>
        <CardAction>
          <Tabs value={range} onValueChange={setRange}>
            <TabsList aria-label="Time range">
              {QUALITY_RANGES.map(({ value, label }) => (
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
