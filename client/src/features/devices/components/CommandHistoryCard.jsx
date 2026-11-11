import { TerminalIcon } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { useDeviceCommands } from '../hooks/useDeviceCommands';

const PAGE_SIZE = 10;

const COMMAND_LABELS = {
  lock: 'Lock',
  restart: 'Restart',
  shutdown: 'Shut down',
  cancel_shutdown: 'Cancel shutdown',
};

// Command log status mapped onto the shared StatusBadge tones.
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
    accessorKey: 'command',
    header: 'Command',
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">{COMMAND_LABELS[row.original.command] ?? row.original.command}</span>
        {/* On small screens the user and output columns are hidden, so show them here. */}
        <span className="text-xs text-muted-foreground sm:hidden">by {row.original.userName}</span>
        {row.original.output && (
          <span className="max-w-56 truncate text-xs text-muted-foreground md:hidden" title={row.original.output}>
            {row.original.output}
          </span>
        )}
      </div>
    ),
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

function CommandHistoryContent({ deviceId }) {
  const { data: commands, isPending, isError, error, refetch, isRefetching } = useDeviceCommands(deviceId);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading command history">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Could not load the command history"
        message={error.message}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
      />
    );
  }

  if (commands.length === 0) {
    return (
      <EmptyState
        icon={TerminalIcon}
        title="No commands yet"
        description="Lock, restart, and shutdown requests sent from the Power menu show up here."
      />
    );
  }

  return (
    <DataTable
      columns={COLUMNS}
      data={commands}
      getRowId={(command) => command.id}
      initialSorting={[{ id: 'createdAt', desc: true }]}
      pageSize={PAGE_SIZE}
    />
  );
}

export function CommandHistoryCard({ deviceId }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Command history</CardTitle>
        <CardDescription>
          Remote commands only run on a PC whose agent has{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">REMOTE_COMMANDS=on</code> in its{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">agent/.env</code>. They are off by
          default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CommandHistoryContent deviceId={deviceId} />
      </CardContent>
    </Card>
  );
}
