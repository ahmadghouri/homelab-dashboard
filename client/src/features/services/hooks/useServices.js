import { useQuery } from '@tanstack/react-query';
import { getServices } from '../api';
import { serviceKeys } from '../queryKeys';

const ONE_MINUTE_MS = 60 * 1000;
const FIVE_MINUTES_MS = 5 * ONE_MINUTE_MS;

// data: the services array. Status changes arrive over the socket
// (useServiceLiveUpdates); the refetch only refreshes the uptime numbers.
export function useServices() {
  return useQuery({
    queryKey: serviceKeys.list(),
    queryFn: ({ signal }) => getServices({ signal }),
    staleTime: ONE_MINUTE_MS,
    refetchInterval: FIVE_MINUTES_MS,
  });
}
