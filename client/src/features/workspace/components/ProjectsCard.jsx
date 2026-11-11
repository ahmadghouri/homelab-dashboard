import { FileTextIcon, FolderCodeIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDuration } from '@/lib/format';
import { LogViewerDialog } from './LogViewerDialog';
import { WorkspaceActionButtons } from './WorkspaceActionButton';

// Project status mapped onto the shared StatusBadge tones.
const STATUS_BADGES = {
  running: { status: 'ok', label: 'Running' },
  external: { status: 'warning', label: 'External' },
  crashed: { status: 'down', label: 'Crashed' },
  stopped: { status: 'unknown', label: 'Stopped' },
};

const TYPE_LABELS = { node: 'Node.js', laravel: 'Laravel', python: 'Python', other: 'Other' };

function uptimeSeconds(startedAt) {
  return startedAt ? Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 1000) : null;
}

function ProjectDetails({ project }) {
  const details = [
    TYPE_LABELS[project.type] ?? project.type,
    project.port ? `Port ${project.port}` : null,
    project.status === 'running' ? `Up ${formatDuration(uptimeSeconds(project.startedAt))}` : null,
    project.pid ? `PID ${project.pid}` : null,
    project.restarts ? `${project.restarts} ${project.restarts === 1 ? 'restart' : 'restarts'}` : null,
    project.status === 'crashed' && project.exitCode !== null ? `Exit code ${project.exitCode}` : null,
  ].filter(Boolean);

  return <p className="text-xs text-muted-foreground">{details.join(' · ')}</p>;
}

function ProjectRow({ project, deviceId, isAdmin, disabledReason, logsDisabledReason, onOpenLogs }) {
  const badge = STATUS_BADGES[project.status] ?? STATUS_BADGES.stopped;

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{project.name}</span>
          <StatusBadge status={badge.status}>{badge.label}</StatusBadge>
          {project.errorCount > 0 && (
            <Badge className="bg-danger/15 text-danger">
              {project.errorCount} {project.errorCount === 1 ? 'error' : 'errors'} in the log
            </Badge>
          )}
        </div>
        <ProjectDetails project={project} />
        {project.status === 'external' && (
          <p className="text-xs text-muted-foreground">
            Its port is in use, but the agent did not start it, so it cannot be stopped from here.
          </p>
        )}
      </div>
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          {project.status !== 'external' && (
            <WorkspaceActionButtons
              deviceId={deviceId}
              target="project"
              id={project.id}
              name={project.name}
              isRunning={project.status === 'running'}
              disabledReason={disabledReason}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(logsDisabledReason)}
            title={logsDisabledReason || undefined}
            aria-label={`Logs of ${project.name}`}
            onClick={() => onOpenLogs(project)}
          >
            <FileTextIcon aria-hidden="true" />
            Logs
          </Button>
        </div>
      )}
    </li>
  );
}

// Projects from workspace.json with their status. Actions and logs are admin only.
export function ProjectsCard({ deviceId, projects, isAdmin, disabledReason, logsDisabledReason }) {
  // `logs` keeps the last project so the dialog text does not change while it closes.
  const [logs, setLogs] = useState(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const running = projects.filter((project) => project.status === 'running').length;

  const openLogs = (project) => {
    setLogs(project);
    setIsLogsOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        <CardDescription>
          {projects.length
            ? `${running} of ${projects.length} running. Defined in workspace.json on the PC.`
            : 'Defined in workspace.json on the PC.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderCodeIcon}
            title="No projects yet"
            description="Add your projects to the projects list in workspace.json. The agent reloads the file by itself."
          />
        ) : (
          <ul className="divide-y">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                deviceId={deviceId}
                isAdmin={isAdmin}
                disabledReason={disabledReason}
                logsDisabledReason={logsDisabledReason}
                onOpenLogs={openLogs}
              />
            ))}
          </ul>
        )}
      </CardContent>
      {logs && (
        <LogViewerDialog
          deviceId={deviceId}
          target="project"
          id={logs.id}
          name={logs.name}
          open={isLogsOpen}
          onOpenChange={setIsLogsOpen}
        />
      )}
    </Card>
  );
}
