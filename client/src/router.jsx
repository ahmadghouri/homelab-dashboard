import { createBrowserRouter } from 'react-router';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OverviewPage } from '@/pages/OverviewPage';

// Pages other than the Overview load only when opened, so the first load stays small.
// load: () => import('@/pages/XPage'); exportName: the named export of that module.
function lazyPage(load, exportName) {
  return async () => {
    const module = await load();
    return { Component: module[exportName] };
  };
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Public share links and the OAuth popup landing page work without the app layout.
  { path: '/s/:token', lazy: lazyPage(() => import('@/pages/PublicSharePage'), 'PublicSharePage') },
  {
    path: '/drive/connected',
    lazy: lazyPage(() => import('@/pages/DriveConnectedPage'), 'DriveConnectedPage'),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'devices', lazy: lazyPage(() => import('@/pages/DevicesPage'), 'DevicesPage') },
          {
            path: 'devices/:id',
            lazy: lazyPage(() => import('@/pages/DeviceDetailPage'), 'DeviceDetailPage'),
          },
          { path: 'network', lazy: lazyPage(() => import('@/pages/NetworkPage'), 'NetworkPage') },
          {
            path: 'network/map',
            lazy: lazyPage(() => import('@/pages/NetworkMapPage'), 'NetworkMapPage'),
          },
          { path: 'internet', lazy: lazyPage(() => import('@/pages/InternetPage'), 'InternetPage') },
          { path: 'services', lazy: lazyPage(() => import('@/pages/ServicesPage'), 'ServicesPage') },
          {
            path: 'workspace',
            lazy: lazyPage(() => import('@/pages/WorkspacePage'), 'WorkspacePage'),
          },
          { path: 'router', lazy: lazyPage(() => import('@/pages/RouterPage'), 'RouterPage') },
          {
            path: 'multilink',
            lazy: lazyPage(() => import('@/pages/MultiLinkPage'), 'MultiLinkPage'),
          },
          { path: 'drive', lazy: lazyPage(() => import('@/pages/DrivePage'), 'DrivePage') },
          {
            path: 'drive/accounts',
            lazy: lazyPage(() => import('@/pages/DriveAccountsPage'), 'DriveAccountsPage'),
          },
          { path: 'alerts', lazy: lazyPage(() => import('@/pages/AlertsPage'), 'AlertsPage') },
          { path: 'settings', lazy: lazyPage(() => import('@/pages/SettingsPage'), 'SettingsPage') },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
