import {
  ArrowDownIcon,
  ArrowUpIcon,
  EraserIcon,
  EthernetPortIcon,
  GaugeIcon,
  LoaderCircleIcon,
  NetworkIcon,
  Settings2Icon,
  SmartphoneIcon,
  WifiIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { StatusBadge } from '@/components/common/StatusBadge';
import { UsageBar } from '@/components/common/UsageBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBitsPerSecond, formatBytes, formatRelativeTime } from '@/lib/format';
import { useLineSpeedTest, useResetLineUsage } from '../hooks/useMultiLinkMutations';

const KINDS = {
  wifi: { label: 'Wi-Fi', Icon: WifiIcon },
  ethernet: { label: 'Ethernet', Icon: EthernetPortIcon },
  tethering: { label: 'Phone (USB tethering)', Icon: SmartphoneIcon },
  other: { label: 'Other', Icon: NetworkIcon },
};

const ROLES = {
  active: { label: 'Active', className: 'bg-success/15 text-success' },
  backup: { label: 'Backup', className: 'bg-info/15 text-info' },
  off: { label: 'Off', className: 'bg-muted text-muted-foreground' },
};

function Stat({ label, children }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function formatLatency(ms) {
  return typeof ms === 'number' ? `${Math.round(ms)} ms` : '–';
}

function formatLoss(pct) {
  return typeof pct === 'number' ? `${Math.round(pct)}%` : '–';
}

function SpeedTestSummary({ test }) {
  if (!test) {
    return 'Never';
  }
  const result = test.ok && typeof test.downloadMbps === 'number' ? `${test.downloadMbps.toFixed(1)} Mbps` : 'Failed';
  return `${result}, ${formatRelativeTime(test.at)}`;
}

function DataUsage({ line }) {
  if (line.capBytes) {
    const pct = Math.min(100, (line.usedBytes / line.capBytes) * 100);
    return (
      <UsageBar
        label="Data used"
        value={pct}
        detail={`${formatBytes(line.usedBytes)} of ${formatBytes(line.capBytes)}`}
      />
    );
  }
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">Data used </span>
      <span className="font-medium tabular-nums">{formatBytes(line.usedBytes)}</span>
      <span className="text-muted-foreground"> (no limit)</span>
    </p>
  );
}

function speedTestWarning(line) {
  const base = `Downloads up to 10 MB over ${line.name} to measure its speed. It takes up to a minute.`;
  if (line.kind === 'tethering') {
    return `${base} This line is a phone on mobile data: the test uses about 10 MB of your data plan.`;
  }
  return base;
}

// One internet line: status, live rates, data use, and admin actions.
// `disabledReason` disables the actions and explains why (PC offline, Multi-Link off).
export function LineCard({ line, deviceId, isAdmin, disabledReason, onOpenSettings }) {
  const [confirm, setConfirm] = useState(null);
  const speedTest = useLineSpeedTest();
  const reset = useResetLineUsage();
  const kind = KINDS[line.kind] ?? KINDS.other;
  const role = ROLES[line.role] ?? ROLES.active;
  const KindIcon = kind.Icon;
  const speedTestReason = disabledReason ?? (line.role === 'off' ? 'The line is turned off.' : null);
  const isOverCap = Boolean(line.capBytes) && line.usedBytes >= line.capBytes;

  // The test can take up to a minute: close the dialog at once, the button shows the progress.
  const runSpeedTest = () => {
    setConfirm(null);
    speedTest.mutate(
      { deviceId, lineId: line.id },
      {
        onSuccess: (result) => {
          if (result.ok) {
            const speed = typeof result.downloadMbps === 'number' ? `${result.downloadMbps.toFixed(1)} Mbps` : 'Done';
            toast.success(`${line.name}: ${speed}`, { description: result.output || undefined });
          } else {
            toast.error(`Speed test on ${line.name} failed`, { description: result.output || undefined });
          }
        },
        onError: (error) => toast.error(`Speed test on ${line.name} failed`, { description: error.message }),
      },
    );
  };

  const runReset = () =>
    reset.mutate(
      { deviceId, lineId: line.id },
      {
        onSuccess: (result) => {
          setConfirm(null);
          if (result.ok) {
            toast.success(`Usage of ${line.name} reset`);
          } else {
            toast.error(`Could not reset ${line.name}`, { description: result.output || undefined });
          }
        },
        onError: (error) => {
          setConfirm(null);
          toast.error(`Could not reset ${line.name}`, { description: error.message });
        },
      },
    );

  const isPending = speedTest.isPending || reset.isPending;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          <KindIcon className="size-4 shrink-0 text-muted-foreground" aria-label={kind.label} />
          <span className="truncate" title={line.name}>
            {line.name}
          </span>
        </CardTitle>
        <CardDescription className="truncate font-mono text-xs">{line.ip}</CardDescription>
        <CardAction className="flex flex-wrap justify-end gap-1.5">
          <StatusBadge status={line.up ? 'up' : 'down'} />
          <Badge className={role.className}>{role.label}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Stat label="Download">
            <ArrowDownIcon className="mr-1 inline size-3.5 text-muted-foreground" aria-hidden="true" />
            {formatBitsPerSecond(line.rxBps)}
          </Stat>
          <Stat label="Upload">
            <ArrowUpIcon className="mr-1 inline size-3.5 text-muted-foreground" aria-hidden="true" />
            {formatBitsPerSecond(line.txBps)}
          </Stat>
          <Stat label="Connections">{line.connections ?? 0}</Stat>
          <Stat label="Latency">{formatLatency(line.latencyMs)}</Stat>
          <Stat label="Loss">{formatLoss(line.lossPct)}</Stat>
          <Stat label="Type">{kind.label}</Stat>
        </dl>

        <DataUsage line={line} />
        {isOverCap && (
          <p className="text-xs text-danger">Data limit reached: the proxy skips this line until its usage is reset.</p>
        )}
        {line.kind === 'tethering' && line.role === 'active' && (
          <p className="text-xs text-warning">Mobile data line in active use: watch your data plan.</p>
        )}

        <p className="text-xs text-muted-foreground">
          Last speed test: <SpeedTestSummary test={line.lastSpeedTest} />
        </p>
      </CardContent>

      {isAdmin && (
        <CardFooter className="mt-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(speedTestReason) || isPending}
            title={speedTestReason || undefined}
            aria-label={`Speed test ${line.name}`}
            onClick={() => setConfirm('speedtest')}
          >
            {speedTest.isPending ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <GaugeIcon aria-hidden="true" />
            )}
            {speedTest.isPending ? 'Testing...' : 'Speed test'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(disabledReason) || isPending}
            title={disabledReason || undefined}
            aria-label={`Reset data usage of ${line.name}`}
            onClick={() => setConfirm('reset')}
          >
            {reset.isPending ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <EraserIcon aria-hidden="true" />
            )}
            Reset usage
          </Button>
          <Button variant="outline" size="sm" aria-label={`Settings of ${line.name}`} onClick={onOpenSettings}>
            <Settings2Icon aria-hidden="true" />
            Settings
          </Button>
        </CardFooter>
      )}

      <ConfirmDialog
        open={confirm === 'speedtest'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Run a speed test on ${line.name}?`}
        description={speedTestWarning(line)}
        confirmLabel="Run speed test"
        onConfirm={runSpeedTest}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        onOpenChange={(open) => !open && !reset.isPending && setConfirm(null)}
        title={`Reset the data usage of ${line.name}?`}
        description="The used data counter starts again from zero. If the line had reached its data limit, the proxy uses it again."
        confirmLabel="Reset usage"
        destructive
        isPending={reset.isPending}
        onConfirm={runReset}
      />
    </Card>
  );
}
