import { PauseIcon } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { formatPercent, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { formatResponseMs, uptimeClassName } from '../utils';
import { ServiceActions } from './ServiceActions';

const PAGE_SIZE = 15;
// Down first, then unknown, then up; paused services last.
const STATUS_ORDER = { down: 0, unknown: 1, up: 2 };

function statusRank(service) {
  return service.enabled ? STATUS_ORDER[service.status] ?? 1 : 3;
}

function ServiceStatus({ service }) {
  if (!service.enabled) {
    return (
      <Badge variant="secondary">
        <PauseIcon aria-hidden="true" />
        Paused
      </Badge>
    );
  }
  return <StatusBadge status={service.status} />;
}

function Uptime({ value }) {
  return <span className={cn('tabular-nums', uptimeClassName(value))}>{formatPercent(value, 1)}</span>;
}

function buildColumns({ isAdmin, selectedId, onSelect }) {
  const columns = [
    {
      id: 'status',
      header: 'Status',
      accessorFn: statusRank,
      sortFn: (a, b) => statusRank(a.original) - statusRank(b.original),
      cell: ({ row }) => <ServiceStatus service={row.original} />,
      meta: { className: 'w-24' },
    },
    {
      accessorKey: 'name',
      header: 'Service',
      cell: ({ row }) => {
        const service = row.original;
        const selected = service.id === selectedId;
        return (
          <div className="flex max-w-48 min-w-0 flex-col sm:max-w-xs lg:max-w-md">
            <button
              type="button"
              onClick={() => onSelect(service.id)}
              aria-pressed={selected}
              aria-label={`Show uptime chart for ${service.name}`}
              className={cn(
                'truncate rounded-sm text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                selected && 'text-primary underline',
              )}
            >
              {service.name}
            </button>
            <span className="truncate font-mono text-xs text-muted-foreground" title={service.target}>
              {service.type.toUpperCase()} · {service.target}
            </span>
            {service.enabled && service.status === 'down' && service.lastError && (
              <span className="truncate text-xs text-danger" title={service.lastError}>
                {service.lastError}
              </span>
            )}
            {/* On phones the number columns are hidden, so show the key ones here. */}
            <span className="text-xs text-muted-foreground md:hidden">
              {formatResponseMs(service.lastResponseMs)} · 24h <Uptime value={service.uptime24h} />
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'lastResponseMs',
      header: 'Response',
      cell: ({ getValue }) => <span className="tabular-nums">{formatResponseMs(getValue())}</span>,
      meta: { className: 'hidden md:table-cell' },
    },
    {
      accessorKey: 'uptime24h',
      header: 'Uptime 24h',
      cell: ({ getValue }) => <Uptime value={getValue()} />,
      meta: { className: 'hidden md:table-cell' },
    },
    {
      accessorKey: 'uptime7d',
      header: 'Uptime 7d',
      cell: ({ getValue }) => <Uptime value={getValue()} />,
      meta: { className: 'hidden lg:table-cell' },
    },
    {
      accessorKey: 'lastCheckedAt',
      header: 'Last checked',
      cell: ({ getValue }) => formatRelativeTime(getValue()),
      meta: { className: 'hidden sm:table-cell' },
    },
  ];

  if (isAdmin) {
    columns.push({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => <ServiceActions service={row.original} />,
      meta: { className: 'w-10 text-right' },
    });
  }
  return columns;
}

export function ServicesTable({ services, isAdmin, selectedId, onSelect }) {
  return (
    <DataTable
      columns={buildColumns({ isAdmin, selectedId, onSelect })}
      data={services}
      getRowId={(service) => service.id}
      initialSorting={[{ id: 'status', desc: false }]}
      pageSize={PAGE_SIZE}
      emptyMessage="No services yet"
    />
  );
}
