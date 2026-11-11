import { BanIcon, ChevronDownIcon, LockIcon, PowerIcon, RotateCcwIcon } from 'lucide-react';
import { useId, useState } from 'react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSendDeviceCommand } from '../hooks/useDeviceCommands';

// What each command asks before it is sent. Restart and shutdown wait 60 s on the PC.
function getConfirmation(command, deviceName) {
  switch (command) {
    case 'lock':
      return {
        title: `Lock ${deviceName}?`,
        description: 'The screen locks right away. Anyone at the PC needs the password to sign in again.',
        confirmLabel: 'Lock',
      };
    case 'restart':
      return {
        title: `Restart ${deviceName}?`,
        description:
          'The PC restarts in 60 seconds. Unsaved work on it is lost. You can stop it with Cancel shutdown before then.',
        confirmLabel: 'Restart',
        destructive: true,
      };
    case 'shutdown':
      return {
        title: `Shut down ${deviceName}?`,
        description:
          'The PC shuts down in 60 seconds and goes offline until someone turns it on. You can stop it with Cancel shutdown before then.',
        confirmLabel: 'Shut down',
        destructive: true,
      };
    default:
      return {
        title: `Cancel the pending shutdown on ${deviceName}?`,
        description: 'Stops a restart or shutdown that is still counting down.',
        confirmLabel: 'Cancel shutdown',
      };
  }
}

const OFFLINE_HINT = 'The PC is offline. Power actions need a connected agent.';

// Admin-only "Power" menu on the device page. Each action asks for confirmation first.
export function DevicePowerActions({ device }) {
  // `command` keeps the last choice so the dialog text does not change while it closes.
  const [command, setCommand] = useState('lock');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const sendCommand = useSendDeviceCommand();
  const hintId = useId();
  const isOnline = device.status === 'online';
  const confirmation = getConfirmation(command, device.name);

  const choose = (nextCommand) => {
    setCommand(nextCommand);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () =>
    sendCommand.mutate(
      { id: device.id, command },
      {
        onSuccess: (log) => {
          setIsConfirmOpen(false);
          if (log.status === 'success') {
            toast.success(log.output || 'Command sent');
          } else if (log.status === 'timeout') {
            toast.error('The PC did not answer in time');
          } else {
            toast.error(log.output || 'The command failed');
          }
        },
        onError: (error) => {
          setIsConfirmOpen(false);
          toast.error(error.message);
        },
      },
    );

  const trigger = (
    <Button
      variant="outline"
      disabled={!isOnline}
      aria-describedby={isOnline ? undefined : hintId}
    >
      <PowerIcon aria-hidden="true" />
      Power
      <ChevronDownIcon aria-hidden="true" />
    </Button>
  );

  return (
    <>
      {isOnline ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => choose('lock')}>
              <LockIcon aria-hidden="true" />
              Lock
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => choose('cancel_shutdown')}>
              <BanIcon aria-hidden="true" />
              Cancel shutdown
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => choose('restart')}>
              <RotateCcwIcon aria-hidden="true" />
              Restart
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => choose('shutdown')}>
              <PowerIcon aria-hidden="true" />
              Shut down
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        // A disabled button gets no pointer or focus events, so the tooltip sits on a focusable wrapper.
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex rounded-md">
              {trigger}
              <span id={hintId} className="sr-only">
                {OFFLINE_HINT}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{OFFLINE_HINT}</TooltipContent>
        </Tooltip>
      )}

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={(open) => !open && !sendCommand.isPending && setIsConfirmOpen(false)}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        destructive={confirmation.destructive}
        isPending={sendCommand.isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
