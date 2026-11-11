import http from 'node:http';
import https from 'node:https';
import { HttpError } from '../../utils/httpError.js';

const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_REASON_LENGTH = 200;

const TLS_ERROR_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

// Router problems become a 502 with a safe message. The password and auth header never appear in it.
export class RouterError extends HttpError {
  constructor(message) {
    super(502, message);
    this.name = 'RouterError';
  }
}

function networkError(error) {
  if (TLS_ERROR_CODES.has(error?.code)) {
    return new RouterError(
      'Router TLS certificate is not trusted. Set ROUTER_TLS_INSECURE=true only for your own router',
    );
  }
  return new RouterError('Router did not answer');
}

function statusError(status, body, password) {
  if (status === 401) {
    return new RouterError('Router rejected the login');
  }
  if (status === 403) {
    return new RouterError('The router user is not allowed to do this');
  }
  if (status === 404) {
    return new RouterError('Router does not support this request (RouterOS 7 REST API needed)');
  }
  let reason = [body?.message, body?.detail].filter((part) => typeof part === 'string').join(': ');
  if (password) {
    reason = reason.split(password).join('***');
  }
  reason = reason.slice(0, MAX_REASON_LENGTH) || `HTTP ${status}`;
  return new RouterError(`Router rejected the request: ${reason}`);
}

function parseBody(text) {
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Minimal RouterOS 7 REST client. config = { url, user, password, tlsInsecure } from config.js.
// node:http(s) is used so a self-signed certificate can be allowed for this client only.
export function createMikrotikClient(config) {
  const base = new URL(config.url);
  const isHttps = base.protocol === 'https:';
  const transport = isHttps ? https : http;
  // A private agent: rejectUnauthorized=false never affects other HTTPS requests of the server.
  const agent = isHttps && config.tlsInsecure ? new https.Agent({ rejectUnauthorized: false }) : undefined;
  const authorization = `Basic ${Buffer.from(`${config.user}:${config.password}`).toString('base64')}`;

  function request(method, path, { query, body } = {}) {
    const url = new URL(`/rest${path}`, base);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }
    const payload = body === undefined ? undefined : JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const req = transport.request(
        url,
        {
          method,
          agent,
          headers: {
            Authorization: authorization,
            Accept: 'application/json',
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
        (res) => {
          const chunks = [];
          let size = 0;
          res.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_RESPONSE_BYTES) {
              req.destroy();
              reject(new RouterError('Router sent a response that is too large'));
              return;
            }
            chunks.push(chunk);
          });
          res.on('error', () => reject(new RouterError('Router did not answer')));
          res.on('end', () => {
            const data = parseBody(Buffer.concat(chunks).toString('utf8'));
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(statusError(res.statusCode, data, config.password));
            } else if (data === undefined) {
              reject(new RouterError('Router sent an invalid response'));
            } else {
              resolve(data);
            }
          });
        },
      );
      req.on('error', (error) => reject(networkError(error)));
      req.end(payload);
    });
  }

  return {
    get: (path, query) => request('GET', path, { query }),
    put: (path, body) => request('PUT', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    del: (path) => request('DELETE', path),
  };
}

// RouterOS ids look like "*1A". They go into the URL path, so they are checked first.
export function idPath(prefix, id) {
  if (typeof id !== 'string' || !/^\*[0-9A-Fa-f]+$/.test(id)) {
    throw new RouterError('Router sent an invalid item id');
  }
  return `${prefix}/${encodeURIComponent(id)}`;
}
