// Shared thresholds for CPU, RAM, and disk usage colors.
export const WARNING_THRESHOLD = 75;
export const CRITICAL_THRESHOLD = 90;

export function usageLevel(value) {
  if (value >= CRITICAL_THRESHOLD) {
    return 'critical';
  }
  if (value >= WARNING_THRESHOLD) {
    return 'warning';
  }
  return 'ok';
}
