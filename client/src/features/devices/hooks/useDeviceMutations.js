import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDevice, deleteDevice, regenerateDeviceToken, renameDevice } from '../api';
import { removeDeviceFromCache } from '../cache';
import { deviceKeys } from '../queryKeys';

export function useAddDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDevice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deviceKeys.list() }),
  });
}

export function useRenameDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: renameDevice,
    onSuccess: (device) => {
      queryClient.setQueryData(deviceKeys.detail(device.id), device);
      queryClient.invalidateQueries({ queryKey: deviceKeys.list() });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDevice,
    onSuccess: (_, deviceId) => removeDeviceFromCache(queryClient, deviceId),
  });
}

export function useRegenerateDeviceToken() {
  return useMutation({ mutationFn: regenerateDeviceToken });
}
