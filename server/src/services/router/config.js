// Optional router integration. Env is read here only; other router modules get the config as an argument.

export const ROUTER_TYPES = ['none', 'mikrotik'];

function readConfig() {
  const type = (process.env.ROUTER_TYPE ?? 'none').trim().toLowerCase() || 'none';
  const url = (process.env.ROUTER_URL ?? '').trim();
  const user = (process.env.ROUTER_USER ?? '').trim();
  const password = process.env.ROUTER_PASSWORD ?? '';
  const tlsInsecure = (process.env.ROUTER_TLS_INSECURE ?? '').trim().toLowerCase() === 'true';

  if (type === 'none') {
    return { type: 'none', configured: false, error: null };
  }
  if (!ROUTER_TYPES.includes(type)) {
    return { type, configured: false, error: `Unknown ROUTER_TYPE "${type}". Use none or mikrotik` };
  }
  if (!url || !user) {
    return { type, configured: false, error: 'ROUTER_URL and ROUTER_USER must be set' };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { type, configured: false, error: 'ROUTER_URL is not a valid URL' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    return { type, configured: false, error: 'ROUTER_URL must be http(s)://host[:port] without a login' };
  }

  return {
    type,
    configured: true,
    error: null,
    // Only the origin is kept; the client adds /rest/... itself.
    url: parsed.origin,
    host: parsed.hostname,
    user,
    password,
    tlsInsecure,
  };
}

let cached = null;

// Read lazily so the value does not depend on module load order.
export function getRouterConfig() {
  cached ??= readConfig();
  return cached;
}
