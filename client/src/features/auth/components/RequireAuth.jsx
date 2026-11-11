import { LoaderCircleIcon } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorState } from '@/components/common/ErrorState';
import { useMe } from '../hooks/useMe';

// UX guard only. The API checks auth on every request (the real security boundary).
export function RequireAuth() {
  const location = useLocation();
  const { data: user, isPending, isError, error, refetch, isRefetching } = useMe();

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center" role="status">
        <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <ErrorState
          title="Cannot reach the server"
          message={error.message}
          onRetry={() => refetch()}
          isRetrying={isRefetching}
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
