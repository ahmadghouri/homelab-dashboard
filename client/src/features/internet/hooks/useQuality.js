import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getQuality } from '../api';
import { internetKeys } from '../queryKeys';

const ONE_MINUTE_MS = 60 * 1000;

// data: { range, binMinutes, targets: [{ target, name, host, latest, points }] }.
// New samples (every 60 s per target) invalidate this over the socket; the poll is a fallback.
export function useQuality(range) {
  return useQuery({
    queryKey: internetKeys.quality(range),
    queryFn: ({ signal }) => getQuality(range, { signal }),
    staleTime: ONE_MINUTE_MS,
    refetchInterval: 5 * ONE_MINUTE_MS,
    // Keep the old chart visible while another range loads.
    placeholderData: keepPreviousData,
  });
}
