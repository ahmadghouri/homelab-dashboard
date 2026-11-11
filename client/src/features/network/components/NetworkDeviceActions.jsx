import {
  BanIcon,
  CircleCheckIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormDialog } from '@/components/common/FormDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { BlockConfirmDialog } from '@/features/router/components/BlockConfirmDialog';
import { useRouterDevices } from '@/features/router/hooks/useRouterDevices';
import { useBlockRouterDevice } from '@/features/router/hooks/useRouterMutations';
import { useRouterStatus } from '@/features/router/hooks/useRouterStatus';
import { useForgetNetworkDevice, useUpdateNetworkDevice } from '../hooks/useNetworkMutations';
import { networkDeviceName } from '../utils';

function RenameDialog({ device, onClose }) {
  const [name, setName] = useState(device.customName ?? '');
  const update = useUpdateNetworkDevice();
  const nameError = update.error?.details?.customName;

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Name this device"
      description={`${device.ip} · ${device.mac}`}
      isPending={update.isPending}
      error={update.isError && !nameError ? update.error.message : null}
      onSubmit={() =>
        update.mutate(
          { id: device.id, customName: name },
          {
            onSuccess: () => {
              onClose();
              toast.success('Name saved');
            },
          },
        )
      }
    >
      <Field data-invalid={Boolean(nameError)}>
        <FieldLabel htmlFor="network-device-name">Name</FieldLabel>
        <Input
          id="network-device-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={networkDeviceName({ ...device, customName: '' })}
          maxLength={60}
          autoFocus
        />
        <FieldDescription>Leave empty to use the detected name.</FieldDescription>
        <FieldError errors={nameError?.map((message) => ({ message }))} />
      </Field>
    </FormDialog>
  );
}

// Router block state for one network device. Undefined while unknown or when no router is
// configured, so the menu items stay hidden. Never offered for the server itself.
function useRouterBlockState(device) {
  const { data: routerStatus } = useRouterStatus();
  const routerReady = Boolean(routerStatus?.configured && routerStatus.reachable);
  const { data: routerDevices } = useRouterDevices({ enabled: routerReady && !device.isScanner });
  if (!routerReady || device.isScanner || !device.ip || !routerDevices) {
    return undefined;
  }
  return routerDevices.find((item) => item.networkDeviceId === device.id)?.blocked ?? false;
}

export function NetworkDeviceActions({ device }) {
  const [dialog, setDialog] = useState(null);
  const update = useUpdateNetworkDevice();
  const forget = useForgetNetworkDevice();
  const unblock = useBlockRouterDevice();
  const blocked = useRouterBlockState(device);
  const name = networkDeviceName(device);

  const setTrusted = (trusted) =>
    update.mutate(
      { id: device.id, trusted },
      {
        onSuccess: () => toast.success(trusted ? `${name} marked as trusted` : `${name} marked as unknown`),
        onError: (error) => toast.error(error.message),
      },
    );

  const handleForget = () =>
    forget.mutate(device.id, {
      onSuccess: () => {
        setDialog(null);
        toast.success(`${name} removed from the list`);
      },
      onError: (error) => toast.error(error.message),
    });

  const handleUnblock = () =>
    unblock.mutate(
      { id: device.id, blocked: false },
      {
        onSuccess: () => toast.success(`${name} is unblocked on the router`),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
            <EllipsisVerticalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('rename')}>
            <PencilIcon aria-hidden="true" />
            Rename
          </DropdownMenuItem>
          {device.trusted ? (
            <DropdownMenuItem onSelect={() => setTrusted(false)} disabled={device.isScanner}>
              <ShieldOffIcon aria-hidden="true" />
              Mark as unknown
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setTrusted(true)}>
              <ShieldCheckIcon aria-hidden="true" />
              Mark as trusted
            </DropdownMenuItem>
          )}
          {blocked === true && (
            <DropdownMenuItem onSelect={handleUnblock} disabled={unblock.isPending}>
              <CircleCheckIcon aria-hidden="true" />
              Unblock on router
            </DropdownMenuItem>
          )}
          {blocked === false && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog('block')}>
              <BanIcon aria-hidden="true" />
              Block on router
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDialog('forget')}
            disabled={device.isScanner}
          >
            <Trash2Icon aria-hidden="true" />
            Forget
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'rename' && <RenameDialog device={device} onClose={() => setDialog(null)} />}

      {blocked !== undefined && (
        <BlockConfirmDialog
          deviceId={device.id}
          name={name}
          open={dialog === 'block'}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={dialog === 'forget'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Forget ${name}?`}
        description="It is removed from the list. If it is still on the network, the next scan finds it again as a new, unknown device."
        confirmLabel="Forget"
        destructive
        isPending={forget.isPending}
        onConfirm={handleForget}
      />
    </>
  );
}
