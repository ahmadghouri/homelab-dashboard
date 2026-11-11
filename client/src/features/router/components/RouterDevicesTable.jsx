import { ArrowDownIcon, ArrowUpIcon, BanIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { compareIp } from '@/features/network/utils';
import { formatBytes } from '@/lib/format';
import { formatRate, priorityLabel, routerDeviceName, totalBytes } from '../utils';
import { BlockSwitch, PrioritySelect, RouterDeviceActions, TrackButton } from './RouterDeviceControls';

const PAGE_SIZE = 15;

function Rates({ device }) {
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums">
      <span className="inline-flex items-center gap-1">
        <ArrowDownIcon className="size-3 text-info" aria-label="Download" />
        {formatRate(device.rxBps)}
      </span>
      <span className="inline-flex items-center gap-1">
        <ArrowUpIcon className="size-3 text-success" aria-label="Upload" />
        {formatRate(device.txBps)}
      </span>
    </span>
  );
}

function Usage({ device, isAdmin }) {
  if (device.tracked) {
    return <Rates device={device} />;
  }
  if (isAdmin && !device.isScanner) {
    return <TrackButton device={device} />;
  }
  return <span className="text-xs text-muted-foreground">Not tracked</span>;
}

function DeviceCell({ device, isAdmin }) {
  const name = routerDeviceName(device);
  const total = totalBytes(device);
  return (
    <div className="flex max-w-44 min-w-0 flex-col gap-0.5 sm:max-w-xs">
      <span className="truncate font-medium" title={name}>
        {name}
        {device.isScanner && (
          <Badge variant="secondary" className="ml-2">
            Server
          </Badge>
        )}
      </span>
      <span className="truncate font-mono text-xs text-muted-foreground">{device.ip || 'No IP address'}</span>
      {/* Phones hide the usage and priority columns, so show the key facts here. */}
      <span className="flex flex-col gap-1 md:hidden">
        <span className="sm:hidden">
          <Usage device={device} isAdmin={isAdmin} />
        </span>
        {device.tracked && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatBytes(total)} · {priorityLabel(device.priority)} priority
            {device.maxMbps ? ` · max ${device.maxMbps} Mbps` : ''}
          </span>
        )}
      </span>
    </div>
  );
}

function PriorityCell({ device, isAdmin }) {
  return (
    <div className="flex flex-col gap-1">
      {isAdmin ? (
        <PrioritySelect device={device} />
      ) : (
        <span>{priorityLabel(device.priority)}</span>
      )}
      {device.maxMbps ? (
        <span className="text-xs text-muted-foreground tabular-nums">Max {device.maxMbps} Mbps</span>
      ) : null}
    </div>
  );
}

function BlockedCell({ device, isAdmin }) {
  if (isAdmin) {
    return <BlockSwitch device={device} />;
  }
  return device.blocked ? (
    <Badge className="bg-danger/15 text-danger">
      <BanIcon aria-hidden="true" />
      Blocked
    </Badge>
  ) : (
    <span className="text-xs text-muted-foreground">No</span>
  );
}

function buildColumns(isAdmin) {
  const columns = [
    {
      id: 'name',
      header: 'Device',
      accessorFn: (device) => routerDeviceName(device),
      cell: ({ row }) => <DeviceCell device={row.original} isAdmin={isAdmin} />,
    },
    {
      id: 'rate',
      header: 'Now',
      accessorFn: (device) => (device.rxBps ?? -1) + (device.txBps ?? 0),
      cell: ({ row }) => <Usage device={row.original} isAdmin={isAdmin} />,
      meta: { className: 'hidden sm:table-cell' },
    },
    {
      id: 'total',
      header: 'Total',
      accessorFn: (device) => totalBytes(device) ?? -1,
      cell: ({ row }) => <span className="tabular-nums">{formatBytes(totalBytes(row.original))}</span>,
      meta: { className: 'hidden md:table-cell' },
    },
    {
      id: 'ip',
      header: 'IP address',
      accessorKey: 'ip',
      sortFn: (a, b) => compareIp(a.original.ip, b.original.ip),
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() || '–'}</span>,
      meta: { className: 'hidden xl:table-cell' },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => <PriorityCell device={row.original} isAdmin={isAdmin} />,
      meta: { className: 'hidden md:table-cell' },
    },
    {
      accessorKey: 'blocked',
      header: 'Blocked',
      sortFn: (a, b) => Number(b.original.blocked) - Number(a.original.blocked),
      cell: ({ row }) => <BlockedCell device={row.original} isAdmin={isAdmin} />,
      meta: { className: 'w-20' },
    },
  ];

  if (isAdmin) {
    columns.push({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (row.original.isScanner ? null : <RouterDeviceActions device={row.original} />),
      meta: { className: 'w-10 text-right' },
    });
  }
  return columns;
}

// devices: GET /api/router/devices rows (rates in bits per second). Presentational: controls own their mutations.
export function RouterDevicesTable({ devices, isAdmin }) {
  const [search, setSearch] = useState('');
  const [trackedOnly, setTrackedOnly] = useState(false);

  const term = search.trim().toLowerCase();
  const visible = devices.filter((device) => {
    if (trackedOnly && !device.tracked) {
      return false;
    }
    if (!term) {
      return true;
    }
    return [device.name, device.ip, device.mac]
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
            placeholder="Search name, IP, MAC"
            aria-label="Search router devices"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="router-tracked-only" checked={trackedOnly} onCheckedChange={setTrackedOnly} />
          <Label htmlFor="router-tracked-only">Tracked only</Label>
        </div>
      </div>
      <DataTable
        columns={buildColumns(isAdmin)}
        data={visible}
        getRowId={(device) => device.networkDeviceId}
        initialSorting={[{ id: 'total', desc: true }]}
        pageSize={PAGE_SIZE}
        emptyMessage={term || trackedOnly ? 'No devices match' : 'No devices found yet. Run a network scan first.'}
      />
    </div>
  );
}
