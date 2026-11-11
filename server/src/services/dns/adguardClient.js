// Minimal AdGuard Home API client. Takes its config as a parameter (see config.js).
// Error messages are safe to show: they never contain the URL credentials or the password.

const REQUEST_TIMEOUT_MS = 8000;

export class AdguardError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AdguardError';
    // HTTP status returned by AdGuard Home, if any (used for the protection endpoint fallback).
    this.status = status;
  }
}

function baseUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AdguardError('ADGUARD_URL is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AdguardError('ADGUARD_URL must start with http:// or https://');
  }
  // Credentials belong in ADGUARD_USER / ADGUARD_PASSWORD, never in the URL.
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function authHeader({ user, password }) {
  if (!user && !password) {
    return {};
  }
  const token = Buffer.from(`${user}:${password}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

function errorForStatus(status) {
  if (status === 401 || status === 403 || (status >= 300 && status < 400)) {
    return new AdguardError('AdGuard Home rejected the login. Check ADGUARD_USER and ADGUARD_PASSWORD', status);
  }
  return new AdguardError(`AdGuard Home returned HTTP ${status}`, status);
}

async function request(config, path, { method = 'GET', body, expectJson = true } = {}) {
  const url = `${baseUrl(config.url)}${path}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...authHeader(config),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      throw new AdguardError('AdGuard Home did not answer in time');
    }
    throw new AdguardError('AdGuard Home did not answer');
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw errorForStatus(response.status);
  }
  if (!expectJson) {
    await response.body?.cancel().catch(() => {});
    return null;
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    throw new AdguardError('AdGuard Home sent an invalid response');
  }
  return data;
}

export function fetchStatus(config) {
  return request(config, '/control/status');
}

export function fetchStats(config) {
  return request(config, '/control/stats');
}

// Newer versions use /control/protection; older ones only know /control/dns_config.
export async function postProtection(config, enabled) {
  try {
    await request(config, '/control/protection', {
      method: 'POST',
      body: { enabled },
      expectJson: false,
    });
  } catch (error) {
    if (!(error instanceof AdguardError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }
    await request(config, '/control/dns_config', {
      method: 'POST',
      body: { protection_enabled: enabled },
      expectJson: false,
    });
  }
}
