import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runSpeedTest } from '../api';
import { internetKeys } from '../queryKeys';

// Resolves with the saved test (check `test.success`). Rejects with 409 when a test is already running.
export function useRunSpeedTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runSpeedTest,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: internetKeys.status() });
      queryClient.invalidateQueries({ queryKey: internetKeys.speedTestLists() });
    },
  });
}
