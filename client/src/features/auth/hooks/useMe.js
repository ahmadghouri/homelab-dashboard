import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api';
import { authKeys } from '../queryKeys';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// data: the user object, or null when not logged in.
export function useMe() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: ({ signal }) => getMe({ signal }),
    staleTime: FIVE_MINUTES_MS,
  });
}
