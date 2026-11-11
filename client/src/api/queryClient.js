import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { clearPrivateData } from '@/features/auth/session';

const MAX_RETRIES = 2;

// Do not retry client errors (4xx). Retrying cannot fix them.
function shouldRetry(failureCount, error) {
  if (error?.status >= 400 && error?.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

// Any 401 means the session expired or was revoked: log out locally.
function handleUnauthorized(error) {
  if (error?.status === 401) {
    clearPrivateData(queryClient);
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: {
    queries: {
      retry: shouldRetry,
    },
    mutations: {
      retry: false,
    },
  },
});
