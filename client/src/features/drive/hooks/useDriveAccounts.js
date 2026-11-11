import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAccount,
  getAccounts,
  getConnectUrl,
  getRouting,
  getSetup,
  syncAccount,
  updateAccount,
  updateRouting,
} from '../api';
import { driveKeys } from '../queryKeys';

const ONE_MINUTE_MS = 60 * 1000;
const FIVE_MINUTES_MS = 5 * ONE_MINUTE_MS;

// data: { accounts, summary: { totalBytes | null, usedBytes, freeBytes | null, accounts, connected } }.
// Viewers get an empty accounts array and only the summary.
export function useDriveAccounts({ enabled = true } = {}) {
  return useQuery({
    queryKey: driveKeys.accounts(),
    queryFn: ({ signal }) => getAccounts({ signal }),
    enabled,
    staleTime: ONE_MINUTE_MS,
  });
}

// data: { googleConfigured, redirectUri } (admin).
export function useDriveSetup({ enabled = true } = {}) {
  return useQuery({
    queryKey: driveKeys.setup(),
    queryFn: ({ signal }) => getSetup({ signal }),
    enabled,
    staleTime: FIVE_MINUTES_MS,
  });
}

// data: { mode: 'most_free' | 'round_robin' | 'priority' }.
export function useRouting({ enabled = true } = {}) {
  return useQuery({
    queryKey: driveKeys.routing(),
    queryFn: ({ signal }) => getRouting({ signal }),
    enabled,
    staleTime: FIVE_MINUTES_MS,
  });
}

// Admin account actions. Each entry is a mutation result:
// - connectUrl.mutateAsync() → consent URL (409 when Google is not configured)
// - update.mutate({ id, acceptUploads?, priority? })
// - sync.mutate(id)
// - remove.mutate(id)   (409 { message, details: { files } } while it still holds files)
// - setRouting.mutate(mode)
export function useAccountMutations() {
  const queryClient = useQueryClient();
  const refreshAccounts = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: driveKeys.accounts() }),
      queryClient.invalidateQueries({ queryKey: driveKeys.summary() }),
    ]);

  const connectUrl = useMutation({ mutationFn: getConnectUrl });
  const update = useMutation({ mutationFn: updateAccount, onSuccess: refreshAccounts });
  const sync = useMutation({ mutationFn: syncAccount, onSettled: refreshAccounts });
  const remove = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      refreshAccounts();
      queryClient.invalidateQueries({ queryKey: driveKeys.activity() });
    },
  });
  const setRouting = useMutation({
    mutationFn: updateRouting,
    onSuccess: (data, mode) => queryClient.setQueryData(driveKeys.routing(), { mode: data?.mode ?? mode }),
  });

  return { connectUrl, update, sync, remove, setRouting };
}

// Refetches the account list (after the OAuth popup reports back).
export function useRefreshDriveAccounts() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: driveKeys.accounts() }),
      queryClient.invalidateQueries({ queryKey: driveKeys.summary() }),
      queryClient.invalidateQueries({ queryKey: driveKeys.setup() }),
    ]);
}
