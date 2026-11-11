import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { internetKeys } from '../queryKeys';

function patchStatus(queryClient, changes) {
  queryClient.setQueryData(internetKeys.status(), (status) => (status ? { ...status, ...changes } : status));
}

// Keeps internet status, speed tests and outages current. Mounted once in AppLayout.
export function useInternetLiveUpdates() {
  const queryClient = useQueryClient();

  // Went online or offline: an outage was opened or closed too.
  useSocketEvent('internet:status', ({ online, since, checkedAt }) => {
    patchStatus(queryClient, { online, since, checkedAt });
    queryClient.invalidateQueries({ queryKey: internetKeys.outageLists() });
  });

  // A test started or stopped (by the schedule or another user).
  useSocketEvent('internet:speedtest:running', ({ running }) => {
    patchStatus(queryClient, { speedTestRunning: running });
  });

  // A test finished (successful or failed).
  useSocketEvent('internet:speedtest', () => {
    queryClient.invalidateQueries({ queryKey: internetKeys.status() });
    queryClient.invalidateQueries({ queryKey: internetKeys.speedTestLists() });
  });

  // A new packet loss / latency sample was saved for one target.
  useSocketEvent('internet:quality', () => {
    queryClient.invalidateQueries({ queryKey: internetKeys.qualityLists() });
  });
}
