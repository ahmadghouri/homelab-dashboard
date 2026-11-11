import { useQueryClient } from '@tanstack/react-query';
import { dashboardSocket } from '@/api/socket';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { workspaceKeys } from '../queryKeys';

// Writes workspace socket events into the query cache. Mounted once in AppLayout.
export function useWorkspaceLiveUpdates() {
  const queryClient = useQueryClient();

  // A snapshot comes from a connected agent, so the PC is online.
  useSocketEvent('workspace:update', ({ deviceId, workspace } = {}) => {
    if (!deviceId || !workspace) {
      return;
    }
    queryClient.setQueryData(workspaceKeys.detail(deviceId), (previous) => ({
      ...previous,
      workspace,
      online: true,
    }));
  });

  useSocketEvent('workspace:action', ({ action } = {}) => {
    if (action?.deviceId) {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.actions(action.deviceId) });
    }
  });

  // Events may have been missed while disconnected: refetch after a reconnect.
  useSocketEvent('connect', () => {
    if (!dashboardSocket.recovered) {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    }
  });
}
