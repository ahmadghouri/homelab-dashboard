import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getServiceHistory } from '../api';
import { serviceKeys } from '../queryKeys';

// Checks run at most every 30 s and bins are 15 min or more, so once a minute is plenty.
const ONE_MINUTE_MS = 60 * 1000;

// data: { range, binMinutes, points: [{ ts, uptimePct, avgResponseMs }] }.
export function useServiceHistory(id, range) {
  return useQuery({
    queryKey: serviceKeys.history(id, range),
    queryFn: ({ signal }) => getServiceHistory(id, range, { signal }),
    enabled: Boolean(id),
    staleTime: ONE_MINUTE_MS,
    refetchInterval: ONE_MINUTE_MS,
    // Keep the old chart visible while another range or service loads.
    placeholderData: keepPreviousData,
  });
}
