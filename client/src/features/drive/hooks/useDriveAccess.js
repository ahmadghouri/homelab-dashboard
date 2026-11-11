import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccessList, saveAccess } from '../api';
import { driveKeys } from '../queryKeys';

const ONE_MINUTE_MS = 60 * 1000;

// data: [{ userId, name, email, role, access }] (admin).
export function useDriveAccessList({ enabled = true } = {}) {
  return useQuery({
    queryKey: driveKeys.access(),
    queryFn: ({ signal }) => getAccessList({ signal }),
    enabled,
    staleTime: ONE_MINUTE_MS,
  });
}

// mutate({ userId, canView, canDownload, canUpload, canDelete, canShare, scope, folderIds }).
export function useSaveDriveAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driveKeys.access() });
      queryClient.invalidateQueries({ queryKey: driveKeys.activity() });
    },
  });
}
