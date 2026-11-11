import { ArrowLeftIcon, ShieldAlertIcon } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/useMe';
import { isAdmin } from '@/features/auth/utils';
import { AccountsCard } from '@/features/drive/components/accounts/AccountsCard';
import { GoogleSetupGuide } from '@/features/drive/components/accounts/GoogleSetupGuide';
import { RoutingCard } from '@/features/drive/components/accounts/RoutingCard';
import { StorageTotals } from '@/features/drive/components/accounts/StorageTotals';
import { useConnectDrivePopup } from '@/features/drive/components/accounts/useConnectDrivePopup';
import { useDriveAccounts, useDriveSetup } from '@/features/drive/hooks/useDriveAccounts';

function AdminDriveAccounts() {
  const setup = useDriveSetup();
  const accounts = useDriveAccounts();
  const { connect, isConnecting } = useConnectDrivePopup();

  if (setup.isPending || accounts.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (setup.isError || accounts.isError) {
    const failed = setup.isError ? setup : accounts;
    return <ErrorState message={failed.error.message} onRetry={() => failed.refetch()} isRetrying={failed.isRefetching} />;
  }

  const { googleConfigured, redirectUri } = setup.data;
  const list = accounts.data.accounts;

  if (!googleConfigured && list.length === 0) {
    return <GoogleSetupGuide redirectUri={redirectUri} />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {!googleConfigured && <GoogleSetupGuide redirectUri={redirectUri} />}
      <StorageTotals summary={accounts.data.summary} />
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AccountsCard accounts={list} canConnect={googleConfigured} onConnect={connect} isConnecting={isConnecting} />
        <RoutingCard />
      </div>
    </div>
  );
}

export function DriveAccountsPage() {
  const { data: user } = useMe();
  const admin = isAdmin(user);

  return (
    <>
      <PageHeader
        title="Drive accounts"
        description="Connect Google Drive accounts and pool their space into one file store."
        actions={
          <Button variant="outline" asChild>
            <Link to="/drive">
              <ArrowLeftIcon aria-hidden="true" />
              Back to Drive
            </Link>
          </Button>
        }
      />
      {admin ? (
        <AdminDriveAccounts />
      ) : (
        <EmptyState
          icon={ShieldAlertIcon}
          title="Admins only"
          description="Only an admin can connect Drive accounts or change how uploads are stored. Ask an admin if you need more space or access."
        />
      )}
    </>
  );
}
