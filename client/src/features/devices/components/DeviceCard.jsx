import { BatteryChargingIcon, BatteryIcon, ClockIcon, ThermometerIcon } from 'lucide-react';
import { Link } from 'react-router';
import { StatusBadge } from '@/components/common/StatusBadge';
import { UsageBar } from '@/components/common/UsageBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatDuration,
  formatPercent,
  formatRelativeTime,
  formatTemperature,
} from '@/lib/format';
import { fullestDisk } from '../utils';

function DeviceFooter({ device }) {
  const { live } = device;

  if (device.status !== 'online' || !live) {
    return (
      <span className="flex items-center gap-1">
        <ClockIcon className="size-3.5" aria-hidden="true" />
        Last seen {formatRelativeTime(device.lastSeenAt)}
      </span>
    );
  }

  const BatteryStatusIcon = live.battery?.charging ? BatteryChargingIcon : BatteryIcon;
  return (
    <>
      <span className="flex items-center gap-1" title="Uptime">
        <ClockIcon className="size-3.5" aria-hidden="true" />
        Up {formatDuration(live.uptimeSec)}
      </span>
      <span className="flex items-center gap-1" title="CPU temperature">
        <ThermometerIcon className="size-3.5" aria-hidden="true" />
        {formatTemperature(live.tempC)}
      </span>
      {live.battery && (
        <span className="flex items-center gap-1" title="Battery">
          <BatteryStatusIcon className="size-3.5" aria-hidden="true" />
          {formatPercent(live.battery.percent)}
        </span>
      )}
    </>
  );
}

export function DeviceCard({ device }) {
  const live = device.status === 'online' ? device.live : null;
  const disk = fullestDisk(live?.disks);

  return (
    <Card className="transition-colors hover:border-ring/60">
      <Link
        to={`/devices/${device.id}`}
        className="flex flex-col gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
      >
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="truncate">{device.name}</CardTitle>
            <CardDescription className="truncate">
              {device.hostname ? `${device.hostname} · ${device.osName}` : 'Waiting for the agent'}
            </CardDescription>
          </div>
          <StatusBadge status={device.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <UsageBar label="CPU" value={live?.cpu} />
          <UsageBar label="RAM" value={live?.mem.usedPct} />
          <UsageBar label={disk ? `Disk ${disk.mount}` : 'Disk'} value={disk?.usedPct} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
            <DeviceFooter device={device} />
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
