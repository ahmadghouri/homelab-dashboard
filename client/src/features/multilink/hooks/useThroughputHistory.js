import { useQuery } from '@tanstack/react-query';
import { multiLinkKeys } from '../queryKeys';

const TEN_MINUTES_MS = 10 * 60 * 1000;

// About 5 minutes of points at one snapshot every 5 seconds.
export const THROUGHPUT_POINTS_LIMIT = 60;

// Turns a snapshot into one chart point: { at, totals, lines: [{ id, rxBps, txBps }] }.
export function toThroughputPoint(multilink) {
  return {
    at: multilink.at,
    totals: multilink.totals,
    lines: (multilink.lines ?? []).map(({ id, rxBps, txBps }) => ({ id, rxBps, txBps })),
  };
}

// Appends a snapshot to the client-only history (oldest first, at most 60 points).
export function appendThroughputPoint(queryClient, deviceId, multilink) {
  const point = toThroughputPoint(multilink);
  queryClient.setQueryData(multiLinkKeys.history(deviceId), (points = []) => {
    // The same snapshot can arrive twice (socket and refetch): keep one.
    if (points.at(-1)?.at === point.at) {
      return points;
    }
    return [...points, point].slice(-THROUGHPUT_POINTS_LIMIT);
  });
}

// Reads the points that useMultiLinkLiveUpdates writes into the cache.
// Nothing is fetched: the query starts empty and is filled by socket events.
// data: [{ at, totals: { rxBps, txBps, connections }, lines: [{ id, rxBps, txBps }] }]
export function useThroughputHistory(deviceId) {
  return useQuery({
    queryKey: multiLinkKeys.history(deviceId),
    queryFn: () => [],
    enabled: Boolean(deviceId),
    staleTime: Infinity,
    gcTime: TEN_MINUTES_MS,
  });
}
