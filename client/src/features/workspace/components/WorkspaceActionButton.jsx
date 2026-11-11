import { LoaderCircleIcon, PlayIcon, RotateCwIcon, SquareIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { useRunWorkspaceAction } from '../hooks/useWorkspaceActions';

const ACTIONS = {
  start: { label: 'Start', done: 'started', Icon: PlayIcon },
  stop: { label: 'Stop', done: 'stopped', Icon: SquareIcon },
  restart: { label: 'Restart', done: 'restarted', Icon: RotateCwIcon },
};

const TARGET_WORDS = { project: 'project', container: 'container', service: 'service' };

// What stop and restart ask before they run. Start runs right away.
function getConfirmation(action, target, name) {
  const word = TARGET_WORDS[target] ?? 'item';
  if (action === 'stop') {
    return {
      title: `Stop ${name}?`,
      description: `The ${word} stops on the PC. Anything that depends on it stops working until it is started again.`,
      confirmLabel: 'Stop',
    };
  }
  return {
    title: `Restart ${name}?`,
    description: `The ${word} stops and starts again. It is unavailable for a few seconds.`,
    confirmLabel: 'Restart',
  };
}

function showResult(log, name, action) {
  if (log.status === 'success') {
    toast.success(`${name} ${ACTIONS[action].done}`, { description: log.output || undefined });
  } else if (log.status === 'timeout') {
    toast.error(`${name}: the PC did not answer in time`);
  } else {
    toast.error(`Could not ${action} ${name}`, { description: log.output || undefined });
  }
}

// One admin action (start, stop, restart) for a project, container or OS service.
// `disabledReason` disables the button and explains why (offline, control turned off).
export function WorkspaceActionButton({ deviceId, target, id, name, action, disabledReason }) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const run = useRunWorkspaceAction();
  const { label, Icon } = ACTIONS[action];
  const needsConfirm = action !== 'start';
  const confirmation = getConfirmation(action, target, name);

  const execute = () =>
    run.mutate(
      { deviceId, target, id, action },
      {
        onSuccess: (log) => {
          setIsConfirmOpen(false);
          showResult(log, name, action);
        },
        onError: (error) => {
          setIsConfirmOpen(false);
          toast.error(`Could not ${action} ${name}`, { description: error.message });
        },
      },
    );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={Boolean(disabledReason) || run.isPending}
        title={disabledReason || undefined}
        aria-label={`${label} ${name}`}
        onClick={() => (needsConfirm ? setIsConfirmOpen(true) : execute())}
      >
        {run.isPending ? (
          <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
        ) : (
          <Icon aria-hidden="true" />
        )}
        {label}
      </Button>

      {needsConfirm && (
        <ConfirmDialog
          open={isConfirmOpen}
          onOpenChange={(open) => !open && !run.isPending && setIsConfirmOpen(false)}
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={confirmation.confirmLabel}
          destructive
          isPending={run.isPending}
          onConfirm={execute}
        />
      )}
    </>
  );
}

// The buttons that make sense for a state: start when not running, stop and restart when running.
export function WorkspaceActionButtons({ isRunning, ...props }) {
  const actions = isRunning ? ['stop', 'restart'] : ['start'];
  return actions.map((action) => <WorkspaceActionButton key={action} action={action} {...props} />);
}
