import { HistoryIcon } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { useWorkspaceActions } from '../hooks/useWorkspaceActions';

const PAGE_SIZE = 10;

const TARGET_LABELS = {
  project: 'Project',
  container: 'Container',
  service: 'Service',
};

const ACTION_LABELS = {
  start: 'Start',
  stop: 'Stop',
  restart: 'Restart',
};

// Action log status mapped onto the shared StatusBadge tones.
const RESULT_BADGES = {
  success: { status: 'ok', label: 'Success' },
  failed: { status: 'down', label: 'Failed' },
  timeout: { status: 'warning', label: 'No answer' },
  pending: { status: 'unknown', label: 'Pending' },
};

function ResultBadge({ status }) {
  const badge = RESULT_BADGES[status] ?? RESULT_BADGES.pending;
  return <StatusBadge status={badge.status}>{badge.label}</StatusBadge>;
}

const COLUMNS = [
  {
    id: 'what',
    header: 'What',
    accessorFn: (log) => log.targetName || log.targetId,
    cell: ({ row }) => {
      const log = row.original;
      return (
        <div className="flex min-w-0 flex-col">
          <span className="block max-w-48 truncate font-medium" title={log.targetName || log.targetId}>
            {log.targetName || log.targetId}
          </span>
          <span className="text-xs text-muted-foreground">
            {TARGET_LABELS[log.target] ?? log.target}
            {/* On phones the action and user columns are hidden, so show them here. */}
            <span className="sm:hidden">
              {' · '}
              {ACTION_LABELS[log.action] ?? log.action} by {log.userName}
            </span>
          </span>
          {log.output && (
            <span className="max-w-56 truncate font-mono text-xs text-muted-foreground md:hidden" title={log.output}>
              {log.output}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ getValue }) => ACTION_LABELS[getValue()] ?? getValue(),
    meta: { className: 'hidden sm:table-cell' },
  },
  {
    accessorKey: 'userName',
    header: 'By',
    meta: { className: 'hidden sm:table-cell' },
  },
  {
    accessorKey: 'createdAt',
    header: 'When',
    cell: ({ getValue }) => (
      <time dateTime={getValue()} title={formatDateTime(getValue())} className="whitespace-nowrap">
        {formatRelativeTime(getValue())}
      </time>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Result',
    cell: ({ getValue }) => <ResultBadge status={getValue()} />,
  },
  {
    accessorKey: 'output',
    header: 'Output',
    enableSorting: false,
    meta: { className: 'hidden md:table-cell' },
    cell: ({ getValue }) => (
      <span className="block max-w-80 truncate font-mono text-xs" title={getValue() || undefined}>
        {getValue() || '–'}
      </span>
    ),
  },
];

function ActionHistoryContent({ deviceId }) {
  const { data: actions, isPending, isError, error, refetch, isRefetching } = useWorkspaceActions(deviceId);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading action history">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Could not load the action history"
        message={error.message}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
      />
    );
  }

  if (actions.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="No actions yet"
        description="Start, stop, and restart requests for projects, containers, and services show up here."
      />
    );
  }

  return (
    <DataTable
      columns={COLUMNS}
      data={actions}
      getRowId={(log) => log.id}
      initialSorting={[{ id: 'createdAt', desc: true }]}
      pageSize={PAGE_SIZE}
    />
  );
}

export function ActionHistoryCard({ deviceId }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Action history</CardTitle>
        <CardDescription>The last 50 workspace actions on this PC, by any admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <ActionHistoryContent deviceId={deviceId} />
      </CardContent>
    </Card>
  );
}
