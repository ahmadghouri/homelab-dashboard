import { CircleCheckIcon, CircleXIcon, GlobeIcon, PauseIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/useMe';
import { isAdmin } from '@/features/auth/utils';
import { ServiceFormDialog } from '@/features/services/components/ServiceFormDialog';
import { ServiceHistoryCard } from '@/features/services/components/ServiceHistoryCard';
import { ServicesTable } from '@/features/services/components/ServicesTable';
import { useServices } from '@/features/services/hooks/useServices';

const EXAMPLES = [
  'Router admin page: http://192.168.1.1',
  'Website: https://example.com',
  'MongoDB: tcp 127.0.0.1:27017',
];

function ServicesEmptyState({ admin, onAdd }) {
  return (
    <EmptyState
      icon={GlobeIcon}
      title="No services yet"
      description={
        <>
          Add a website or a TCP port to check if it is up. For example:
          <span className="mt-2 flex flex-col gap-0.5 font-mono text-xs">
            {EXAMPLES.map((example) => (
              <span key={example}>{example}</span>
            ))}
          </span>
        </>
      }
      action={
        admin ? (
          <Button onClick={onAdd}>
            <PlusIcon aria-hidden="true" />
            Add service
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Ask an admin to add one.</p>
        )
      }
    />
  );
}

export function ServicesPage() {
  const { data: user } = useMe();
  const { data: services, isPending, isError, error, refetch, isRefetching } = useServices();
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const admin = isAdmin(user);

  const header = (
    <PageHeader
      title="Services"
      description="Websites and TCP ports checked on a schedule."
      actions={
        admin && (
          <Button onClick={() => setAdding(true)}>
            <PlusIcon aria-hidden="true" />
            Add service
          </Button>
        )
      }
    />
  );
  const addDialog = adding && <ServiceFormDialog onClose={() => setAdding(false)} />;

  if (isPending) {
    return (
      <>
        {header}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {['total', 'up', 'down', 'paused'].map((key) => (
            <Skeleton key={key} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        {header}
        <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />
      </>
    );
  }

  if (services.length === 0) {
    return (
      <>
        {header}
        <ServicesEmptyState admin={admin} onAdd={() => setAdding(true)} />
        {addDialog}
      </>
    );
  }

  const active = services.filter((service) => service.enabled);
  const up = active.filter((service) => service.status === 'up').length;
  const down = active.filter((service) => service.status === 'down').length;
  // Fall back to the first service when nothing is selected or the selection was deleted.
  const selected = services.find((service) => service.id === selectedId) ?? services[0];

  return (
    <>
      {header}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Services" icon={GlobeIcon} value={services.length} />
        <StatCard title="Up" icon={CircleCheckIcon} value={up} />
        <StatCard
          title="Down"
          icon={CircleXIcon}
          value={down}
          description={down ? 'Check the list below' : 'Nothing is down'}
        />
        <StatCard title="Paused" icon={PauseIcon} value={services.length - active.length} />
      </div>
      <Card>
        <CardContent>
          <ServicesTable
            services={services}
            isAdmin={admin}
            selectedId={selected.id}
            onSelect={setSelectedId}
          />
        </CardContent>
      </Card>
      {/* Keyed so the range and the placeholder data reset when another service is selected. */}
      <ServiceHistoryCard key={selected.id} service={selected} />
      {addDialog}
    </>
  );
}
