import { useQuery } from '@tanstack/react-query';
import { getAlerts } from '../api';
import { alertKeys } from '../queryKeys';

const ONE_MINUTE_MS = 60 * 1000;

// data: { alerts, openCount }. Socket events invalidate it when alerts change.
export function useAlerts(status) {
  return useQuery({
    queryKey: alertKeys.list(status),
    queryFn: ({ signal }) => getAlerts(status, { signal }),
    staleTime: ONE_MINUTE_MS,
  });
}

// Shares the "open" query, so the bell and the Alerts page make one request.
export function useOpenAlertCount() {
  const { data } = useAlerts('open');
  return data?.openCount ?? 0;
}
