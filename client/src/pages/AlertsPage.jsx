import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMe } from '@/features/auth/hooks/useMe';
import { isAdmin } from '@/features/auth/utils';
import { AlertRulesCard } from '@/features/alerts/components/AlertRulesCard';
import { AlertsTable } from '@/features/alerts/components/AlertsTable';
import { useAlerts } from '@/features/alerts/hooks/useAlerts';

const TABS = [
  { value: 'open', label: 'Open', empty: 'No open alerts. Everything looks fine.' },
  { value: 'resolved', label: 'Resolved', empty: 'No resolved alerts yet.' },
  { value: 'all', label: 'All', empty: 'No alerts yet.' },
];

function AlertList({ status, admin }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useAlerts(status);

  if (isPending) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (isError) {
    return <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  }
  return (
    <AlertsTable
      alerts={data.alerts}
      isAdmin={admin}
      emptyMessage={TABS.find((tab) => tab.value === status).empty}
    />
  );
}

export function AlertsPage() {
  const { data: user } = useMe();
  const admin = isAdmin(user);
  const [status, setStatus] = useState('open');

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Problems found on your PCs and network. New alerts also go to Telegram when it is set up."
      />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={status} onValueChange={setStatus}>
            <TabsList>
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {/* key: a fresh table (page 1, default sort) for each tab */}
          <AlertList key={status} status={status} admin={admin} />
        </CardContent>
      </Card>
      <AlertRulesCard isAdmin={admin} />
    </>
  );
}
