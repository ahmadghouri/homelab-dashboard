import { ArrowDownIcon, ArrowUpIcon, PlugIcon, RefreshCwIcon, UnplugIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/common/StatusBadge';
import { UsageBar } from '@/components/common/UsageBar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAccountMutations } from '@/features/drive/hooks/useDriveAccounts';
import { formatBytes, formatRelativeTime } from '@/lib/format';

const STATUS_BADGE = {
  connected: { status: 'ok', label: 'Connected' },
  error: { status: 'critical', label: 'Needs reconnect' },
  disconnected: { status: 'offline', label: 'Disconnected' },
};

function Avatar({ account }) {
  // Remembers which URL failed, so a new avatarUrl after a sync is tried again.
  const [failedUrl, setFailedUrl] = useState(null);
  const initial = (account.displayName || account.email || '?').charAt(0).toUpperCase();
  if (account.avatarUrl && account.avatarUrl !== failedUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(account.avatarUrl)}
        className="size-10 shrink-0 rounded-full bg-muted object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground"
    >
      {initial}
    </span>
  );
}

function QuotaBar({ account }) {
  const { totalBytes, usedBytes } = account.quota ?? {};
  const reserved = account.reservedBytes > 0 ? `, ${formatBytes(account.reservedBytes)} reserved` : '';

  if (totalBytes == null) {
    return (
      <p className="text-sm text-muted-foreground">
        {formatBytes(usedBytes ?? 0)} used of unlimited storage{reserved}
      </p>
    );
  }
  const percent = totalBytes > 0 ? Math.min(100, ((usedBytes ?? 0) / totalBytes) * 100) : 0;
  return (
    <UsageBar
      label="Storage"
      value={percent}
      detail={`${formatBytes(usedBytes ?? 0)} of ${formatBytes(totalBytes)}${reserved}`}
    />
  );
}

// One connected Google account: status, quota and the admin actions.
// onMove(direction) reorders the priority list; onDisconnect opens the confirmation.
export function AccountRow({ account, isFirst, isLast, isReordering, onMove, onReconnect, isReconnecting, onDisconnect }) {
  const { update, sync } = useAccountMutations();
  const badge = STATUS_BADGE[account.status] ?? { status: 'unknown', label: account.status };
  const name = account.displayName || account.email;
  const switchId = `accept-uploads-${account.id}`;

  const toggleUploads = (acceptUploads) =>
    update.mutate(
      { id: account.id, acceptUploads },
      {
        onSuccess: () =>
          toast.success(acceptUploads ? `${account.email} takes new uploads` : `${account.email} takes no new uploads`),
        onError: (error) => toast.error(error.message),
      },
    );

  const syncNow = () =>
    sync.mutate(account.id, {
      onSuccess: () => toast.success(`${account.email} synced`),
      onError: (error) => toast.error(error.message),
    });

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Avatar account={account} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{name}</span>
          {account.displayName && <span className="truncate text-sm text-muted-foreground">{account.email}</span>}
        </div>
        <StatusBadge status={badge.status}>{badge.label}</StatusBadge>
      </div>

      {account.status !== 'connected' && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{account.lastError || 'This account cannot be used until it is reconnected.'}</span>
          <Button size="sm" variant="outline" onClick={onReconnect} disabled={isReconnecting}>
            <PlugIcon aria-hidden="true" />
            Reconnect
          </Button>
        </div>
      )}

      <QuotaBar account={account} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Switch
            id={switchId}
            checked={account.acceptUploads}
            disabled={update.isPending}
            onCheckedChange={toggleUploads}
          />
          <label htmlFor={switchId} className="text-sm">
            Accept uploads
          </label>
        </div>
        <span className="text-xs text-muted-foreground">
          Synced {account.lastSyncedAt ? formatRelativeTime(account.lastSyncedAt) : 'never'}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(-1)}
            disabled={isFirst || isReordering}
            aria-label={`Move ${account.email} up in priority`}
          >
            <ArrowUpIcon aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(1)}
            disabled={isLast || isReordering}
            aria-label={`Move ${account.email} down in priority`}
          >
            <ArrowDownIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={syncNow}
            disabled={sync.isPending || account.status !== 'connected'}
            aria-label={`Sync ${account.email} now`}
          >
            <RefreshCwIcon className={sync.isPending ? 'animate-spin' : undefined} aria-hidden="true" />
            Sync now
          </Button>
          <Button variant="destructive" size="sm" onClick={onDisconnect} aria-label={`Disconnect ${account.email}`}>
            <UnplugIcon aria-hidden="true" />
            Disconnect
          </Button>
        </div>
      </div>
    </li>
  );
}
