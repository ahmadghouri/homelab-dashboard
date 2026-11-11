import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardSocket } from '@/api/socket';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { getDeviceCommands, sendDeviceCommand } from '../api';
import { deviceKeys } from '../queryKeys';

export function useDeviceCommands(id) {
  return useQuery({
    queryKey: deviceKeys.commands(id),
    queryFn: ({ signal }) => getDeviceCommands(id, { signal }),
    enabled: Boolean(id),
  });
}

export function useSendDeviceCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendDeviceCommand,
    onSettled: (_, __, { id }) => queryClient.invalidateQueries({ queryKey: deviceKeys.commands(id) }),
  });
}

// Refreshes the command history of one device when a command starts or finishes,
// also when another admin sent it. Mount it in the device page.
export function useCommandLiveUpdates(deviceId) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: deviceKeys.commands(deviceId) });

  useSocketEvent('command:updated', ({ command }) => {
    if (command?.deviceId === deviceId) {
      invalidate();
    }
  });

  // Events may have been missed while disconnected: refetch after a reconnect.
  useSocketEvent('connect', () => {
    if (!dashboardSocket.recovered) {
      invalidate();
    }
  });
}
