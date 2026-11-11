import { DownloadIcon, FileTextIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { MetricChart } from '@/components/common/MetricChart';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getIspReportPdfUrl } from '../api';
import { useIspReport } from '../hooks/useIspReport';
import { formatLossPct, formatMbps, formatMs, formatOutageDuration, lastTwelveMonths } from '../utils';

const DAILY_SERIES = [
  { key: 'download', label: 'Download', color: 'var(--chart-1)' },
  { key: 'upload', label: 'Upload', color: 'var(--chart-2)' },
];

const dayFormatter = (ts) =>
  ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

const speedFormatter = (value) =>
  typeof value === 'number' ? `${value < 10 ? value.toFixed(1) : value.toFixed(0)} Mbps` : '';

function availabilityTone(pct) {
  if (typeof pct !== 'number') {
    return undefined;
  }
  if (pct >= 99.9) {
    return 'text-success';
  }
  return pct >= 99 ? 'text-warning' : 'text-danger';
}

function Stat({ label, value, hint, className }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('text-lg font-semibold tabular-nums', className)}>{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function ReportSummary({ report }) {
  const { speed, uptime, quality, daily } = report;
  const chartData = (daily ?? [])
    .filter((day) => typeof day.avgDownloadMbps === 'number')
    // "YYYY-MM-DD" alone parses as UTC; add a time so it is local midnight.
    .map((day) => ({
      ts: `${day.date}T00:00:00`,
      download: day.avgDownloadMbps,
      upload: day.avgUploadMbps,
    }));
  const testsHint = speed.failed ? `${speed.failed} failed` : 'none failed';

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Speed</h3>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Average download" value={formatMbps(speed.avgDownloadMbps)} />
          <Stat label="Average upload" value={formatMbps(speed.avgUploadMbps)} />
          <Stat
            label="Download range"
            value={formatMbps(speed.minDownloadMbps)}
            hint={`up to ${formatMbps(speed.maxDownloadMbps)}`}
          />
          <Stat label="Speed tests" value={speed.tests} hint={`${testsHint}, ping ${formatMs(speed.avgPingMs)}`} />
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Uptime and quality</h3>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Availability"
            value={formatPercent(uptime.availabilityPct, 2)}
            className={availabilityTone(uptime.availabilityPct)}
          />
          <Stat
            label="Outages"
            value={uptime.outages}
            hint={`longest ${formatOutageDuration(uptime.longestOutageSec)}`}
          />
          <Stat label="Total downtime" value={formatOutageDuration(uptime.totalDowntimeSec)} />
          <Stat
            label="Packet loss"
            value={formatLossPct(quality.avgLossPct)}
            hint={`latency ${formatMs(quality.avgLatencyMs)}`}
          />
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Daily average speed</h3>
        {chartData.length < 2 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Not enough speed tests this month for a daily chart.
          </p>
        ) : (
          <MetricChart
            data={chartData}
            series={DAILY_SERIES}
            valueFormatter={speedFormatter}
            yAxisWidth={72}
            timeFormatter={dayFormatter}
            className="h-52"
          />
        )}
      </section>
    </div>
  );
}

// The server may send hasData; otherwise derive it from the numbers.
function hasData(report) {
  if (typeof report.hasData === 'boolean') {
    return report.hasData;
  }
  return report.speed.tests > 0 || report.uptime.outages > 0 || typeof report.quality.avgLatencyMs === 'number';
}

export function IspReportCard() {
  const months = lastTwelveMonths();
  const [month, setMonth] = useState(months[0].value);
  const { data: report, isPending, isError, error, refetch, isRefetching, isPlaceholderData } =
    useIspReport(month);
  const monthLabel = months.find((option) => option.value === month)?.label ?? month;

  let content;
  if (isPending) {
    content = <Skeleton className="h-72 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else if (!hasData(report)) {
    content = (
      <EmptyState
        icon={FileTextIcon}
        title={`No data for ${monthLabel}`}
        description="Speed tests, outages and quality samples from this month will show up here."
      />
    );
  } else {
    content = (
      <div className={cn('transition-opacity', isPlaceholderData && 'opacity-60')}>
        <ReportSummary report={report} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ISP monthly report</CardTitle>
        <CardDescription>Speed, uptime and quality for one month, to share with your provider</CardDescription>
        <CardAction className="col-span-2 col-start-1 row-span-1 row-start-3 mt-2 flex flex-wrap gap-2 justify-self-start sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:justify-self-end">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-44" aria-label="Report month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="outline">
            <a href={getIspReportPdfUrl(month)} download={`isp-report-${month}.pdf`}>
              <DownloadIcon aria-hidden="true" />
              Download PDF
            </a>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
