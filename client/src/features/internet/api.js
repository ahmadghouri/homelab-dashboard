import { apiClient } from '@/api/client';

// Returns { status: { online, since, checkedAt, speedTestRunning, speedTestIntervalMin, lastSpeedTest } }.
export async function getInternetStatus({ signal } = {}) {
  const data = await apiClient.get('/internet/status', { signal });
  return data.status;
}

// Returns { range, tests } with tests oldest first.
export function getSpeedTests(range, { signal } = {}) {
  return apiClient.get(`/internet/speedtests?range=${encodeURIComponent(range)}`, { signal });
}

export async function getOutages(limit, { signal } = {}) {
  const data = await apiClient.get(`/internet/outages?limit=${encodeURIComponent(limit)}`, { signal });
  return data.outages;
}

// Waits for the test to finish (10 to 40 seconds). Returns the saved test, failed ones included.
export async function runSpeedTest() {
  const data = await apiClient.post('/internet/speedtests');
  return data.test;
}

// Returns { range, binMinutes, targets: [{ target, name, host, latest, points: [{ ts, lossPct, avgMs, jitterMs }] }] }.
export function getQuality(range, { signal } = {}) {
  return apiClient.get(`/internet/quality?range=${encodeURIComponent(range)}`, { signal });
}

// Returns { month, from, to, speed, uptime, quality, daily } for a YYYY-MM month.
export function getIspReport(month, { signal } = {}) {
  return apiClient.get(`/reports/isp?month=${encodeURIComponent(month)}`, { signal });
}

// Same base as the shared client. Used as a plain link so the browser sends the session cookie.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export function getIspReportPdfUrl(month) {
  return `${API_BASE_URL}/reports/isp.pdf?month=${encodeURIComponent(month)}`;
}
