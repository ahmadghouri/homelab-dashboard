import { Navigate, useLocation, useNavigate } from 'react-router';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { useMe } from '@/features/auth/hooks/useMe';
import { APP_ICON as AppIcon, APP_NAME } from '@/layouts/navItems';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useMe();
  const redirectTo = location.state?.from ?? '/';

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <AppIcon className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">{APP_NAME} Dashboard</CardTitle>
          <CardDescription>Sign in to monitor your PCs, network, and servers.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm onSuccess={() => navigate(redirectTo, { replace: true })} />
        </CardContent>
      </Card>
    </div>
  );
}
