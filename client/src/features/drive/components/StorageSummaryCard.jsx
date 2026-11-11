import { HardDriveIcon, TriangleAlertIcon } from 'lucide-react';
import { Link } from 'react-router';
import { UsageBar } from '@/components/common/UsageBar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/format';
import { useDriveAccounts } from '../hooks/useDriveAccounts';
import { useDriveSummary } from '../hooks/useDriveSummary';

function NoAccountsNotice({ isAdmin }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      {isAdmin ? (
        <span>
          No Google Drive account is connected, so uploads cannot be stored yet.{' '}
          <Link to="/drive/accounts" className="font-medium underline underline-offset-4">
            Connect an account
          </Link>
        </span>
      ) : (
        <span>No storage is connected yet. Ask an admin to connect a Google Drive account.</span>
      )}
    </p>
  );
}

// Used / total space across every connected Drive account, plus the file count.
export function StorageSummaryCard({ isAdmin }) {
  const { data: summary, isPending, isError } = useDriveSummary();
  const { data: accounts } = useDriveAccounts();
  const connected = accounts?.summary?.connected;

  if (isError) {
    return null;
  }

  const total = summary?.totalBytes ?? null;
  const used = summary?.usedBytes ?? 0;
  const usedPct = total ? Math.min(100, (used / total) * 100) : null;
  const detail = total ? `${formatBytes(used)} of ${formatBytes(total)}` : `${formatBytes(used)} used`;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground sm:w-44 sm:shrink-0">
              <HardDriveIcon className="size-4" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground tabular-nums">{summary.fileCount ?? 0}</span>{' '}
                {summary.fileCount === 1 ? 'file' : 'files'}
                {total === null && used > 0 && ' · unlimited space'}
              </span>
            </div>
            {usedPct === null ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{formatBytes(used)}</span> used
                {summary.freeBytes != null && ` · ${formatBytes(summary.freeBytes)} free`}
              </p>
            ) : (
              <UsageBar label="Storage used" value={usedPct} detail={detail} className="flex-1" />
            )}
          </div>
        )}
        {connected === 0 && <NoAccountsNotice isAdmin={isAdmin} />}
      </CardContent>
    </Card>
  );
}
