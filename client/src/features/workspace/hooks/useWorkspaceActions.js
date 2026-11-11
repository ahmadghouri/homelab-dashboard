import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getWorkspaceActions, runWorkspaceAction } from '../api';
import { workspaceKeys } from '../queryKeys';

// data: action logs, newest first.
export function useWorkspaceActions(deviceId) {
  return useQuery({
    queryKey: workspaceKeys.actions(deviceId),
    queryFn: ({ signal }) => getWorkspaceActions(deviceId, { signal }),
    enabled: Boolean(deviceId),
  });
}

// Variables: { deviceId, target, id, action }. Resolves with the finished action log.
export function useRunWorkspaceAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runWorkspaceAction,
    onSettled: (_, __, { deviceId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceKeys.actions(deviceId) }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(deviceId) }),
      ]),
  });
}
