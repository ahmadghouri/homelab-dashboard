import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useBlockRouterDevice } from '../hooks/useRouterMutations';

// Confirms blocking a device on the router. Used by the Router page and the Network page menu.
// deviceId: the NetworkDevice id.
export function BlockConfirmDialog({ deviceId, name, open, onOpenChange }) {
  const block = useBlockRouterDevice();

  const handleConfirm = () =>
    block.mutate(
      { id: deviceId, blocked: true },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success(`${name} is blocked on the router`);
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Block ${name} on the router?`}
      description="The router drops all its traffic to the internet and other networks until you unblock it. It stays connected to Wi-Fi, so it may look online but nothing loads."
      confirmLabel="Block"
      destructive
      isPending={block.isPending}
      onConfirm={handleConfirm}
    />
  );
}
