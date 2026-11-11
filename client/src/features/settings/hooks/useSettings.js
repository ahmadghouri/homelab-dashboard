import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authKeys } from '@/features/auth/queryKeys';
import { networkKeys } from '@/features/network/queryKeys';
import {
  changePassword,
  createUser,
  deleteUser,
  findTelegramChats,
  getSettings,
  getUsers,
  sendTelegramTest,
  updateSettings,
  updateUser,
} from '../api';
import { settingsKeys } from '../queryKeys';

export function useAppSettings() {
  return useQuery({ queryKey: settingsKeys.app(), queryFn: ({ signal }) => getSettings({ signal }) });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKeys.app(), settings);
      queryClient.invalidateQueries({ queryKey: networkKeys.list() });
    },
  });
}

export function useSendTelegramTest() {
  return useMutation({ mutationFn: sendTelegramTest });
}

// Reads chats on demand (when the user clicks "Find my chat"), so it is a mutation.
export function useFindTelegramChats() {
  return useMutation({ mutationFn: findTelegramChats });
}

export function useUsers({ enabled = true } = {}) {
  return useQuery({
    queryKey: settingsKeys.users(),
    queryFn: ({ signal }) => getUsers({ signal }),
    enabled,
  });
}

function useUserMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.users() }),
  });
}

export const useCreateUser = () => useUserMutation(createUser);
export const useUpdateUser = () => useUserMutation(updateUser);
export const useDeleteUser = () => useUserMutation(deleteUser);

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: changePassword,
    onSuccess: (user) => queryClient.setQueryData(authKeys.me(), user),
  });
}
