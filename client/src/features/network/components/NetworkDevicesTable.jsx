import { CircleIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { compareIp, networkDeviceName } from '../utils';
import { NetworkDeviceActions } from './NetworkDeviceActions';

const PAGE_SIZE = 15;

function buildColumns(isAdmin) {
  const columns = [
    {
      id: 'name',
      header: 'Device',
      accessorFn: (device) => networkDeviceName(device),
      cell: ({ row }) => {
        const device = row.original;
        const name = networkDeviceName(device);
        const detail = device.randomizedMac ? 'Private (random) MAC' : (device.vendor ?? 'Unknown vendor');
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <CircleIcon
              className={cn('size-2.5 shrink-0', device.online ? 'fill-success text-success' : 'fill-muted-foreground/40 text-muted-foreground/40')}
              aria-label={device.online ? 'Online' : 'Offline'}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">
                {name}
                {device.isScanner && (
                  <Badge variant="secondary" className="ml-2">
                    Server
                  </Badge>
                )}
              </span>
              {/* Skip the second line when it would repeat the name. */}
              {detail !== name && (
                <span className="truncate text-xs text-muted-foreground">{detail}</span>
              )}
              {/* On phones the IP column is hidden, so show the IP here. */}
              <span className="font-mono text-xs text-muted-foreground sm:hidden">{device.ip}</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'ip',
      header: 'IP address',
      sortFn: (a, b) => compareIp(a.original.ip, b.original.ip),
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
      meta: { className: 'hidden sm:table-cell' },
    },
    {
      accessorKey: 'mac',
      header: 'MAC',
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
      meta: { className: 'hidden lg:table-cell' },
    },
    {
      accessorKey: 'trusted',
      header: 'Trust',
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge className="bg-success/15 text-success">Trusted</Badge>
        ) : (
          <Badge className="bg-warning/15 text-warning">Unknown</Badge>
        ),
    },
    {
      accessorKey: 'lastSeenAt',
      header: 'Last seen',
      cell: ({ row }) =>
        row.original.online ? (
          <span className="text-success">Now</span>
        ) : (
          formatRelativeTime(row.original.lastSeenAt)
        ),
      meta: { className: 'hidden sm:table-cell' },
    },
  ];

  if (isAdmin) {
    columns.push({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => <NetworkDeviceActions device={row.original} />,
      meta: { className: 'w-10 text-right' },
    });
  }
  return columns;
}

export function NetworkDevicesTable({ devices, isAdmin }) {
  const [search, setSearch] = useState('');
  const [unknownOnly, setUnknownOnly] = useState(false);

  const term = search.trim().toLowerCase();
  const visible = devices.filter((device) => {
    if (unknownOnly && device.trusted) {
      return false;
    }
    if (!term) {
      return true;
    }
    return [networkDeviceName(device), device.ip, device.mac, device.vendor, device.hostname]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term));
  });

  return (
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
            placeholder="Search name, IP, MAC, vendor"
            aria-label="Search devices"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="unknown-only" checked={unknownOnly} onCheckedChange={setUnknownOnly} />
          <Label htmlFor="unknown-only">Unknown only</Label>
        </div>
      </div>
      <DataTable
        columns={buildColumns(isAdmin)}
        data={visible}
        getRowId={(device) => device.id}
        initialSorting={[{ id: 'ip', desc: false }]}
        pageSize={PAGE_SIZE}
        emptyMessage={term || unknownOnly ? 'No devices match' : 'No devices found yet'}
      />
    </div>
  );
}
