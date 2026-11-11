import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getDeviceHistory } from '../api';
import { deviceKeys } from '../queryKeys';

// The server saves one sample per minute, so refreshing faster brings nothing new.
const ONE_MINUTE_MS = 60 * 1000;

export function useDeviceHistory(id, range) {
  return useQuery({
    queryKey: deviceKeys.history(id, range),
    queryFn: ({ signal }) => getDeviceHistory(id, range, { signal }),
    enabled: Boolean(id),
    staleTime: ONE_MINUTE_MS,
    refetchInterval: ONE_MINUTE_MS,
    // Keep the old chart visible while another range loads.
    placeholderData: keepPreviousData,
  });
}
