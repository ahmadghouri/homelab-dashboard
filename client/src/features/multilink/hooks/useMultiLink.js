import { useQuery } from '@tanstack/react-query';
import { getMultiLink } from '../api';
import { multiLinkKeys } from '../queryKeys';

// Fresh snapshots arrive over the socket every 5 s (useMultiLinkLiveUpdates),
// the poll is only a fallback when the socket misses some.
const ONE_MINUTE_MS = 60 * 1000;

// data: { multilink: snapshot | null, settings: { mode, sticky, lines }, online: boolean }
export function useMultiLink(deviceId) {
  return useQuery({
    queryKey: multiLinkKeys.detail(deviceId),
    queryFn: ({ signal }) => getMultiLink(deviceId, { signal }),
    enabled: Boolean(deviceId),
    refetchInterval: ONE_MINUTE_MS,
  });
}
