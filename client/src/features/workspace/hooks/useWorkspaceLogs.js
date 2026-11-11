import { useQuery } from '@tanstack/react-query';
import { getWorkspaceLogs } from '../api';
import { workspaceKeys } from '../queryKeys';

const REFRESH_MS = 3000;

// data: { ok, output, lines }. Refetches every 3 s while enabled (dialog open and auto refresh on).
export function useWorkspaceLogs({ deviceId, target, id, enabled = true, lines }) {
  const isEnabled = Boolean(enabled && deviceId && target && id);

  return useQuery({
    queryKey: workspaceKeys.logs(deviceId, target, id),
    queryFn: ({ signal }) => getWorkspaceLogs({ deviceId, target, id, lines }, { signal }),
    enabled: isEnabled,
    refetchInterval: isEnabled ? REFRESH_MS : false,
    // Logs may hold secrets: do not keep them in memory after the dialog closes.
    gcTime: 0,
    retry: false,
  });
}
