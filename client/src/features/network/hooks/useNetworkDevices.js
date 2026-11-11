import { useQuery } from '@tanstack/react-query';
import { getNetworkDevices } from '../api';
import { networkKeys } from '../queryKeys';

const ONE_MINUTE_MS = 60 * 1000;

// data: { devices, scan }. Refreshed by `network:update` socket events after each scan.
export function useNetworkDevices() {
  return useQuery({
    queryKey: networkKeys.list(),
    queryFn: ({ signal }) => getNetworkDevices({ signal }),
    staleTime: ONE_MINUTE_MS,
  });
}
