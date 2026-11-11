import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acknowledgeAlert, getAlertRules, resolveAlert, updateAlertRule } from '../api';
import { alertKeys } from '../queryKeys';

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: alertKeys.lists() }),
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: alertKeys.lists() }),
  });
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useAlertRules() {
  return useQuery({
    queryKey: alertKeys.rules(),
    queryFn: ({ signal }) => getAlertRules({ signal }),
    staleTime: FIVE_MINUTES_MS,
  });
}

// Turning a rule off closes its alerts, so alert lists are refreshed too.
export function useUpdateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAlertRule,
    onSuccess: (rule) => {
      queryClient.setQueryData(alertKeys.rules(), (rules) =>
        rules?.map((item) => (item.id === rule.id ? rule : item)),
      );
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}
