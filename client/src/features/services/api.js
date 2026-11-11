import { apiClient } from '@/api/client';

// Returns the services, each with uptime24h and uptime7d (percent or null).
export async function getServices({ signal } = {}) {
  const data = await apiClient.get('/services', { signal });
  return data.services;
}

// Returns { range, binMinutes, points: [{ ts, uptimePct, avgResponseMs }] }.
export function getServiceHistory(id, range, { signal } = {}) {
  return apiClient.get(`/services/${id}/checks?range=${encodeURIComponent(range)}`, { signal });
}

export async function createService(values) {
  const data = await apiClient.post('/services', values);
  return data.service;
}

export async function updateService({ id, ...changes }) {
  const data = await apiClient.patch(`/services/${id}`, changes);
  return data.service;
}

export function deleteService(id) {
  return apiClient.delete(`/services/${id}`);
}

// Runs a check now and waits for it (up to the service timeout).
export async function checkService(id) {
  const data = await apiClient.post(`/services/${id}/check`);
  return data.service;
}
