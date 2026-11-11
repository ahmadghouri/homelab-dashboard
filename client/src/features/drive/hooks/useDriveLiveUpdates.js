import { useQueryClient } from '@tanstack/react-query';
import { dashboardSocket } from '@/api/socket';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { driveKeys } from '../queryKeys';

// Keeps the Drive caches current when other users or jobs change things. Mounted once in AppLayout.
export function useDriveLiveUpdates() {
  const queryClient = useQueryClient();

  const refreshContent = () => {
    queryClient.invalidateQueries({ queryKey: driveKeys.content() });
    queryClient.invalidateQueries({ queryKey: driveKeys.summary() });
  };

  // Files or folders changed (upload, move, rename, trash, restore, purge).
  useSocketEvent('storage:files', refreshContent);

  // Accounts connected, removed or their quota synced.
  useSocketEvent('storage:accounts', () => {
    queryClient.invalidateQueries({ queryKey: driveKeys.accounts() });
    queryClient.invalidateQueries({ queryKey: driveKeys.summary() });
  });

  // Events may have been missed while disconnected: refetch after a reconnect.
  useSocketEvent('connect', () => {
    if (!dashboardSocket.recovered) {
      refreshContent();
      queryClient.invalidateQueries({ queryKey: driveKeys.accounts() });
    }
  });
}
