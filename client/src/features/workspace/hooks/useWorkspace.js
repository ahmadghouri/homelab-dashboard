import { useQuery } from '@tanstack/react-query';
import { getWorkspace } from '../api';
import { workspaceKeys } from '../queryKeys';

// Fresh snapshots arrive over the socket every 10 s (useWorkspaceLiveUpdates),
// the poll is only a fallback when the socket misses some.
const ONE_MINUTE_MS = 60 * 1000;

// data: { workspace: snapshot | null, online: boolean }
export function useWorkspace(deviceId) {
  return useQuery({
    queryKey: workspaceKeys.detail(deviceId),
    queryFn: ({ signal }) => getWorkspace(deviceId, { signal }),
    enabled: Boolean(deviceId),
    refetchInterval: ONE_MINUTE_MS,
  });
}
