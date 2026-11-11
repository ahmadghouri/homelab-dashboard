import { flushMetricSamples } from '../services/metricsService.js';

const FLUSH_INTERVAL_MS = 60 * 1000;

let timer = null;

async function runFlush() {
  try {
    await flushMetricSamples();
  } catch (error) {
    console.error('[metrics] flush failed:', error.message);
  }
}

export function startMetricsFlushJob() {
  if (!timer) {
    timer = setInterval(runFlush, FLUSH_INTERVAL_MS);
  }
}

// Stops the timer and saves whatever is still buffered.
export async function stopMetricsFlushJob() {
  clearInterval(timer);
  timer = null;
  await runFlush();
}
