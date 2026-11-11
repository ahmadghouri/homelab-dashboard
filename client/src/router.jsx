import { createBrowserRouter } from 'react-router';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { AppLayout } from '@/layouts/AppLayout';
import { NAV_ITEMS } from '@/layouts/navItems';
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { DevicesPage } from '@/pages/DevicesPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OverviewPage } from '@/pages/OverviewPage';

// Pages not built yet use ComingSoonPage. Replace each one as its milestone is done.
const comingSoonRoutes = NAV_ITEMS.filter((item) => item.milestone).map((item) => ({
  path: item.path,
  element: <ComingSoonPage {...item} />,
}));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'devices', element: <DevicesPage /> },
          {
            path: 'devices/:id',
            // Charts are large, so this page loads only when opened.
            lazy: async () => {
              const { DeviceDetailPage } = await import('@/pages/DeviceDetailPage');
              return { Component: DeviceDetailPage };
            },
          },
          ...comingSoonRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
