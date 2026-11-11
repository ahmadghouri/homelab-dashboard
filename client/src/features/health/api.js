import { apiClient } from '@/api/client';

export function getHealth({ signal } = {}) {
  return apiClient.get('/health', { signal });
}
