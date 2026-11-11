import { useQuery } from '@tanstack/react-query';
import { getRouterDevices } from '../api';
import { routerKeys } from '../queryKeys';

const TEN_SECONDS_MS = 10 * 1000;

// data: the devices with their router settings and live usage.
// enabled: only fetch when the router is configured (the API answers 409 otherwise).
// live: refresh every 10 s (Router page). The query stops while the page is closed.
export function useRouterDevices({ enabled = true, live = false } = {}) {
  return useQuery({
    queryKey: routerKeys.devices(),
    queryFn: ({ signal }) => getRouterDevices({ signal }),
    enabled,
    staleTime: TEN_SECONDS_MS,
    refetchInterval: live ? TEN_SECONDS_MS : false,
  });
}
