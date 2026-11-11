import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getSpeedTests } from '../api';
import { internetKeys } from '../queryKeys';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// data: { range, tests } oldest first. New tests invalidate this over the socket.
export function useSpeedTests(range, { enabled = true } = {}) {
  return useQuery({
    queryKey: internetKeys.speedTests(range),
    queryFn: ({ signal }) => getSpeedTests(range, { signal }),
    enabled,
    staleTime: FIVE_MINUTES_MS,
    // Keep the old chart visible while another range loads.
    placeholderData: keepPreviousData,
  });
}
