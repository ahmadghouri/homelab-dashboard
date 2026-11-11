import { authKeys } from './queryKeys';

// Marks the user as logged out and removes all cached private data.
// RequireAuth sees the null user and redirects to the login page.
export function clearPrivateData(queryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== authKeys.all[0] });
  queryClient.setQueryData(authKeys.me(), null);
}
