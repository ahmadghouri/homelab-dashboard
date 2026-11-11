import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../api';
import { healthKeys } from '../queryKeys';

const HEALTH_REFRESH_MS = 10_000;

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: ({ signal }) => getHealth({ signal }),
    refetchInterval: HEALTH_REFRESH_MS,
  });
}
