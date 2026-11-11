import { NetworkIcon, SearchIcon, TriangleAlertIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const PAGE_SIZE = 15;

function PortStatus({ port }) {
  if (port.conflict) {
    return (
      <Badge className="bg-danger/15 text-danger" title={port.expectedBy ? `Expected by ${port.expectedBy}` : undefined}>
        <TriangleAlertIcon aria-hidden="true" />
        Conflict{port.expectedBy ? ` (${port.expectedBy})` : ''}
      </Badge>
    );
  }
  if (port.expectedBy) {
    return <Badge className="bg-info/15 text-info">Used by {port.expectedBy}</Badge>;
  }
  return <span className="text-muted-foreground">–</span>;
}

const COLUMNS = [
  {
    accessorKey: 'port',
    header: 'Port',
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <span className="font-mono font-medium">{row.original.port}</span>
        {/* On phones the address column is hidden, so show it here. */}
        <span className="truncate font-mono text-xs text-muted-foreground sm:hidden">{row.original.address}</span>
      </div>
    ),
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() || '–'}</span>,
    meta: { className: 'hidden sm:table-cell' },
  },
  {
    id: 'process',
    header: 'Process',
    accessorFn: (port) => port.process ?? '',
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <span className="block max-w-40 truncate" title={row.original.process || undefined}>
          {row.original.process || 'Unknown'}
        </span>
        {/* On small screens the PID column is hidden, so show it here. */}
        {row.original.pid != null && (
          <span className="font-mono text-xs text-muted-foreground md:hidden">PID {row.original.pid}</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'pid',
    header: 'PID',
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() ?? '–'}</span>,
    meta: { className: 'hidden md:table-cell' },
  },
  {
    id: 'status',
    header: 'Project',
    // Conflicts first, then ports a project expects, then the rest.
    accessorFn: (port) => (port.conflict ? 0 : port.expectedBy ? 1 : 2),
    cell: ({ row }) => <PortStatus port={row.original} />,
  },
];

// Conflicts first, then by port number. The table keeps this order until the user sorts a column.
function comparePorts(a, b) {
  if (a.conflict !== b.conflict) {
    return a.conflict ? -1 : 1;
  }
  return a.port - b.port;
}

function matchesSearch(port, term) {
  return [String(port.port), port.address, port.process, port.pid != null ? String(port.pid) : null, port.expectedBy]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(term));
}

export function PortsCard({ ports }) {
  const switchId = useId();
  const [search, setSearch] = useState('');
  const [conflictsOnly, setConflictsOnly] = useState(false);

  const allPorts = ports ?? [];
  const conflictCount = allPorts.filter((port) => port.conflict).length;
  const term = search.trim().toLowerCase();
  const visible = allPorts
    .filter((port) => (!conflictsOnly || port.conflict) && (!term || matchesSearch(port, term)))
    .sort(comparePorts);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listening ports</CardTitle>
        <CardDescription>
          TCP ports open on this PC.{' '}
          {conflictCount > 0 ? (
            <span className="font-medium text-danger">
              {conflictCount} {conflictCount === 1 ? 'conflict' : 'conflicts'}: another process holds a project&apos;s
              port.
            </span>
          ) : (
            'No port conflicts with your projects.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allPorts.length === 0 ? (
          <EmptyState
            icon={NetworkIcon}
            title="No listening ports reported"
            description="The agent has not reported any listening TCP ports for this PC yet."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search port, process, PID"
                  aria-label="Search ports"
                  className="pl-8"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch id={switchId} checked={conflictsOnly} onCheckedChange={setConflictsOnly} />
                <Label htmlFor={switchId}>Conflicts only</Label>
              </div>
            </div>
            <DataTable
              columns={COLUMNS}
              data={visible}
              getRowId={(port) => `${port.address}:${port.port}`}
              pageSize={PAGE_SIZE}
              emptyMessage={conflictsOnly && !term ? 'No port conflicts' : 'No ports match'}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
