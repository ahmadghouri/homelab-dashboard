// Display helpers shared by all features. Empty values render as an en dash.

const EMPTY = '–';
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function formatPercent(value, digits = 0) {
  return isNumber(value) ? `${value.toFixed(digits)}%` : EMPTY;
}

export function formatBytes(value, digits = 1) {
  if (!isNumber(value)) {
    return EMPTY;
  }
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : digits)} ${BYTE_UNITS[unit]}`;
}

export function formatBitsPerSecond(bytesPerSecond) {
  if (!isNumber(bytesPerSecond)) {
    return EMPTY;
  }
  const bits = bytesPerSecond * 8;
  if (bits >= 1e6) {
    return `${(bits / 1e6).toFixed(1)} Mbps`;
  }
  if (bits >= 1e3) {
    return `${(bits / 1e3).toFixed(0)} Kbps`;
  }
  return `${bits.toFixed(0)} bps`;
}

export function formatTemperature(celsius) {
  return isNumber(celsius) ? `${celsius.toFixed(0)}°C` : 'N/A';
}

export function formatDuration(totalSeconds) {
  if (!isNumber(totalSeconds)) {
    return EMPTY;
  }
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function formatRelativeTime(date) {
  if (!date) {
    return 'never';
  }
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) {
    return relativeTime.format(seconds, 'second');
  }
  if (abs < 3600) {
    return relativeTime.format(Math.round(seconds / 60), 'minute');
  }
  if (abs < 86400) {
    return relativeTime.format(Math.round(seconds / 3600), 'hour');
  }
  return relativeTime.format(Math.round(seconds / 86400), 'day');
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
