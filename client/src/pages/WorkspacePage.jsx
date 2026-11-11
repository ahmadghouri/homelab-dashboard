import { HourglassIcon, MonitorIcon, MonitorOffIcon, ShieldOffIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/useMe';
import { isAdmin } from '@/features/auth/utils';
import { useDevices } from '@/features/devices/hooks/useDevices';
import { ActionHistoryCard } from '@/features/workspace/components/ActionHistoryCard';
import { ContainersCard } from '@/features/workspace/components/ContainersCard';
import { OsServicesCard } from '@/features/workspace/components/OsServicesCard';
import { PortsCard } from '@/features/workspace/components/PortsCard';
import { ProjectsCard } from '@/features/workspace/components/ProjectsCard';
import { WorkspaceSetupHelp } from '@/features/workspace/components/WorkspaceSetupHelp';
import { useWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const TITLE = 'Workspace';
const DESCRIPTION = 'Projects, containers, services and ports on your development PC.';

const NOTICE_TONES = {
  danger: 'border-danger/30 bg-danger/5 [&>svg]:text-danger',
  warning: 'border-warning/30 bg-warning/5 [&>svg]:text-warning',
};

function Notice({ tone, icon: Icon, title, children }) {
  return (
    <div role="status" className={cn('flex gap-3 rounded-xl border p-4', NOTICE_TONES[tone])}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <p className="font-medium">{title}</p>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function DeviceSelect({ devices, value, onChange }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <Label htmlFor="workspace-device" className="shrink-0">
        PC
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="workspace-device" className="w-full sm:w-56">
          <SelectValue placeholder="Choose a PC" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device) => (
            <SelectItem key={device.id} value={device.id}>
              {device.name}
              {device.status !== 'online' && ' (offline)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LoadingCards() {
  return (
    <>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </>
  );
}

function WorkspaceContent({ device }) {
  const { data: user } = useMe();
  const { data, isPending, isError, error, refetch, isRefetching } = useWorkspace(device.id);
  const admin = isAdmin(user);

  if (isPending) {
    return <LoadingCards />;
  }
  if (isError) {
    return <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  }

  const { workspace } = data;
  const online = data.online && device.status === 'online';

  if (!workspace) {
    return online ? (
      <EmptyState
        icon={HourglassIcon}
        title="Waiting for the agent"
        description={`${device.name} is online but has not sent its workspace yet. It arrives within 10 seconds; if it never does, update the agent on the PC to the latest version.`}
      />
    ) : (
      <EmptyState
        icon={MonitorOffIcon}
        title={`${device.name} is offline`}
        description="Start the agent on the PC to see its projects, containers and services."
      />
    );
  }

  const offlineReason = online ? null : 'The PC is offline.';
  const disabledReason =
    offlineReason ?? (workspace.controlEnabled ? null : 'Workspace control is turned off on this PC.');
  const cardProps = {
    deviceId: device.id,
    isAdmin: admin,
    disabledReason,
    // The log dialog explains "control is off" itself, so only an offline PC disables it.
    logsDisabledReason: offlineReason,
  };

  return (
    <>
      {!online && (
        <Notice tone="danger" icon={MonitorOffIcon} title={`${device.name} is offline`}>
          This is the last known state, from {formatRelativeTime(workspace.at)}. Actions come back when the agent
          reconnects.
        </Notice>
      )}
      {online && !workspace.controlEnabled && (
        <Notice tone="warning" icon={ShieldOffIcon} title="Workspace control is turned off on this PC">
          The status is shown, but start, stop, restart and logs are refused. To allow them, set{' '}
          <code className="font-mono">WORKSPACE_CONTROL=on</code> in <code className="font-mono">agent/.env</code> on
          the PC and restart the agent.
        </Notice>
      )}
      {(!workspace.configFound || workspace.configError) && (
        <WorkspaceSetupHelp configFound={workspace.configFound} configError={workspace.configError} />
      )}
      <ProjectsCard projects={workspace.projects} {...cardProps} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <ContainersCard containers={workspace.containers} {...cardProps} />
        <OsServicesCard
          services={workspace.services}
          deviceId={device.id}
          isAdmin={admin}
          disabledReason={disabledReason}
        />
      </div>
      <PortsCard ports={workspace.ports} />
      <ActionHistoryCard deviceId={device.id} />
      <p className="text-xs text-muted-foreground">Updated {formatRelativeTime(workspace.at)}.</p>
    </>
  );
}

export function WorkspacePage() {
  const { data: devices, isPending, isError, error, refetch, isRefetching } = useDevices();
  const [searchParams, setSearchParams] = useSearchParams();

  if (isPending) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <LoadingCards />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />
      </>
    );
  }

  if (devices.length === 0) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <EmptyState
          icon={MonitorIcon}
          title="No PCs yet"
          description="Add a PC and run the agent on it to manage its projects here."
          action={
            <Button asChild>
              <Link to="/devices">Go to Devices</Link>
            </Button>
          }
        />
      </>
    );
  }

  // The URL keeps the choice; without one (or an unknown id) take the first online PC.
  const device =
    devices.find((item) => item.id === searchParams.get('device')) ??
    devices.find((item) => item.status === 'online') ??
    devices[0];

  const selectDevice = (id) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('device', id);
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <StatusBadge status={device.status === 'online' ? 'online' : 'offline'} />
            <DeviceSelect devices={devices} value={device.id} onChange={selectDevice} />
          </div>
        }
      />
      {/* Keyed so dialogs and local state reset when another PC is chosen. */}
      <WorkspaceContent key={device.id} device={device} />
    </>
  );
}
