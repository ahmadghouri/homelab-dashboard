import { CogIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkspaceActionButtons } from './WorkspaceActionButton';

const STATUS_BADGES = {
  running: { status: 'ok', label: 'Running' },
  stopped: { status: 'down', label: 'Stopped' },
  not_found: { status: 'warning', label: 'Not found' },
  unknown: { status: 'unknown', label: 'Unknown' },
};

function ServiceRow({ service, deviceId, isAdmin, disabledReason }) {
  const badge = STATUS_BADGES[service.status] ?? STATUS_BADGES.unknown;
  // Only a known state can be changed: a missing or unreadable service has nothing to start.
  const canAct = service.status === 'running' || service.status === 'stopped';

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{service.name}</span>
          <StatusBadge status={badge.status}>{badge.label}</StatusBadge>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">{service.serviceName}</span>
          {service.port ? ` · Port ${service.port}` : ''}
        </p>
        {service.status === 'not_found' && (
          <p className="text-xs text-muted-foreground">
            No service with this name exists on the PC. Check serviceName in workspace.json.
          </p>
        )}
      </div>
      {isAdmin && canAct && (
        <div className="flex flex-wrap gap-2">
          <WorkspaceActionButtons
            deviceId={deviceId}
            target="service"
            id={service.id}
            name={service.name}
            isRunning={service.status === 'running'}
            disabledReason={disabledReason}
          />
        </div>
      )}
    </li>
  );
}

// OS services listed in workspace.json (Windows services or systemd units).
export function OsServicesCard({ deviceId, services, isAdmin, disabledReason }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>OS services</CardTitle>
        <CardDescription>
          {isAdmin
            ? 'On Windows, starting and stopping services only works when the agent runs as administrator.'
            : 'Services such as databases, defined in workspace.json on the PC.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <EmptyState
            icon={CogIcon}
            title="No OS services yet"
            description="Add services (for example MongoDB) to the services list in workspace.json."
          />
        ) : (
          <ul className="divide-y">
            {services.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                deviceId={deviceId}
                isAdmin={isAdmin}
                disabledReason={disabledReason}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
