import { useQuery } from '@tanstack/react-query';
import { getFolderPath, getFolders, getFolderTree } from '../api';
import { driveKeys } from '../queryKeys';

const ONE_MINUTE_MS = 60 * 1000;

// data: child folders of parentId (null = root).
export function useFolders(parentId = null, { enabled = true } = {}) {
  return useQuery({
    queryKey: driveKeys.folders(parentId),
    queryFn: ({ signal }) => getFolders(parentId, { signal }),
    enabled,
    staleTime: ONE_MINUTE_MS,
  });
}

// data: every non-trashed folder the user can see: [{ id, name, parentId }].
export function useFolderTree({ enabled = true } = {}) {
  return useQuery({
    queryKey: driveKeys.tree(),
    queryFn: ({ signal }) => getFolderTree({ signal }),
    enabled,
    staleTime: ONE_MINUTE_MS,
  });
}

// data: breadcrumb [{ id, name }] from the top folder down to folderId. Disabled at the root.
export function useFolderPath(folderId) {
  return useQuery({
    queryKey: driveKeys.path(folderId),
    queryFn: ({ signal }) => getFolderPath(folderId, { signal }),
    enabled: Boolean(folderId),
    staleTime: ONE_MINUTE_MS,
  });
}
