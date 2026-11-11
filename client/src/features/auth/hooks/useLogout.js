import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout } from '../api';
import { clearPrivateData } from '../session';

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    // Clear local data even if the request fails, so the UI never stays "logged in".
    onSettled: () => clearPrivateData(queryClient),
  });
}
