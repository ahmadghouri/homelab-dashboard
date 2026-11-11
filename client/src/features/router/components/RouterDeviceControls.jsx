import { ActivityIcon, EllipsisVerticalIcon, GaugeIcon, LoaderCircleIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  useBlockRouterDevice,
  useSetRouterDevicePriority,
  useTrackRouterDevice,
} from '../hooks/useRouterMutations';
import { PRIORITIES, routerDeviceName } from '../utils';
import { BlockConfirmDialog } from './BlockConfirmDialog';
import { PriorityDialog } from './PriorityDialog';

// Admin controls for one row of the router devices table (a GET /api/router/devices row).

export function TrackButton({ device }) {
  const track = useTrackRouterDevice();
  const name = routerDeviceName(device);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={track.isPending || !device.ip}
      onClick={() =>
        track.mutate(
          { id: device.networkDeviceId, tracked: true },
          {
            onSuccess: () => toast.success(`Tracking usage for ${name}`),
            onError: (error) => toast.error(error.message),
          },
        )
      }
    >
      {track.isPending ? (
        <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
      ) : (
        <ActivityIcon aria-hidden="true" />
      )}
      Track usage
    </Button>
  );
}

// Quick priority change; keeps the current speed limit.
export function PrioritySelect({ device }) {
  const update = useSetRouterDevicePriority();
  const name = routerDeviceName(device);

  const handleChange = (priority) =>
    update.mutate(
      { id: device.networkDeviceId, priority, maxMbps: device.maxMbps ?? null },
      { onError: (error) => toast.error(error.message) },
    );

  return (
    <Select value={device.priority ?? 'normal'} onValueChange={handleChange} disabled={update.isPending || !device.ip}>
      <SelectTrigger size="sm" className="w-28" aria-label={`Priority for ${name}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Blocking asks for confirmation; unblocking happens right away.
export function BlockSwitch({ device }) {
  const [confirming, setConfirming] = useState(false);
  const unblock = useBlockRouterDevice();
  const name = routerDeviceName(device);

  const handleChange = (blocked) => {
    if (blocked) {
      setConfirming(true);
      return;
    }
    unblock.mutate(
      { id: device.networkDeviceId, blocked: false },
      {
        onSuccess: () => toast.success(`${name} is unblocked`),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <>
      <Switch
        checked={device.blocked}
        onCheckedChange={handleChange}
        disabled={device.isScanner || !device.ip || unblock.isPending}
        aria-label={device.blocked ? `Unblock ${name}` : `Block ${name}`}
        className="data-checked:bg-danger"
      />
      <BlockConfirmDialog
        deviceId={device.networkDeviceId}
        name={name}
        open={confirming}
        onOpenChange={setConfirming}
      />
    </>
  );
}

export function RouterDeviceActions({ device }) {
  const [editing, setEditing] = useState(false);
  const track = useTrackRouterDevice();
  const name = routerDeviceName(device);

  const setTracked = (tracked) =>
    track.mutate(
      { id: device.networkDeviceId, tracked },
      {
        onSuccess: () => toast.success(tracked ? `Tracking usage for ${name}` : `Stopped tracking ${name}`),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Router actions for ${name}`}>
            {track.isPending ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <EllipsisVerticalIcon aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)} disabled={!device.ip}>
            <GaugeIcon aria-hidden="true" />
            Priority and speed limit
          </DropdownMenuItem>
          {device.tracked ? (
            <DropdownMenuItem onSelect={() => setTracked(false)} disabled={track.isPending}>
              <Trash2Icon aria-hidden="true" />
              Stop tracking
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setTracked(true)} disabled={track.isPending || !device.ip}>
              <ActivityIcon aria-hidden="true" />
              Track usage
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && <PriorityDialog device={device} onClose={() => setEditing(false)} />}
    </>
  );
}
