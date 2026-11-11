import { useQueryClient } from '@tanstack/react-query';
import { dashboardSocket } from '@/api/socket';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import {
  applyDeviceInfo,
  applyDeviceStatus,
  applyLiveMetrics,
  removeDeviceFromCache,
} from '../cache';
import { deviceKeys } from '../queryKeys';

// Writes device socket events into the TanStack Query cache, so every
// component that reads devices updates on its own. Mounted once in AppLayout.
export function useDeviceLiveUpdates() {
  const queryClient = useQueryClient();

  useSocketEvent('device:metrics', (payload) => applyLiveMetrics(queryClient, payload));
  useSocketEvent('device:status', (payload) => applyDeviceStatus(queryClient, payload));
  useSocketEvent('device:updated', (payload) => applyDeviceInfo(queryClient, payload));
  useSocketEvent('device:deleted', ({ deviceId }) => removeDeviceFromCache(queryClient, deviceId));

  // Events may have been missed while disconnected: refetch after a reconnect.
  useSocketEvent('connect', () => {
    if (dashboardSocket.recovered) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: deviceKeys.list() });
    queryClient.invalidateQueries({ queryKey: deviceKeys.details() });
  });
}
