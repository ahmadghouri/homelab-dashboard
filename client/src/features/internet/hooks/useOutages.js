import { useQuery } from '@tanstack/react-query';
import { getOutages } from '../api';
import { DEFAULT_OUTAGE_LIMIT, internetKeys } from '../queryKeys';

const ONE_MINUTE_MS = 60 * 1000;

// data: [{ id, startedAt, endedAt, durationSec }] newest first.
// The poll keeps the duration of an ongoing outage current.
export function useOutages(limit = DEFAULT_OUTAGE_LIMIT) {
  return useQuery({
    queryKey: internetKeys.outages(limit),
    queryFn: ({ signal }) => getOutages(limit, { signal }),
    staleTime: ONE_MINUTE_MS,
    refetchInterval: ONE_MINUTE_MS,
  });
}
