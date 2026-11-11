import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMe } from '@/features/auth/hooks/useMe';
import { isAdmin } from '@/features/auth/utils';
import { ChangePasswordCard } from '@/features/settings/components/ChangePasswordCard';
import { InternetSettingsCard } from '@/features/settings/components/InternetSettingsCard';
import { NetworkSettingsCard } from '@/features/settings/components/NetworkSettingsCard';
import { TelegramSettingsCard } from '@/features/settings/components/TelegramSettingsCard';
import { UsersCard } from '@/features/settings/components/UsersCard';
import { useAppSettings } from '@/features/settings/hooks/useSettings';

const ADMIN_TABS = [
  { value: 'notifications', label: 'Notifications' },
  { value: 'network', label: 'Network' },
  { value: 'users', label: 'Users' },
  { value: 'account', label: 'Account' },
];

// Loads app settings once and passes them to the admin cards.
// key: the card remounts with fresh form values after the settings change.
function AdminSettings({ tab }) {
  const { data: settings, isPending, isError, error, refetch, isRefetching } = useAppSettings();

  if (isPending) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }
  if (isError) {
    return <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  }
  if (tab === 'notifications') {
    return <TelegramSettingsCard key={JSON.stringify(settings.telegram)} settings={settings} />;
  }
  return (
    <div className="flex flex-col gap-4">
      <NetworkSettingsCard key={settings.network.scanIntervalMin} settings={settings} />
      <InternetSettingsCard key={settings.internet.speedTestIntervalMin} settings={settings} />
    </div>
  );
}

export function SettingsPage() {
  const { data: user } = useMe();
  const admin = isAdmin(user);
  const [tab, setTab] = useState(admin ? 'notifications' : 'account');

  let content;
  if (tab === 'account' || !admin) {
    content = <ChangePasswordCard />;
  } else if (tab === 'users') {
    content = <UsersCard currentUserId={user.id} />;
  } else {
    content = <AdminSettings tab={tab} />;
  }

  return (
    <>
      <PageHeader title="Settings" description="Alerts, network scan, users, and your account." />
      {admin && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {ADMIN_TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="max-w-3xl">{content}</div>
    </>
  );
}
