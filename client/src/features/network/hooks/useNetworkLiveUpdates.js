import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { networkKeys } from '../queryKeys';

// Keeps the network list current. Mounted once in AppLayout.
export function useNetworkLiveUpdates() {
  const queryClient = useQueryClient();

  // A scan started (by the schedule or another user): show it as running.
  useSocketEvent('network:scan', ({ scanning }) => {
    queryClient.setQueryData(networkKeys.list(), (data) =>
      data ? { ...data, scan: { ...data.scan, scanning } } : data,
    );
  });

  // A scan finished or a device changed.
  useSocketEvent('network:update', () => {
    queryClient.invalidateQueries({ queryKey: networkKeys.list() });
  });
}
