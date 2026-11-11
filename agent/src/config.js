// Reads and validates agent settings once at startup.

function toPositiveInt(value, fallback, name) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return number;
}

export const config = Object.freeze({
  serverUrl: process.env.SERVER_URL ?? 'http://localhost:4000',
  agentToken: process.env.AGENT_TOKEN ?? '',
  metricsIntervalMs: toPositiveInt(process.env.METRICS_INTERVAL_MS, 5000, 'METRICS_INTERVAL_MS'),
});
