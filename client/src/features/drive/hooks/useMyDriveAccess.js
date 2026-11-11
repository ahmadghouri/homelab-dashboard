import { useQuery } from '@tanstack/react-query';
import { getMyAccess } from '../api';
import { driveKeys } from '../queryKeys';
import { NO_DRIVE_ACCESS } from '../utils';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// data: the user's effective Drive permissions
// { canView, canDownload, canUpload, canDelete, canShare, scope, folderIds }.
// `access` is always an object (everything off while loading or on error).
export function useMyDriveAccess() {
  const query = useQuery({
    queryKey: driveKeys.myAccess(),
    queryFn: ({ signal }) => getMyAccess({ signal }),
    staleTime: FIVE_MINUTES_MS,
  });
  return { ...query, access: { ...NO_DRIVE_ACCESS, ...query.data } };
}
