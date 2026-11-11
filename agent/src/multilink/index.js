import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import { createHealthMonitor } from './health.js';
import { createLineDetector } from './lines.js';
import { runLineSpeedTest } from './lineSpeedTest.js';
import { createSettingsStore, isValidLineId, MAX_LINES, validateSettings } from './settingsStore.js';

// Multi-Link Manager: detects the internet lines of this PC, checks their health, sends a status
// snapshot to the server and answers settings / speed test / usage reset requests.
// With MULTILINK=on it also runs the local load-balancing proxy (127.0.0.1 only).
// Never changes any OS network setting.

const SNAPSHOT_INTERVAL_MS = 5000;
const DETECT_INTERVAL_MS = 10_000;
const HEALTH_INTERVAL_MS = 15_000;
const CHANGE_DELAY_MS = 300;
const MAX_OUTPUT_LENGTH = 500;

export const MULTILINK_OFF_MESSAGE =
  'Multi-Link is turned off on this PC (set MULTILINK=on in agent/.env)';

// Settings and usage files are per device (named by a short hash of the agent token, never the
// token itself), so two agents on one PC (for example a test agent) never share them.
function deviceFile(prefix) {
  const suffix = crypto.createHash('sha256').update(config.agentToken).digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), 'homelab-agent', `${prefix}-${suffix}.json`);
}

const NO_USAGE = Object.freeze({ usedBytes: 0, rxBps: 0, txBps: 0, connections: 0 });

function reply(ok, output, extra = {}) {
  return { ok, output: String(output ?? '').trim().slice(0, MAX_OUTPUT_LENGTH), ...extra };
}

function readLineId(payload) {
  const lineId = payload?.lineId;
  return isValidLineId(lineId) ? lineId : null;
}

function toCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

// The proxy, selector and usage modules are loaded only when Multi-Link is on, so a problem in
// them never stops the agent: it only shows up as proxy.error in the snapshot.
async function startEngine({ httpPort, socksPort, getSelectorLines, usageFile }) {
  const [{ startProxy }, { createSelector }, { createUsage }] = await Promise.all([
    import('./proxy/index.js'),
    import('./selector.js'),
    import('./usage.js'),
  ]);
  const usage = createUsage({ filePath: usageFile });
  const selector = createSelector({ getLines: getSelectorLines });
  const proxy = startProxy({ httpPort, socksPort, selector, usage, logger: console });
  // Port problems do not throw: they show up in proxy.status().error.
  await proxy.ready;
  return { usage, selector, proxy };
}

/**
 * Options exist for tests (fake lines on 127.0.0.x): `enabled`, `httpPort`, `socksPort`,
 * `detector` ({ detect() }), `healthOptions` (checkLine options), `settingsFile`, `speedTestUrl`,
 * `startEngine`.
 */
