// Internet speed test against Cloudflare's public speed test endpoints (built-in fetch, no package).
const BASE_URL = 'https://speed.cloudflare.com';
const LATENCY_SAMPLES = 5;
const DOWNLOAD_BYTES = 25_000_000;
const UPLOAD_BYTES = 10_000_000;
const PHASE_TIMEOUT_MS = 30_000;

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function toMbps(bytes, ms) {
  return roundOne((bytes * 8) / (ms / 1000) / 1e6);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Mean absolute difference between consecutive samples.
function jitter(values) {
  if (values.length < 2) {
    return 0;
  }
  let total = 0;
  for (let i = 1; i < values.length; i += 1) {
    total += Math.abs(values[i] - values[i - 1]);
  }
  return total / (values.length - 1);
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    signal: AbortSignal.timeout(PHASE_TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Speed test server answered ${response.status}`);
  }
  return response;
}

// Reads the whole body without keeping it in memory. Returns the number of bytes read.
async function drain(response) {
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
  }
  return bytes;
}

async function measureLatency() {
  const samples = [];
  for (let i = 0; i < LATENCY_SAMPLES; i += 1) {
    const startedAt = performance.now();
    const response = await request('/__down?bytes=0');
    await drain(response);
    samples.push(performance.now() - startedAt);
  }
  return { pingMs: roundOne(median(samples)), jitterMs: roundOne(jitter(samples)) };
}

async function measureDownload() {
  const response = await request(`/__down?bytes=${DOWNLOAD_BYTES}`);
  // Timed from the first response byte, so the connection setup does not count as transfer time.
  const startedAt = performance.now();
  const bytes = await drain(response);
  return toMbps(bytes, performance.now() - startedAt);
}

async function measureUpload() {
  const body = new Uint8Array(UPLOAD_BYTES);
  const startedAt = performance.now();
  const response = await request('/__up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body,
  });
  await drain(response);
  return toMbps(UPLOAD_BYTES, performance.now() - startedAt);
}

function describeError(error) {
  if (error.name === 'TimeoutError') {
    return 'The speed test timed out';
  }
  if (error.message?.startsWith('Speed test server answered')) {
    return error.message;
  }
  return 'Could not reach the speed test server';
}

// Runs latency, download and upload one after another.
// Returns { success, pingMs, jitterMs, downloadMbps, uploadMbps, error }. Never throws.
// A failed test has all numbers set to null.
export async function measureInternetSpeed() {
  try {
    const { pingMs, jitterMs } = await measureLatency();
    const downloadMbps = await measureDownload();
    const uploadMbps = await measureUpload();
    return { success: true, error: null, pingMs, jitterMs, downloadMbps, uploadMbps };
  } catch (error) {
    console.error('[internet] speed test failed:', error.message);
    return {
      success: false,
      error: describeError(error),
      pingMs: null,
      jitterMs: null,
      downloadMbps: null,
      uploadMbps: null,
    };
  }
}
