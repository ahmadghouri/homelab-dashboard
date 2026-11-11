import { formatBitsPerSecond } from '@/lib/format';

// The router API reports rates in BITS per second; formatBitsPerSecond takes bytes per second.
export function formatRate(bitsPerSecond) {
  return formatBitsPerSecond(typeof bitsPerSecond === 'number' ? bitsPerSecond / 8 : bitsPerSecond);
}

// Queue priority choices. The server maps them to RouterOS priority 1 / 4 / 8.
export const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export const MAX_MBPS_LIMIT = 10000;

export function priorityLabel(priority) {
  return PRIORITIES.find((item) => item.value === priority)?.label ?? 'Normal';
}

// Total bytes moved (down + up), or null when the device is not tracked.
export function totalBytes(device) {
  if (device.rxBytes == null && device.txBytes == null) {
    return null;
  }
  return (device.rxBytes ?? 0) + (device.txBytes ?? 0);
}

// Display name with a fallback for devices without a hostname.
export function routerDeviceName(device) {
  return device.name || device.ip || device.mac || 'Unknown device';
}
