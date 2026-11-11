import { UsageBar } from '@/components/common/UsageBar';
import { DataTable } from '@/components/common/DataTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBitsPerSecond, formatBytes, formatDuration, formatPercent } from '@/lib/format';

export function DisksCard({ disks }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Disks</CardTitle>
        <CardDescription>Updates every 30 seconds</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {disks?.length ? (
          disks.map((disk) => (
            <UsageBar
              key={disk.mount}
              label={disk.mount}
              value={disk.usedPct}
              detail={`${formatBytes(disk.usedBytes)} / ${formatBytes(disk.sizeBytes)}`}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No disk data yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium break-all">{value || '–'}</dd>
    </div>
  );
}

export function SystemInfoCard({ device }) {
  const live = device.status === 'online' ? device.live : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>System</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col divide-y">
          <InfoRow label="Hostname" value={device.hostname} />
          <InfoRow label="OS" value={device.osName && `${device.osName} ${device.osVersion ?? ''}`} />
          <InfoRow label="CPU" value={device.cpuModel && `${device.cpuModel} (${device.cpuCores} threads)`} />
          <InfoRow label="Memory" value={device.totalMemBytes && formatBytes(device.totalMemBytes)} />
          <InfoRow label="Uptime" value={live && formatDuration(live.uptimeSec)} />
          <InfoRow
            label="Network"
            value={live && `↓ ${formatBitsPerSecond(live.net.rxBps)}  ↑ ${formatBitsPerSecond(live.net.txBps)}`}
          />
          <InfoRow label="Agent" value={device.agentVersion && `v${device.agentVersion}`} />
        </dl>
      </CardContent>
    </Card>
  );
}

const PROCESS_COLUMNS = [
  {
    accessorKey: 'name',
    header: 'Process',
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
  },
  {
    accessorKey: 'pid',
    header: 'PID',
    meta: { className: 'text-right tabular-nums hidden sm:table-cell' },
  },
  {
    accessorKey: 'cpu',
    header: 'CPU',
    cell: ({ getValue }) => formatPercent(getValue(), 1),
    meta: { className: 'text-right tabular-nums' },
  },
  {
    accessorKey: 'memBytes',
    header: 'Memory',
    cell: ({ getValue }) => formatBytes(getValue()),
    meta: { className: 'text-right tabular-nums' },
  },
];

export function TopProcessesCard({ processes }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top processes</CardTitle>
        <CardDescription>Highest CPU use, updates every 30 seconds</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={PROCESS_COLUMNS}
          data={processes ?? []}
          getRowId={(process) => String(process.pid)}
          initialSorting={[{ id: 'cpu', desc: true }]}
          emptyMessage="No process data yet"
        />
      </CardContent>
    </Card>
  );
}
