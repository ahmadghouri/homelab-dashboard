import {
  EllipsisVerticalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCheckService, useDeleteService, useUpdateService } from '../hooks/useServiceMutations';
import { ServiceFormDialog } from './ServiceFormDialog';

// Admin actions for one service.
export function ServiceActions({ service }) {
  const [dialog, setDialog] = useState(null);
  const check = useCheckService();
  const update = useUpdateService();
  const remove = useDeleteService();
  const busy = check.isPending || update.isPending;

  const handleCheck = () =>
    check.mutate(service.id, {
      onSuccess: (checked) =>
        checked.status === 'up'
          ? toast.success(`${checked.name} is up`)
          : toast.error(`${checked.name} is down${checked.lastError ? `: ${checked.lastError}` : ''}`),
      onError: (error) => toast.error(error.message),
    });

  const setEnabled = (enabled) =>
    update.mutate(
      { id: service.id, enabled },
      {
        onSuccess: () => toast.success(enabled ? `${service.name} resumed` : `${service.name} paused`),
        onError: (error) => toast.error(error.message),
      },
    );

  const handleDelete = () =>
    remove.mutate(service.id, {
      onSuccess: () => {
        setDialog(null);
        toast.success(`${service.name} deleted`);
      },
      onError: (error) => toast.error(error.message),
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${service.name}`}>
            {check.isPending ? (
              <RefreshCwIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <EllipsisVerticalIcon aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleCheck} disabled={busy}>
            <RefreshCwIcon aria-hidden="true" />
            Check now
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('edit')}>
            <PencilIcon aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          {service.enabled ? (
            <DropdownMenuItem onSelect={() => setEnabled(false)} disabled={busy}>
              <PauseIcon aria-hidden="true" />
              Pause
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setEnabled(true)} disabled={busy}>
              <PlayIcon aria-hidden="true" />
              Resume
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
            <Trash2Icon aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'edit' && <ServiceFormDialog service={service} onClose={() => setDialog(null)} />}

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Delete ${service.name}?`}
        description="Checks stop and its uptime history is deleted. Open alerts for it are closed."
        confirmLabel="Delete"
        destructive
        isPending={remove.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
