import { CheckCheckIcon, CheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { useAcknowledgeAlert, useResolveAlert } from '../hooks/useAlertMutations';

const PAGE_SIZE = 20;

export function SeverityBadge({ severity }) {
  return severity === 'critical' ? (
    <Badge className="bg-danger/15 text-danger">Critical</Badge>
  ) : (
    <Badge className="bg-warning/15 text-warning">Warning</Badge>
  );
}

function AlertStatus({ alert }) {
  if (alert.status === 'resolved') {
    return (
      <div className="flex flex-col">
        <span className="text-success">Resolved</span>
        <span className="text-xs text-muted-foreground">{alert.resolvedReason}</span>
      </div>
    );
  }
  return alert.acknowledged ? (
    <span className="text-muted-foreground">Seen</span>
  ) : (
    <span className="font-medium text-danger">Open</span>
  );
}

function AlertActions({ alert }) {
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();
  const onError = (error) => toast.error(error.message);

  if (alert.status === 'resolved') {
    return null;
  }
  return (
    <div className="flex justify-end gap-1">
      {!alert.acknowledged && (
        <Button
          variant="ghost"
          size="sm"
          disabled={acknowledge.isPending}
          onClick={() => acknowledge.mutate(alert.id, { onError })}
        >
          <CheckIcon aria-hidden="true" />
          Seen
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={resolve.isPending}
        onClick={() => resolve.mutate(alert.id, { onError })}
      >
        <CheckCheckIcon aria-hidden="true" />
        Resolve
      </Button>
    </div>
  );
}

function buildColumns(isAdmin) {
  const columns = [
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ getValue }) => <SeverityBadge severity={getValue()} />,
    },
    {
      accessorKey: 'title',
      header: 'Alert',
      cell: ({ row }) => (
        <div className="flex max-w-md min-w-48 flex-col gap-0.5 whitespace-normal">
          <span className="font-medium">{row.original.title}</span>
          <span className="text-xs text-muted-foreground">{row.original.message}</span>
          {row.original.notifyError && (
            <span className="text-xs text-danger">Telegram: {row.original.notifyError}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'When',
      cell: ({ getValue }) => <span title={formatDateTime(getValue())}>{formatRelativeTime(getValue())}</span>,
      meta: { className: 'hidden sm:table-cell' },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <AlertStatus alert={row.original} />,
    },
  ];
  if (isAdmin) {
    columns.push({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => <AlertActions alert={row.original} />,
      meta: { className: 'text-right' },
    });
  }
  return columns;
}

export function AlertsTable({ alerts, isAdmin, emptyMessage }) {
  return (
    <DataTable
      columns={buildColumns(isAdmin)}
      data={alerts}
      getRowId={(alert) => alert.id}
      initialSorting={[{ id: 'createdAt', desc: true }]}
      pageSize={PAGE_SIZE}
      emptyMessage={emptyMessage}
    />
  );
}
