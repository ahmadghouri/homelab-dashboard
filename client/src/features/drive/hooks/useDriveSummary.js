import { useQuery } from '@tanstack/react-query';
import { getActivity, getSummary } from '../api';
import { driveKeys } from '../queryKeys';

const ONE_MINUTE_MS = 60 * 1000;

// data: { totalBytes | null, usedBytes, freeBytes | null, fileCount, byKind: [{ kind, count, bytes }] }.
export function useDriveSummary({ enabled = true } = {}) {
  return useQuery({
    queryKey: driveKeys.summary(),
    queryFn: ({ signal }) => getSummary({ signal }),
    enabled,
    staleTime: ONE_MINUTE_MS,
  });
}

// data: recent Drive activity entries (admin only).
export function useDriveActivity({ enabled = true, limit = 50 } = {}) {
  return useQuery({
    queryKey: [...driveKeys.activity(), limit],
    queryFn: ({ signal }) => getActivity(limit, { signal }),
    enabled,
    staleTime: ONE_MINUTE_MS,
  });
}
