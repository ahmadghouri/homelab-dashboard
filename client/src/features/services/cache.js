import { serviceKeys } from './queryKeys';

// Writes a fresh service into the list. Single service responses and socket
// events have no uptime numbers, so the cached ones are kept.
// Returns false when the service is not in the cached list.
export function mergeServiceIntoCache(queryClient, changed) {
  let found = false;
  queryClient.setQueryData(serviceKeys.list(), (services) =>
    services?.map((service) => {
      if (service.id !== changed.id) {
        return service;
      }
      found = true;
      return { ...service, ...changed, uptime24h: service.uptime24h, uptime7d: service.uptime7d };
    }),
  );
  return found;
}

export function removeServiceFromCache(queryClient, serviceId) {
  queryClient.setQueryData(serviceKeys.list(), (services) =>
    services?.filter((service) => service.id !== serviceId),
  );
  queryClient.removeQueries({ queryKey: serviceKeys.histories(serviceId) });
}
