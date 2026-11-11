export const SERVICE_TYPES = [
  { value: 'http', label: 'HTTP / HTTPS', placeholder: 'https://example.com', hint: 'Up when the page answers with a status below 400.' },
  { value: 'tcp', label: 'TCP port', placeholder: '192.168.1.10:27017', hint: 'Host and port. Up when a connection opens.' },
];

export const SERVICE_DEFAULTS = { intervalSec: 60, timeoutMs: 5000 };

export function serviceTypeInfo(type) {
  return SERVICE_TYPES.find((item) => item.value === type) ?? SERVICE_TYPES[0];
}

export function formatResponseMs(ms) {
  return typeof ms === 'number' && Number.isFinite(ms) ? `${Math.round(ms)} ms` : '–';
}

// Text color for an uptime percent: red below 95, amber below 99.
export function uptimeClassName(value) {
  if (typeof value !== 'number') {
    return 'text-muted-foreground';
  }
  if (value < 95) {
    return 'text-danger';
  }
  return value < 99 ? 'text-warning' : undefined;
}
