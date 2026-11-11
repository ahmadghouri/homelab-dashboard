import { apiClient } from '@/api/client';

// Returns { alerts, openCount }. status: 'open' | 'resolved' | 'all'.
export function getAlerts(status, { signal } = {}) {
  return apiClient.get(`/alerts?status=${encodeURIComponent(status)}`, { signal });
}

export async function acknowledgeAlert(id) {
  const data = await apiClient.post(`/alerts/${id}/acknowledge`);
  return data.alert;
}

export async function resolveAlert(id) {
  const data = await apiClient.post(`/alerts/${id}/resolve`);
  return data.alert;
}

export async function getAlertRules({ signal } = {}) {
  const data = await apiClient.get('/alert-rules', { signal });
  return data.rules;
}

export async function updateAlertRule({ id, ...changes }) {
  const data = await apiClient.patch(`/alert-rules/${id}`, changes);
  return data.rule;
}
