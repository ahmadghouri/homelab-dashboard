import { useQueryClient } from '@tanstack/react-query';
import { dashboardSocket } from '@/api/socket';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { multiLinkKeys } from '../queryKeys';
import { appendThroughputPoint } from './useThroughputHistory';

// Writes Multi-Link socket events into the query cache. Mounted once in AppLayout.
export function useMultiLinkLiveUpdates() {
  const queryClient = useQueryClient();

  // A snapshot comes from a connected agent, so the PC is online.
  useSocketEvent('multilink:update', ({ deviceId, multilink } = {}) => {
    if (!deviceId || !multilink) {
      return;
    }
    // Without a cached detail the settings are unknown: the page fetches the full response itself.
    queryClient.setQueryData(multiLinkKeys.detail(deviceId), (previous) =>
      previous ? { ...previous, multilink, online: true } : previous,
    );
    appendThroughputPoint(queryClient, deviceId, multilink);
  });

  useSocketEvent('device:deleted', ({ deviceId } = {}) => {
    if (deviceId) {
      queryClient.removeQueries({ queryKey: multiLinkKeys.detail(deviceId) });
      queryClient.removeQueries({ queryKey: multiLinkKeys.history(deviceId) });
    }
  });

  // Events may have been missed while disconnected: refetch after a reconnect.
  // Only the server data: the client-only history would be emptied by a refetch.
  useSocketEvent('connect', () => {
    if (!dashboardSocket.recovered) {
      queryClient.invalidateQueries({ queryKey: multiLinkKeys.details() });
    }
  });
}
