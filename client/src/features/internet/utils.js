import { formatDuration } from '@/lib/format';

const EMPTY = '–';

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function formatMbps(value) {
  return isNumber(value) ? `${value.toFixed(1)} Mbps` : EMPTY;
}

export function formatMs(value) {
  return isNumber(value) ? `${value.toFixed(1)} ms` : EMPTY;
}

// Outages can be shorter than a minute, which formatDuration would show as "0m".
export function formatOutageDuration(seconds) {
  if (isNumber(seconds) && seconds < 60) {
    return `${Math.max(0, Math.round(seconds))}s`;
  }
  return formatDuration(seconds);
}

export function describeSpeedTestSchedule(intervalMin) {
  if (!isNumber(intervalMin) || intervalMin <= 0) {
    return 'Scheduled tests are off.';
  }
  if (intervalMin % 60 === 0) {
    const hours = intervalMin / 60;
    return `A test runs every ${hours === 1 ? 'hour' : `${hours} hours`}.`;
  }
  return `A test runs every ${intervalMin} minutes.`;
}

// The newest successful test from a list sorted oldest first.
export function findLastSuccessfulTest(tests = []) {
  return tests.findLast((test) => test.success) ?? null;
}

export function formatLossPct(value) {
  return isNumber(value) ? `${value < 10 && value % 1 !== 0 ? value.toFixed(1) : value.toFixed(0)}%` : EMPTY;
}

// Tone for a packet loss value: none is good, a little is a warning, a lot is bad.
export function lossTone(lossPct) {
  if (!isNumber(lossPct)) {
    return 'text-muted-foreground';
  }
  if (lossPct === 0) {
    return 'text-success';
  }
  return lossPct < 5 ? 'text-warning' : 'text-danger';
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// The current month and the 11 before it, newest first: [{ value: 'YYYY-MM', label: 'November 2026' }].
export function lastTwelveMonths(now = new Date()) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return {
      value: monthKey(date),
      label: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    };
  });
}
