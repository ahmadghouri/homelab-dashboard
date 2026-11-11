import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createShare, getShares, revokeShare } from '../api';
import { driveKeys } from '../queryKeys';

const ONE_MINUTE_MS = 60 * 1000;

// data: own share links (admins see all), each with { id, fileId, url, expiresAt, allowDownload, ... }.
// Filter by fileId in the component for a single file.
export function useShares({ enabled = true } = {}) {
  return useQuery({
    queryKey: driveKeys.shares(),
    queryFn: ({ signal }) => getShares({ signal }),
    enabled,
    staleTime: ONE_MINUTE_MS,
  });
}

// - create.mutateAsync({ fileId, expiresInDays: 1..365 | null, allowDownload }) → { id, url, expiresAt, allowDownload }
// - revoke.mutate(shareId)
export function useShareMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: driveKeys.shares() });

  const create = useMutation({ mutationFn: createShare, onSuccess: refresh });
  const revoke = useMutation({ mutationFn: revokeShare, onSuccess: refresh });

  return { create, revoke };
}
