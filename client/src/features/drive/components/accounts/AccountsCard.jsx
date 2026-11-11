import { HardDriveIcon, LoaderCircleIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountMutations } from '@/features/drive/hooks/useDriveAccounts';
import { AccountRow } from './AccountRow';

function sortByPriority(accounts) {
  return [...accounts].sort(
    (a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.email.localeCompare(b.email),
  );
}

function disconnectError(error) {
  if (!error) {
    return null;
  }
  if (error.status === 409) {
    const files = error.details?.files;
    const message = /[.!?]$/.test(error.message) ? error.message : `${error.message}.`;
    const count =
      typeof files === 'number' && !message.includes(String(files))
        ? ` Files on this account: ${files}.`
        : '';
    return `${message}${count} Delete those files (and empty the trash) first, then disconnect.`;
  }
  return error.message;
}

function ConnectButton({ onConnect, isConnecting, label = 'Connect Google Drive' }) {
  return (
    <Button onClick={onConnect} disabled={isConnecting}>
      {isConnecting ? (
        <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
      ) : (
        <PlusIcon aria-hidden="true" />
      )}
      {isConnecting ? 'Waiting for Google...' : label}
    </Button>
  );
}

// The connected Google accounts in priority order (lower number first).
export function AccountsCard({ accounts, canConnect, onConnect, isConnecting }) {
  const { update, remove } = useAccountMutations();
  const [disconnecting, setDisconnecting] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
  const ordered = sortByPriority(accounts);

  // Swaps the account with its neighbour, then saves 0..n-1 for every account whose priority changed.
  const move = async (index, direction) => {
    const next = [...ordered];
    const target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    const changes = next
      .map((account, priority) => ({ id: account.id, priority }))
      .filter(({ id, priority }) => accounts.find((account) => account.id === id).priority !== priority);

    setIsReordering(true);
    try {
      await Promise.all(changes.map((change) => update.mutateAsync(change)));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsReordering(false);
    }
  };

  const closeDisconnect = () => {
    setDisconnecting(null);
    remove.reset();
  };

  const description = disconnecting
    ? [
        `The dashboard's access to ${disconnecting.email} is revoked and it is no longer used. An account that still holds Drive files cannot be disconnected.`,
        disconnectError(remove.error),
      ]
        .filter(Boolean)
        .join(' ')
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardDescription>
          Uploads are spread over these accounts. The order matters for the Priority routing mode.
        </CardDescription>
        {canConnect && accounts.length > 0 && (
          <CardAction>
            <ConnectButton onConnect={onConnect} isConnecting={isConnecting} label="Connect" />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <EmptyState
            icon={HardDriveIcon}
            title="No Drive accounts yet"
            description="Connect a Google account to start storing files. You can add more accounts later to pool their space."
            action={canConnect && <ConnectButton onConnect={onConnect} isConnecting={isConnecting} />}
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {ordered.map((account, index) => (
              <AccountRow
                key={account.id}
                account={account}
                isFirst={index === 0}
                isLast={index === ordered.length - 1}
                isReordering={isReordering}
                onMove={(direction) => move(index, direction)}
                onReconnect={onConnect}
                isReconnecting={isConnecting || !canConnect}
                onDisconnect={() => {
                  remove.reset();
                  setDisconnecting(account);
                }}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={Boolean(disconnecting)}
        onOpenChange={(open) => !open && closeDisconnect()}
        title={`Disconnect ${disconnecting?.email}?`}
        description={description}
        confirmLabel="Disconnect"
        destructive
        isPending={remove.isPending}
        onConfirm={() =>
          remove.mutate(disconnecting.id, {
            onSuccess: () => {
              toast.success(`${disconnecting.email} disconnected`);
              closeDisconnect();
            },
          })
        }
      />
    </Card>
  );
}
