import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDnsStatus, setDnsProtection } from '../api';
import { dnsKeys } from '../queryKeys';

const THIRTY_SECONDS_MS = 30 * 1000;

// data: the AdGuard Home status. `data.configured` is false when ADGUARD_URL is empty.
export function useDnsStatus() {
  return useQuery({
    queryKey: dnsKeys.status(),
    queryFn: ({ signal }) => getDnsStatus({ signal }),
    staleTime: THIRTY_SECONDS_MS,
    refetchInterval: THIRTY_SECONDS_MS,
  });
}

// mutate(enabled). The API answers with the new status, so the cache is updated directly.
export function useSetDnsProtection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setDnsProtection,
    onSuccess: (status) => queryClient.setQueryData(dnsKeys.status(), status),
  });
}