export function registerMultiLink(socket, options = {}) {
  const enabled = options.enabled ?? config.multiLink;
  const httpPort = options.httpPort ?? config.multiLinkHttpPort;
  const socksPort = options.socksPort ?? config.multiLinkSocksPort;
  const detector = options.detector ?? createLineDetector();
  const store = createSettingsStore({
    file: options.settingsFile ?? deviceFile('multilink-settings'),
  });
  const health = createHealthMonitor({
    checkOptions: options.healthOptions,
    onLineStatus(line, up) {
      console.log(`[agent] multilink: line ${line.id} is ${up ? 'up' : 'down'}`);
      scheduleSnapshot();
    },
  });

  // A broken file never throws (defaults are used), so this promise always resolves.
  const loaded = store.load();
  let lines = [];
  let engine = null;
  let engineError = null;
  let changeTimer = null;
  const timers = [];

  function usageOf(lineId) {
    if (!engine) {
      return NO_USAGE;
    }
    const entry = engine.usage.lineStats(lineId) ?? {};
    return {
      usedBytes: toCount(entry.usedBytes),
      rxBps: toCount(entry.rxBps),
      txBps: toCount(entry.txBps),
      connections: toCount(entry.connections),
    };
  }

  function weightOf(lineId) {
    const test = store.lastSpeedTest(lineId);
    return test?.ok && test.downloadMbps > 0 ? test.downloadMbps : 1;
  }

  // Current lines as the selector needs them.
  function selectorLines() {
    return lines.map((line) => ({
      id: line.id,
      ip: line.ip,
      up: health.get(line.id).up,
      ...store.lineSettings(line),
      weight: weightOf(line.id),
      usedBytes: usageOf(line.id).usedBytes,
    }));
  }

  function applySelectorConfig() {
    if (!engine) {
      return;
    }
    const { mode, sticky } = store.get();
    engine.selector.setConfig({ mode, sticky, order: store.order(lines) });
  }

  function proxyStatus() {
    if (engine) {
      return engine.proxy.status();
    }
    const error = enabled && engineError ? `Proxy could not start: ${engineError}` : null;
    return { listening: false, httpPort, socksPort, error };
  }

  function buildSnapshot() {
    const rows = lines.slice(0, MAX_LINES).map((line) => {
      const state = health.get(line.id);
      const { role, capBytes } = store.lineSettings(line);
      return {
        id: line.id,
        name: line.name,
        kind: line.kind,
        ip: line.ip,
        up: state.up,
        latencyMs: state.latencyMs,
        lossPct: state.lossPct,
        role,
        capBytes,
        ...usageOf(line.id),
        lastSpeedTest: store.lastSpeedTest(line.id),
      };
    });
    const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
    const { mode, sticky } = store.get();
    return {
      at: new Date().toISOString(),
      enabled,
      proxy: proxyStatus(),
      mode,
      sticky,
      lines: rows,
      totals: { rxBps: sum('rxBps'), txBps: sum('txBps'), connections: sum('connections') },
    };
  }

  function sendSnapshot() {
    if (!socket.connected) {
      return;
    }
    try {
      socket.emit('agent:multilink', buildSnapshot());
    } catch (error) {
      console.error('[agent] could not build the multilink snapshot:', error.message);
    }
  }

  function scheduleSnapshot() {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(sendSnapshot, CHANGE_DELAY_MS);
  }

  function checkHealth() {
    health.checkAll(lines).catch((error) => {
      console.error('[agent] multilink health check failed:', error.message);
    });
  }

  async function refreshLines() {
    let detected;
    try {
      detected = await detector.detect();
    } catch (error) {
      console.error('[agent] multilink: could not detect lines:', error.message);
      return;
    }
    const key = (list) => list.map((line) => `${line.id}|${line.ip}|${line.kind}`).join(',');
    const changed = key(detected) !== key(lines);
    lines = detected;
    if (changed) {
      console.log(`[agent] multilink: ${lines.length} line(s): ${lines.map((l) => l.id).join(', ')}`);
      applySelectorConfig();
      checkHealth();
      scheduleSnapshot();
    }
  }

  async function handleConfig(payload) {
    const result = validateSettings(payload);
    if (result.error) {
      return reply(false, `Invalid Multi-Link settings: ${result.error}`);
    }
    await store.save(result.settings);
    applySelectorConfig();
    console.log(`[agent] multilink settings saved (mode ${result.settings.mode})`);
    return reply(true, 'Multi-Link settings saved');
  }

  async function handleSpeedTest(payload) {
    const lineId = readLineId(payload);
    if (!lineId) {
      return reply(false, 'Invalid line', { downloadMbps: null });
    }
    if (!enabled) {
      return reply(false, MULTILINK_OFF_MESSAGE, { downloadMbps: null });
    }
    const line = lines.find((item) => item.id === lineId);
    if (!line) {
      return reply(false, 'This line is not connected', { downloadMbps: null });
    }
    if (store.lineSettings(line).role === 'off') {
      return reply(false, 'This line is turned off in the Multi-Link settings', {
        downloadMbps: null,
      });
    }
    const result = await runLineSpeedTest(line, { url: options.speedTestUrl });
    if (!result.busy) {
      await store.recordSpeedTest(lineId, {
        at: new Date().toISOString(),
        ok: result.ok,
        downloadMbps: result.downloadMbps,
      });
    }
    console.log(`[agent] multilink speed test on ${lineId}: ${result.ok ? 'ok' : 'failed'}`);
    return reply(result.ok, result.output, { downloadMbps: result.downloadMbps });
  }

  async function handleReset(payload) {
    const lineId = readLineId(payload);
    if (!lineId) {
      return reply(false, 'Invalid line');
    }
    if (!enabled) {
      return reply(false, MULTILINK_OFF_MESSAGE);
    }
    if (!engine) {
      return reply(false, 'The Multi-Link proxy is not running on this PC');
    }
    await engine.usage.reset(lineId);
    console.log(`[agent] multilink usage reset on ${lineId}`);
    return reply(true, 'Data usage reset');
  }

  // The server waits for the acknowledgement, so always answer, even for invalid payloads.
  function onRequest(event, handler, failure) {
    socket.on(event, async (payload, ack) => {
      if (typeof ack !== 'function') {
        return;
      }
      try {
        // Settings sent right after connecting must not be overwritten by the file loading.
        await loaded;
        ack(await handler(payload));
      } catch (error) {
        console.error(`[agent] ${event} failed:`, error.message);
        ack(reply(false, 'Agent error', failure));
      }
      scheduleSnapshot();
    });
  }

  onRequest('agent:multilink:config', handleConfig);
  onRequest('agent:multilink:speedtest', handleSpeedTest, { downloadMbps: null });
  onRequest('agent:multilink:reset', handleReset);
  socket.on('connect', scheduleSnapshot);

  async function start() {
    await loaded;
    await refreshLines();
    if (enabled) {
      try {
        engine = await (options.startEngine ?? startEngine)({
          httpPort,
          socksPort,
          getSelectorLines: selectorLines,
          usageFile: options.usageFile ?? deviceFile('multilink-usage'),
        });
        applySelectorConfig();
      } catch (error) {
        engineError = error.message;
        console.error('[agent] multilink: the proxy could not start:', error.message);
      }
    }
    scheduleSnapshot();
    timers.push(
      setInterval(refreshLines, DETECT_INTERVAL_MS),
      setInterval(checkHealth, HEALTH_INTERVAL_MS),
      setInterval(sendSnapshot, SNAPSHOT_INTERVAL_MS),
    );
  }

  const started = start().catch((error) => {
    console.error('[agent] multilink could not start:', error.message);
  });

  // Stops the timers and the proxy (agent shutdown, tests).
  async function stop() {
    await started;
    timers.forEach(clearInterval);
    clearTimeout(changeTimer);
    try {
      await engine?.proxy.stop();
      await engine?.usage.stop?.();
    } catch (error) {
      console.error('[agent] multilink: stop failed:', error.message);
    }
  }

  return { stop, ready: started, buildSnapshot };
}
