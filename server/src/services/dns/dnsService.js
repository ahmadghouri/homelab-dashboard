import { HttpError } from '../../utils/httpError.js';
import { AdguardError, fetchStats, fetchStatus, postProtection } from './adguardClient.js';
import { getAdguardConfig } from './config.js';

const TOP_LIST_LIMIT = 10;

function toCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// AdGuard sends top lists as [{ "<name>": count }, ...]; a plain { name: count } object is accepted too.
function flattenTopList(list, keyName) {
  const entries = Array.isArray(list)
    ? list.flatMap((item) => (item && typeof item === 'object' ? Object.entries(item) : []))
    : Object.entries(list && typeof list === 'object' ? list : {});
  return entries
    .map(([name, count]) => ({ [keyName]: String(name).slice(0, 253), count: toCount(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_LIST_LIMIT);
}

export function mapDnsStatus(status, stats) {
  const queries = toCount(stats.num_dns_queries);
  const blocked = toCount(stats.num_blocked_filtering);
  const avgSeconds = Number(stats.avg_processing_time);
  return {
    configured: true,
    reachable: true,
    error: null,
    protectionEnabled: status.protection_enabled === true,
    version: typeof status.version === 'string' ? status.version : null,
    queries,
    blocked,
    blockedPct: queries > 0 ? round2((blocked / queries) * 100) : 0,
    avgProcessingMs: Number.isFinite(avgSeconds) ? round2(avgSeconds * 1000) : 0,
    topBlocked: flattenTopList(stats.top_blocked_domains, 'domain'),
    topClients: flattenTopList(stats.top_clients, 'client'),
  };
}

function unreachableStatus(message) {
  return {
    configured: true,
    reachable: false,
    error: message,
    protectionEnabled: null,
    version: null,
    queries: 0,
    blocked: 0,
    blockedPct: 0,
    avgProcessingMs: 0,
    topBlocked: [],
    topClients: [],
  };
}

function safeMessage(error) {
  return error instanceof AdguardError ? error.message : 'AdGuard Home request failed';
}

// Status for the dashboard. Connection problems are part of the answer, not an HTTP error.
export async function getDnsStatus(config = getAdguardConfig()) {
  if (!config) {
    return { configured: false };
  }
  try {
    const [status, stats] = await Promise.all([fetchStatus(config), fetchStats(config)]);
    return mapDnsStatus(status, stats);
  } catch (error) {
    return unreachableStatus(safeMessage(error));
  }
}

export async function setDnsProtection(enabled, config = getAdguardConfig()) {
  if (!config) {
    throw new HttpError(409, 'AdGuard Home is not configured');
  }
  try {
    await postProtection(config, enabled);
  } catch (error) {
    throw new HttpError(502, safeMessage(error));
  }
  return getDnsStatus(config);
}
