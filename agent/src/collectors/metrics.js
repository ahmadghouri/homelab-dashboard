import os from 'node:os';
import si from 'systeminformation';

// Slow checks (disk, battery, temperature, processes) take up to ~2s on Windows,
// so they run every 30s and their last result is reused in between.
const SLOW_REFRESH_MS = 30_000;
const TOP_PROCESS_COUNT = 5;
// Pseudo processes that only represent idle CPU time.
const IGNORED_PROCESSES = new Set(['System Idle Process', 'Idle']);

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampPercent(value) {
  return round(Math.min(100, Math.max(0, value ?? 0)));
}

async function collectFast() {
  const [load, mem, network] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.networkStats(), // default interface. rx_sec / tx_sec are null on the first call.
  ]);

  const usedBytes = mem.active ?? mem.used;
  return {
    cpu: clampPercent(load.currentLoad),
    mem: {
      usedPct: clampPercent((usedBytes / mem.total) * 100),
      usedBytes,
      totalBytes: mem.total,
    },
    net: {
      rxBps: Math.max(0, Math.round(network[0]?.rx_sec ?? 0)),
      txBps: Math.max(0, Math.round(network[0]?.tx_sec ?? 0)),
    },
  };
}

async function collectSlow() {
  const [disks, battery, temperature, processes] = await Promise.all([
    si.fsSize(),
    si.battery(),
    si.cpuTemperature(),
    si.processes(),
  ]);

  return {
    disks: disks
      .filter((disk) => disk.size > 0)
      .slice(0, 32)
      .map((disk) => ({
        mount: disk.mount,
        usedPct: clampPercent(disk.use),
        sizeBytes: disk.size,
        usedBytes: disk.used,
      })),
    // Often null on Windows without admin rights.
    tempC: typeof temperature.main === 'number' ? round(temperature.main) : null,
    battery: battery.hasBattery
      ? { percent: clampPercent(battery.percent), charging: Boolean(battery.isCharging) }
      : null,
    topProcesses: processes.list
      .filter((process) => !IGNORED_PROCESSES.has(process.name))
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, TOP_PROCESS_COUNT)
      .map((process) => ({
        pid: process.pid,
        name: process.name.slice(0, 200),
        cpu: round(Math.max(0, process.cpu)),
        memBytes: Math.max(0, process.memRss * 1024), // memRss is in KB
      })),
  };
}

export function createMetricsCollector() {
  let slow = null;
  let slowCollectedAt = 0;

  return async function collectMetrics() {
    const now = Date.now();
    const needsSlow = !slow || now - slowCollectedAt >= SLOW_REFRESH_MS;

    const [fast, freshSlow] = await Promise.all([
      collectFast(),
      needsSlow ? collectSlow() : null,
    ]);

    if (freshSlow) {
      slow = freshSlow;
      slowCollectedAt = now;
    }

    return { ...fast, ...slow, uptimeSec: Math.round(os.uptime()) };
  };
}
