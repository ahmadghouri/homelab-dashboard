import { CloudIcon, DatabaseIcon, HardDriveIcon, UsersIcon } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { formatBytes } from '@/lib/format';

// Pooled storage of every connected account (from the accounts summary).
export function StorageTotals({ summary, isLoading }) {
  const unlimited = summary && summary.totalBytes == null;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        title="Total space"
        icon={CloudIcon}
        isLoading={isLoading}
        value={unlimited ? 'Unlimited' : formatBytes(summary?.totalBytes)}
      />
      <StatCard title="Used" icon={DatabaseIcon} isLoading={isLoading} value={formatBytes(summary?.usedBytes)} />
      <StatCard
        title="Free"
        icon={HardDriveIcon}
        isLoading={isLoading}
        value={summary?.freeBytes == null ? (unlimited ? 'Unlimited' : '–') : formatBytes(summary.freeBytes)}
      />
      <StatCard
        title="Accounts"
        icon={UsersIcon}
        isLoading={isLoading}
        value={summary ? `${summary.connected ?? 0} / ${summary.accounts ?? 0}` : '–'}
        description="Connected / total"
      />
    </div>
  );
}
