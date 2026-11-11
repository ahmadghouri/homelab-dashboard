import { useQueryClient } from '@tanstack/react-query';
import { dashboardSocket } from '@/api/socket';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { mergeServiceIntoCache, removeServiceFromCache } from '../cache';
import { serviceKeys } from '../queryKeys';

// Writes service socket events into the query cache. Mounted once in AppLayout.
export function useServiceLiveUpdates() {
  const queryClient = useQueryClient();

  // Sent after every check.
  useSocketEvent('service:update', ({ service }) => {
    if (!service) {
      return;
    }
    // Unknown service (added by another user): load the list with its uptime numbers.
    if (!mergeServiceIntoCache(queryClient, service)) {
      queryClient.invalidateQueries({ queryKey: serviceKeys.list() });
    }
  });

  useSocketEvent('service:deleted', ({ serviceId }) => removeServiceFromCache(queryClient, serviceId));

  // Events may have been missed while disconnected: refetch after a reconnect.
  useSocketEvent('connect', () => {
    if (!dashboardSocket.recovered) {
      queryClient.invalidateQueries({ queryKey: serviceKeys.list() });
    }
  });
}
