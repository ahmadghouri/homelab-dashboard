import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getIspReport } from '../api';
import { internetKeys } from '../queryKeys';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// data: { month, from, to, speed, uptime, quality, daily } for a YYYY-MM month.
export function useIspReport(month) {
  return useQuery({
    queryKey: internetKeys.ispReport(month),
    queryFn: ({ signal }) => getIspReport(month, { signal }),
    staleTime: FIVE_MINUTES_MS,
    placeholderData: keepPreviousData,
  });
}
