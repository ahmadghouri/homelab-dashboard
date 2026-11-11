import { BatteryChargingIcon, BatteryIcon, CpuIcon, MemoryStickIcon, ThermometerIcon } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { formatBytes, formatPercent, formatTemperature } from '@/lib/format';

export function DeviceLiveStats({ live }) {
  const BatteryStatusIcon = live?.battery?.charging ? BatteryChargingIcon : BatteryIcon;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard title="CPU" icon={CpuIcon} value={formatPercent(live?.cpu)} />
      <StatCard
        title="RAM"
        icon={MemoryStickIcon}
        value={formatPercent(live?.mem.usedPct)}
        description={
          live ? `${formatBytes(live.mem.usedBytes)} of ${formatBytes(live.mem.totalBytes)}` : null
        }
      />
      <StatCard
        title="CPU temperature"
        icon={ThermometerIcon}
        value={formatTemperature(live?.tempC)}
        description={live && live.tempC === null ? 'Needs admin rights on Windows' : null}
      />
      <StatCard
        title="Battery"
        icon={BatteryStatusIcon}
        value={live?.battery ? formatPercent(live.battery.percent) : 'N/A'}
        description={live?.battery ? (live.battery.charging ? 'Charging' : 'On battery') : 'No battery'}
      />
    </div>
  );
}
