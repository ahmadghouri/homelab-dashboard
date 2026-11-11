import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  blockRouterDevice,
  setRouterDevicePriority,
  trackRouterDevice,
  unblockRouterDevice,
  untrackRouterDevice,
} from '../api';
import { routerKeys } from '../queryKeys';

// Every router write answers { device: <updated row> }; swap it into the cached list.
function useRouterDeviceMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      const updated = data?.device;
      if (!updated) {
        queryClient.invalidateQueries({ queryKey: routerKeys.devices() });
        return;
      }
      queryClient.setQueryData(routerKeys.devices(), (devices) =>
        devices?.map((device) => (device.networkDeviceId === updated.networkDeviceId ? updated : device)),
      );
    },
  });
}

// mutate({ id, tracked })
export function useTrackRouterDevice() {
  return useRouterDeviceMutation(({ id, tracked }) =>
    tracked ? trackRouterDevice(id) : untrackRouterDevice(id),
  );
}

// mutate({ id, priority, maxMbps })
export function useSetRouterDevicePriority() {
  return useRouterDeviceMutation(setRouterDevicePriority);
}

// mutate({ id, blocked })
export function useBlockRouterDevice() {
  return useRouterDeviceMutation(({ id, blocked }) =>
    blocked ? blockRouterDevice(id) : unblockRouterDevice(id),
  );
}
