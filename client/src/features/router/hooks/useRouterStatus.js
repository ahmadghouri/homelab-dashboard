import { useQuery } from '@tanstack/react-query';
import { getRouterStatus } from '../api';
import { routerKeys } from '../queryKeys';

const THIRTY_SECONDS_MS = 30 * 1000;

// data: the router status. `data.configured` tells if router features should be shown.
// Shared by the Router page and the Network page device menu (one cached request).
// refetchInterval: pass a number on pages that show live numbers (CPU, uptime).
export function useRouterStatus({ refetchInterval = false } = {}) {
  return useQuery({
    queryKey: routerKeys.status(),
    queryFn: ({ signal }) => getRouterStatus({ signal }),
    staleTime: THIRTY_SECONDS_MS,
    refetchInterval,
  });
}
