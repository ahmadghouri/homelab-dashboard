import { useQuery } from '@tanstack/react-query';
import { deviceKeys } from '../queryKeys';

const TEN_MINUTES_MS = 10 * 60 * 1000;

// Reads the live points that useDeviceLiveUpdates writes into the cache.
// Nothing is fetched: the query only starts empty and is filled by socket events.
export function useDeviceLiveSeries(id) {
  return useQuery({
    queryKey: deviceKeys.live(id),
    queryFn: () => [],
    enabled: Boolean(id),
    staleTime: Infinity,
    gcTime: TEN_MINUTES_MS,
  });
}
