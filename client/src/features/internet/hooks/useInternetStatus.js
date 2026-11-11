import { useQuery } from '@tanstack/react-query';
import { getInternetStatus } from '../api';
import { internetKeys } from '../queryKeys';

const THIRTY_SECONDS_MS = 30 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

// data: { online, since, checkedAt, speedTestRunning, speedTestIntervalMin, lastSpeedTest }.
// Changes arrive over the socket (useInternetLiveUpdates); the poll keeps checkedAt fresh.
export function useInternetStatus() {
  return useQuery({
    queryKey: internetKeys.status(),
    queryFn: ({ signal }) => getInternetStatus({ signal }),
    staleTime: THIRTY_SECONDS_MS,
    refetchInterval: ONE_MINUTE_MS,
  });
}
