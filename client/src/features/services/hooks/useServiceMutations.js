import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alertKeys } from '@/features/alerts/queryKeys';
import { checkService, createService, deleteService, updateService } from '../api';
import { mergeServiceIntoCache, removeServiceFromCache } from '../cache';
import { serviceKeys } from '../queryKeys';

export function useAddService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceKeys.list() }),
  });
}

// Also used to pause and resume ({ id, enabled }).
export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateService,
    onSuccess: (service) => {
      mergeServiceIntoCache(queryClient, service);
      // A new target or pausing can change the uptime numbers and open alerts.
      queryClient.invalidateQueries({ queryKey: serviceKeys.list() });
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteService,
    onSuccess: (_, serviceId) => {
      removeServiceFromCache(queryClient, serviceId);
      // Deleting a service closes its alerts.
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
    },
  });
}

export function useCheckService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkService,
    onSuccess: (service) => {
      mergeServiceIntoCache(queryClient, service);
      queryClient.invalidateQueries({ queryKey: serviceKeys.histories(service.id) });
    },
  });
}
