import { apiClient, ApiError } from '@/api/client';

// Returns the logged-in user, or null when not logged in.
// "Not logged in" is a normal state, not an error, so 401 maps to null.
export async function getMe({ signal } = {}) {
  try {
    const data = await apiClient.get('/auth/me', { signal });
    return data.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function login({ email, password }) {
  const data = await apiClient.post('/auth/login', { email, password });
  return data.user;
}

export function logout() {
  return apiClient.post('/auth/logout');
}
