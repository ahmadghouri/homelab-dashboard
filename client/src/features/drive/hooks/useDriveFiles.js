import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getFile, getFiles } from '../api';
import { driveKeys } from '../queryKeys';

const THIRTY_SECONDS_MS = 30 * 1000;

// params: { folderId, q, kind, accountId, sort, order, page, limit }.
// data: { files, folders (only without q), total, page, limit }.
// Changes by other users arrive through useDriveLiveUpdates.
export function useDriveFiles(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: driveKeys.files(params),
    queryFn: ({ signal }) => getFiles(params, { signal }),
    enabled,
    staleTime: THIRTY_SECONDS_MS,
    // Keep the old listing visible while the next folder or search loads.
    placeholderData: keepPreviousData,
  });
}

// data: { file, folderPath }.
export function useDriveFile(id) {
  return useQuery({
    queryKey: driveKeys.file(id),
    queryFn: ({ signal }) => getFile(id, { signal }),
    enabled: Boolean(id),
    staleTime: THIRTY_SECONDS_MS,
  });
}
