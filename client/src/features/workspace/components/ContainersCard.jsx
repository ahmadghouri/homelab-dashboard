import { ContainerIcon, FileTextIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogViewerDialog } from './LogViewerDialog';
import { WorkspaceActionButtons } from './WorkspaceActionButton';

// Docker states (running, exited, created, paused, restarting, dead) mapped onto StatusBadge tones.
const STATE_TONES = {
  running: 'ok',
  restarting: 'warning',
  paused: 'warning',
  exited: 'unknown',
  created: 'unknown',
  dead: 'down',
};

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown';
}

function ContainerRow({ container, deviceId, isAdmin, disabledReason, logsDisabledReason, onOpenLogs }) {
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{container.name}</span>
          <StatusBadge status={STATE_TONES[container.state] ?? 'unknown'}>{capitalize(container.state)}</StatusBadge>
        </div>
        <p className="truncate text-xs text-muted-foreground" title={container.image}>
          {container.image} · {container.status}
        </p>
        {container.ports && (
          <p className="truncate font-mono text-xs text-muted-foreground" title={container.ports}>
            {container.ports}
          </p>
        )}
      </div>
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <WorkspaceActionButtons
            deviceId={deviceId}
            target="container"
            id={container.id}
            name={container.name}
            isRunning={container.state === 'running'}
            disabledReason={disabledReason}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(logsDisabledReason)}
            title={logsDisabledReason || undefined}
            aria-label={`Logs of ${container.name}`}
            onClick={() => onOpenLogs(container)}
          >
            <FileTextIcon aria-hidden="true" />
            Logs
          </Button>
        </div>
      )}
    </li>
  );
}

function ContainersContent({ containers, ...rowProps }) {
  if (!containers?.available) {
    return (
      <EmptyState
        icon={ContainerIcon}
        title="Docker is not installed or not running"
        description={
          containers?.error
            ? `The agent says: ${containers.error}. Start Docker Desktop (or the Docker service) and this list fills in by itself.`
            : 'Start Docker Desktop (or the Docker service) and this list fills in by itself.'
        }
      />
    );
  }
  if (containers.items.length === 0) {
    return (
      <EmptyState
        icon={ContainerIcon}
        title="No containers"
        description="Docker is running, but there are no containers on this PC."
      />
    );
  }
  return (
    <ul className="divide-y">
      {containers.items.map((container) => (
        <ContainerRow key={container.id} container={container} {...rowProps} />
      ))}
    </ul>
  );
}

// Docker containers on the PC (running and stopped). Actions and logs are admin only.
export function ContainersCard({ deviceId, containers, isAdmin, disabledReason, logsDisabledReason }) {
  // `logs` keeps the last container so the dialog text does not change while it closes.
  const [logs, setLogs] = useState(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const items = containers?.available ? containers.items : [];
  const running = items.filter((container) => container.state === 'running').length;

  const openLogs = (container) => {
    setLogs(container);
    setIsLogsOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Containers</CardTitle>
        <CardDescription>
          {items.length ? `${running} of ${items.length} running.` : 'Docker containers on the PC.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ContainersContent
          containers={containers}
          deviceId={deviceId}
          isAdmin={isAdmin}
          disabledReason={disabledReason}
          logsDisabledReason={logsDisabledReason}
          onOpenLogs={openLogs}
        />
      </CardContent>
      {logs && (
        <LogViewerDialog
          deviceId={deviceId}
          target="container"
          id={logs.id}
          name={logs.name}
          open={isLogsOpen}
          onOpenChange={setIsLogsOpen}
        />
      )}
    </Card>
  );
}
