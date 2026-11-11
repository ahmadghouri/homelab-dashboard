import { ActivityIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { MetricChart } from '@/components/common/MetricChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBitsPerSecond } from '@/lib/format';
import { useMultiLink } from '../hooks/useMultiLink';
import { useThroughputHistory } from '../hooks/useThroughputHistory';

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

const formatSeconds = (ts) =>
  ts ? new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

// Line ids are interface names with spaces ("Ethernet 2"), which are not valid in the CSS variables
// the chart uses, so each line gets a simple key (line0, line1, ...) in order of first appearance.
function buildChart(points, names) {
  const keys = new Map();
  for (const point of points) {
    for (const line of point.lines) {
      if (!keys.has(line.id)) {
        keys.set(line.id, `line${keys.size}`);
      }
    }
  }

  const series = [...keys].map(([id, key], index) => ({
    key,
    label: names.get(id) ?? id,
    color: COLORS[index % COLORS.length],
  }));

  const data = points.map((point) => {
    const row = { ts: point.at };
    for (const line of point.lines) {
      row[keys.get(line.id)] = line.rxBps;
    }
    return row;
  });

  return { series, data };
}

// Live download rate per line over the last 5 minutes (client-only history from socket updates).
export function ThroughputChart({ deviceId }) {
  const { data: detail } = useMultiLink(deviceId);
  const { data: points = [] } = useThroughputHistory(deviceId);
  const names = new Map((detail?.multilink?.lines ?? []).map((line) => [line.id, line.name]));
  const isOffline = detail?.online === false;
  const latestTotal = points.at(-1)?.totals?.rxBps;

  let content;
  if (points.length < 2) {
    content = (
      <EmptyState
        icon={ActivityIcon}
        title={isOffline ? 'PC is offline' : 'Collecting data'}
        description={
          isOffline
            ? 'The chart fills when the agent connects again.'
            : 'The chart appears after a few updates (one every 5 seconds) while this page is open.'
        }
      />
    );
  } else {
    const { series, data } = buildChart(points, names);
    content = (
      <MetricChart
        data={data}
        series={series}
        valueFormatter={(value) => formatBitsPerSecond(value)}
        timeFormatter={formatSeconds}
        yAxisWidth={76}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Download per line</CardTitle>
        <CardDescription>
          Traffic through the proxy, last 5 minutes
          {latestTotal != null ? `. Now ${formatBitsPerSecond(latestTotal)} in total` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
