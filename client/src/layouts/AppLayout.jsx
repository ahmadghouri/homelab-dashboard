import { Outlet, useLocation } from 'react-router';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AlertBell } from '@/features/alerts/components/AlertBell';
import { useAlertLiveUpdates } from '@/features/alerts/hooks/useAlertLiveUpdates';
import { useDeviceLiveUpdates } from '@/features/devices/hooks/useDeviceLiveUpdates';
import { UploadPanel } from '@/features/drive/components/UploadPanel';
import { useDriveLiveUpdates } from '@/features/drive/hooks/useDriveLiveUpdates';
import { UploadProvider } from '@/features/drive/hooks/useUploads';
import { useInternetLiveUpdates } from '@/features/internet/hooks/useInternetLiveUpdates';
import { useMultiLinkLiveUpdates } from '@/features/multilink/hooks/useMultiLinkLiveUpdates';
import { useNetworkLiveUpdates } from '@/features/network/hooks/useNetworkLiveUpdates';
import { useServiceLiveUpdates } from '@/features/services/hooks/useServiceLiveUpdates';
import { useWorkspaceLiveUpdates } from '@/features/workspace/hooks/useWorkspaceLiveUpdates';
import { useDashboardSocket } from '@/hooks/useDashboardSocket';
import { AppSidebar } from './AppSidebar';
import { findNavItem } from './navItems';

export function AppLayout() {
  const { pathname } = useLocation();
  // Live updates run for the whole logged-in app and stop on logout (unmount).
  useDashboardSocket();
  useDeviceLiveUpdates();
  useNetworkLiveUpdates();
  useInternetLiveUpdates();
  useServiceLiveUpdates();
  useWorkspaceLiveUpdates();
  useMultiLinkLiveUpdates();
  useDriveLiveUpdates();
  useAlertLiveUpdates();
  // Sub-pages without their own sidebar link get a more specific title here.
  const pageTitle =
    { '/network/map': 'Network map', '/drive/accounts': 'Drive accounts' }[pathname] ??
    findNavItem(pathname)?.title ??
    '';

  // UploadProvider wraps the layout so Drive uploads keep running while navigating.
  return (
    <UploadProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-center"
            />
            <span className="text-sm font-medium">{pageTitle}</span>
            <div className="ml-auto flex items-center gap-1">
              <AlertBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
        <UploadPanel />
      </SidebarProvider>
    </UploadProvider>
  );
}
