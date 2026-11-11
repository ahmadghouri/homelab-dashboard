import http from 'node:http';
import https from 'node:https';

// Download speed test over one line: the request socket is bound to the line's IPv4 address.
// Uses real data (10 MB by default), so it only runs when asked from the dashboard.

export const SPEED_TEST_URL = 'https://speed.cloudflare.com/__down?bytes=10000000';
const TIMEOUT_MS = 30_000;
// Stop reading if a server sends more than asked for.
const MAX_BYTES = 12_000_000;

const running = new Set();

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function download(url, localAddress, timeoutMs) {
  return new Promise((resolve) => {
    const client = url.protocol === 'http:' ? http : https;
    let settled = false;
    let request = null;

    function finish(result) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      request?.destroy();
      resolve(result);
    }

    const timer = setTimeout(
      () => finish({ ok: false, output: `Speed test timed out after ${timeoutMs / 1000} s` }),
      timeoutMs,
    );

    request = client.get(url, { localAddress, agent: false }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        finish({ ok: false, output: `Speed test server answered with HTTP ${response.statusCode}` });
        return;
      }
      const startedAt = process.hrtime.bigint();
      let bytes = 0;
      response.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) {
          finish({ ok: false, output: 'Speed test server sent too much data' });
        }
      });
      response.on('end', () => {
        const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
        finish({ ok: true, bytes, seconds: Math.max(seconds, 0.001) });
      });
      response.on('error', (error) => finish({ ok: false, output: error.message }));
    });
    request.on('error', (error) => finish({ ok: false, output: `Download failed: ${error.message}` }));
  });
}

// Returns { ok, downloadMbps, output } (plus busy: true when a test already runs on this line).
export async function runLineSpeedTest(line, { url = SPEED_TEST_URL, timeoutMs = TIMEOUT_MS } = {}) {
  if (running.has(line.id)) {
    return {
      ok: false,
      busy: true,
      downloadMbps: null,
      output: 'A speed test is already running on this line',
    };
  }
  running.add(line.id);
  try {
    const result = await download(new URL(url), line.ip, timeoutMs);
    if (!result.ok) {
      return { ok: false, downloadMbps: null, output: result.output };
    }
    const downloadMbps = round((result.bytes * 8) / result.seconds / 1e6);
    const megabytes = round(result.bytes / 1e6);
    return {
      ok: true,
      downloadMbps,
      output: `${downloadMbps} Mbps download (${megabytes} MB in ${round(result.seconds)} s)`,
    };
  } finally {
    running.delete(line.id);
  }
}
