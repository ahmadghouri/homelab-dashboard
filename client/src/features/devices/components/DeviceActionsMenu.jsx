import { EllipsisVerticalIcon, KeyRoundIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
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
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  useDeleteDevice,
  useRegenerateDeviceToken,
  useRenameDevice,
} from '../hooks/useDeviceMutations';
import { AgentTokenDialog } from './AgentTokenDialog';

function RenameDialog({ device, open, onOpenChange }) {
  const [name, setName] = useState(device.name);
  const renameDevice = useRenameDevice();
  const nameError = renameDevice.error?.details?.name;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        renameDevice.reset();
      }}
      title="Rename device"
      isPending={renameDevice.isPending}
      error={renameDevice.isError && !nameError ? renameDevice.error.message : null}
      onSubmit={() =>
        renameDevice.mutate(
          { id: device.id, name },
          {
            onSuccess: () => {
              onOpenChange(false);
              toast.success('Device renamed');
            },
          },
        )
      }
    >
      <Field data-invalid={Boolean(nameError)}>
        <FieldLabel htmlFor="rename-device">Name</FieldLabel>
        <Input
          id="rename-device"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          autoFocus
          aria-invalid={Boolean(nameError)}
        />
        <FieldError errors={nameError?.map((message) => ({ message }))} />
      </Field>
    </FormDialog>
  );
}

// Admin actions for one device. `dialog` is which dialog is open (only one at a time).
export function DeviceActionsMenu({ device }) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const [newToken, setNewToken] = useState(null);
  const deleteDevice = useDeleteDevice();
  const regenerateToken = useRegenerateDeviceToken();

  const closeDialog = () => setDialog(null);

  const handleDelete = () =>
    deleteDevice.mutate(device.id, {
      onSuccess: () => {
        closeDialog();
        toast.success(`${device.name} removed`);
        navigate('/devices', { replace: true });
      },
      onError: (error) => toast.error(error.message),
    });

  const handleRegenerate = () =>
    regenerateToken.mutate(device.id, {
      onSuccess: (token) => {
        closeDialog();
        setNewToken(token);
      },
      onError: (error) => toast.error(error.message),
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Device actions">
            <EllipsisVerticalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('rename')}>
            <PencilIcon aria-hidden="true" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('token')}>
            <KeyRoundIcon aria-hidden="true" />
            New agent token
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
            <Trash2Icon aria-hidden="true" />
            Remove device
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'rename' && <RenameDialog device={device} open onOpenChange={closeDialog} />}

      <ConfirmDialog
        open={dialog === 'token'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Create a new agent token?"
        description={`The current token stops working and ${device.name} disconnects until you put the new token in its agent/.env.`}
        confirmLabel="Create new token"
        isPending={regenerateToken.isPending}
        onConfirm={handleRegenerate}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => !open && closeDialog()}
        title={`Remove ${device.name}?`}
        description="The device, its token, and all its saved history are deleted. This cannot be undone."
        confirmLabel="Remove device"
        destructive
        isPending={deleteDevice.isPending}
        onConfirm={handleDelete}
      />

      {newToken && (
        <AgentTokenDialog
          open
          onOpenChange={(open) => !open && setNewToken(null)}
          deviceName={device.name}
          token={newToken}
        />
      )}
    </>
  );
}
