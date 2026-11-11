import { useQuery } from '@tanstack/react-query';
import { getTrash } from '../api';
import { driveKeys } from '../queryKeys';

const THIRTY_SECONDS_MS = 30 * 1000;

// data: { files, folders } (top-level trashed items only). Needs the delete permission.
export function useTrash({ enabled = true } = {}) {
  return useQuery({
    queryKey: driveKeys.trash(),
    queryFn: ({ signal }) => getTrash({ signal }),
    enabled,
    staleTime: THIRTY_SECONDS_MS,
  });
}
