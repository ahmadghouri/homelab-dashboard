import { apiClient } from '@/api/client';

export async function getSettings({ signal } = {}) {
  const data = await apiClient.get('/settings', { signal });
  return data.settings;
}

// patch: { telegram?: { enabled?, chatId? }, network?: { scanIntervalMin? } }
export async function updateSettings(patch) {
  const data = await apiClient.patch('/settings', patch);
  return data.settings;
}

export function sendTelegramTest() {
  return apiClient.post('/settings/telegram/test');
}

export async function findTelegramChats() {
  const data = await apiClient.get('/settings/telegram/chats');
  return data.chats;
}

export async function getUsers({ signal } = {}) {
  const data = await apiClient.get('/users', { signal });
  return data.users;
}

export async function createUser(user) {
  const data = await apiClient.post('/users', user);
  return data.user;
}

export async function updateUser({ id, ...changes }) {
  const data = await apiClient.patch(`/users/${id}`, changes);
  return data.user;
}

export function deleteUser(id) {
  return apiClient.delete(`/users/${id}`);
}

export async function changePassword({ currentPassword, newPassword }) {
  const data = await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  return data.user;
}
