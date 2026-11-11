import { useQuery } from '@tanstack/react-query';
import { getDevices } from '../api';
import { deviceKeys } from '../queryKeys';

// Live changes arrive over the socket, so the list itself rarely needs refetching.
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useDevices() {
  return useQuery({
    queryKey: deviceKeys.list(),
    queryFn: ({ signal }) => getDevices({ signal }),
    staleTime: FIVE_MINUTES_MS,
  });
}
