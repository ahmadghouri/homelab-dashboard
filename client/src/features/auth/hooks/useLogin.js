import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login } from '../api';
import { authKeys } from '../queryKeys';

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me(), user);
    },
  });
}
