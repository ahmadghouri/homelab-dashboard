import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDevice } from '../api';
import { deviceKeys } from '../queryKeys';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useDevice(id) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: deviceKeys.detail(id),
    queryFn: ({ signal }) => getDevice(id, { signal }),
    enabled: Boolean(id),
    staleTime: FIVE_MINUTES_MS,
    // Show the device from the list instantly while the detail loads.
    placeholderData: () =>
      queryClient.getQueryData(deviceKeys.list())?.find((device) => device.id === id),
  });
}
