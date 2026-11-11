// Chooses the internet line for each new outgoing connection.
// One connection always stays on the line it was opened on; only NEW connections are spread.

export const SELECTOR_MODES = ['balanced', 'weighted', 'failover'];

const STICKY_TTL_MS = 10 * 60_000;
const MAX_STICKY_HOSTS = 10_000;
// Consecutive connect failures that put a line in a short cooldown (it is tried last until then).
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 30_000;

function normalizeHost(host) {
  return typeof host === 'string' ? host.trim().toLowerCase() : '';
}

function isOverCap(line) {
  const cap = line.capBytes;
  return typeof cap === 'number' && cap >= 0 && Number(line.usedBytes ?? 0) >= cap;
}

function isUsable(line) {
  return Boolean(line?.id && line.ip && line.up) && line.role !== 'off' && !isOverCap(line);
}

function weightOf(line) {
  const weight = Number(line.weight);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

/**
 * @param {{ getLines: () => Array<{ id: string, ip: string, up: boolean, role: 'active' | 'backup' | 'off',
 *   weight?: number, capBytes?: number | null, usedBytes?: number }>, now?: () => number }} options
 */
export function createSelector({ getLines, now = Date.now }) {
  let mode = 'balanced';
  let sticky = true;
  let order = [];
  let roundRobin = 0;
  // Smooth weighted round robin state (lineId -> current weight).
  const currentWeights = new Map();
  // host -> { lineId, expiresAt }
  const stickyHosts = new Map();
  // lineId -> { picks, failures, consecutive, cooldownUntil }
  const health = new Map();

  function healthOf(lineId) {
    let entry = health.get(lineId);
    if (!entry) {
      entry = { picks: 0, failures: 0, consecutive: 0, cooldownUntil: 0 };
      health.set(lineId, entry);
    }
    return entry;
  }

  function isCoolingDown(lineId) {
    return (health.get(lineId)?.cooldownUntil ?? 0) > now();
  }

  // Configured order first, then the remaining lines in detection order.
  function sortByOrder(lines) {
    const rank = (line) => {
      const index = order.indexOf(line.id);
      return index === -1 ? order.length : index;
    };
    return lines
      .map((line, index) => ({ line, index }))
      .sort((a, b) => rank(a.line) - rank(b.line) || a.index - b.index)
      .map((entry) => entry.line);
  }

  // Active lines first (lines without recent failures before the rest); backup lines only when
  // no active line can be used.
  function candidatePool(lines, excluded) {
    const usable = lines.filter((line) => isUsable(line) && !excluded.has(line.id));
    for (const role of ['active', 'backup']) {
      const tier = usable.filter((line) => line.role === role);
      if (tier.length === 0) {
        continue;
      }
      const healthy = tier.filter((line) => !isCoolingDown(line.id));
      return healthy.length > 0 ? healthy : tier;
    }
    return [];
  }

  function pickWeighted(pool) {
    let total = 0;
    let best = null;
    let bestWeight = -Infinity;
    for (const line of pool) {
      const weight = weightOf(line);
      const current = (currentWeights.get(line.id) ?? 0) + weight;
      currentWeights.set(line.id, current);
      total += weight;
      if (current > bestWeight) {
        best = line;
        bestWeight = current;
      }
    }
    currentWeights.set(best.id, bestWeight - total);
    return best;
  }

  function pickByMode(pool) {
    if (mode === 'failover') {
      return sortByOrder(pool)[0];
    }
    if (mode === 'weighted') {
      return pickWeighted(pool);
    }
    const line = pool[roundRobin % pool.length];
    roundRobin = (roundRobin + 1) % Number.MAX_SAFE_INTEGER;
    return line;
  }

  function pruneStickyHosts() {
    const time = now();
    for (const [host, entry] of stickyHosts) {
      if (entry.expiresAt <= time) {
        stickyHosts.delete(host);
      }
    }
    // Still full: drop the oldest entries (Map keeps insertion order).
    for (const host of stickyHosts.keys()) {
      if (stickyHosts.size < MAX_STICKY_HOSTS) {
        break;
      }
      stickyHosts.delete(host);
    }
  }

  function rememberHost(host, lineId) {
    stickyHosts.delete(host);
    if (stickyHosts.size >= MAX_STICKY_HOSTS) {
      pruneStickyHosts();
    }
    stickyHosts.set(host, { lineId, expiresAt: now() + STICKY_TTL_MS });
  }

  // Failover keeps everything on the first line anyway, so sticky only matters for the other modes.
  function usesSticky(host) {
    return sticky && mode !== 'failover' && host !== '';
  }

  function stickyLine(host, pool) {
    const entry = stickyHosts.get(host);
    if (!entry || entry.expiresAt <= now()) {
      return null;
    }
    return pool.find((line) => line.id === entry.lineId) ?? null;
  }

  /**
   * Returns the line for a new connection to `host`, or null when no line can be used.
   * `exclude` lists line ids already tried for this connection.
   */
  function pick({ host, exclude } = {}) {
    const lines = getLines();
    const pool = candidatePool(Array.isArray(lines) ? lines : [], new Set(exclude ?? []));
    if (pool.length === 0) {
      return null;
    }
    const key = normalizeHost(host);
    const line = (usesSticky(key) && stickyLine(key, pool)) || pickByMode(pool);
    if (usesSticky(key)) {
      rememberHost(key, line.id);
    }
    healthOf(line.id).picks += 1;
    return line;
  }

  function reportFailure(lineId) {
    const entry = healthOf(lineId);
    entry.failures += 1;
    entry.consecutive += 1;
    if (entry.consecutive < FAILURE_THRESHOLD) {
      return;
    }
    entry.consecutive = 0;
    entry.cooldownUntil = now() + COOLDOWN_MS;
    for (const [host, sticked] of stickyHosts) {
      if (sticked.lineId === lineId) {
        stickyHosts.delete(host);
      }
    }
  }

  function reportSuccess(lineId) {
    const entry = healthOf(lineId);
    entry.consecutive = 0;
    entry.cooldownUntil = 0;
  }

  // Applies the given fields; missing fields keep their value. Throws on invalid values.
  function setConfig(next = {}) {
    if (next.mode !== undefined && !SELECTOR_MODES.includes(next.mode)) {
      throw new TypeError(`Invalid mode: ${next.mode}`);
    }
    if (next.sticky !== undefined && typeof next.sticky !== 'boolean') {
      throw new TypeError('sticky must be a boolean');
    }
    if (next.order !== undefined && !(Array.isArray(next.order) && next.order.every((id) => typeof id === 'string'))) {
      throw new TypeError('order must be an array of line ids');
    }
    if (next.mode !== undefined && next.mode !== mode) {
      mode = next.mode;
      stickyHosts.clear();
      currentWeights.clear();
    }
    if (next.sticky !== undefined) {
      sticky = next.sticky;
      if (!sticky) {
        stickyHosts.clear();
      }
    }
    if (next.order !== undefined) {
      order = [...next.order];
    }
  }

  function stats() {
    const lines = {};
    for (const [lineId, entry] of health) {
      lines[lineId] = {
        picks: entry.picks,
        failures: entry.failures,
        coolingDown: isCoolingDown(lineId),
      };
    }
    return { mode, sticky, order: [...order], stickyHosts: stickyHosts.size, lines };
  }

  return { pick, reportFailure, reportSuccess, setConfig, stats };
}
