import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alertKeys } from '@/features/alerts/queryKeys';
import { forgetNetworkDevice, scanNetwork, updateNetworkDevice } from '../api';
import { networkKeys } from '../queryKeys';

// Trusting or forgetting a device can close its "unknown device" alert.
function invalidateAfterChange(queryClient) {
  queryClient.invalidateQueries({ queryKey: networkKeys.list() });
  queryClient.invalidateQueries({ queryKey: alertKeys.all });
}

export function useUpdateNetworkDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateNetworkDevice,
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}

export function useForgetNetworkDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: forgetNetworkDevice,
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}

export function useScanNetwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: scanNetwork,
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}
