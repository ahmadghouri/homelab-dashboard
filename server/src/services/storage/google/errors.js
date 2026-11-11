// Errors from the Google client. Messages are safe to show to users: they never contain tokens,
// session URIs or Google's error bodies (those are only parsed for a reason code).

export const GOOGLE_ERROR_CODES = Object.freeze([
  'invalid_grant',
  'quota_exceeded',
  'not_found',
  'rate_limited',
  'unauthorized',
  'invalid_range',
  'server',
  'network',
]);

export class GoogleApiError extends Error {
  constructor(message, { status = 0, code = 'server' } = {}) {
    super(message);
    this.name = 'GoogleApiError';
    // HTTP status from Google, 0 when Google did not answer.
    this.status = status;
    this.code = code;
  }

  // 429 / 5xx / network problems are worth retrying later.
  get retryable() {
    return this.code === 'rate_limited' || this.code === 'server' || this.code === 'network';
  }
}

export function isInvalidGrant(error) {
  return error instanceof GoogleApiError && error.code === 'invalid_grant';
}

const QUOTA_REASONS = new Set(['storageQuotaExceeded', 'quotaExceeded', 'teamDriveFileLimitExceeded']);
const RATE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'sharingRateLimitExceeded']);
const MAX_ERROR_BODY = 16 * 1024;

// Reads at most 16 KB of an error body and returns the parsed JSON, or null. The body is never
// returned to callers, only reason codes taken from it.
async function readErrorBody(response) {
  try {
    const text = await response.text();
    return text.length > MAX_ERROR_BODY ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

function driveReasons(body) {
  const errors = body?.error?.errors;
  return Array.isArray(errors) ? errors.map((item) => item?.reason).filter(Boolean) : [];
}

// Maps a failed Google response to a GoogleApiError. `service` names the API in the message
// ("Google sign-in" or "Google Drive").
export async function errorFromResponse(response, service = 'Google Drive') {
  const status = response.status;
  const body = await readErrorBody(response);
  const oauthError = typeof body?.error === 'string' ? body.error : null;
  const reasons = driveReasons(body);

  if (oauthError === 'invalid_grant') {
    return new GoogleApiError('Google access was revoked or expired. Reconnect the account', {
      status,
      code: 'invalid_grant',
    });
  }
  if (oauthError === 'invalid_client' || oauthError === 'unauthorized_client') {
    return new GoogleApiError('Google rejected the app credentials. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET', {
      status,
      code: 'unauthorized',
    });
  }
  if (reasons.some((reason) => QUOTA_REASONS.has(reason))) {
    return new GoogleApiError('The Google Drive account is out of storage space', { status, code: 'quota_exceeded' });
  }
  if (status === 429 || reasons.some((reason) => RATE_REASONS.has(reason))) {
    return new GoogleApiError(`${service} is rate limiting requests. Try again shortly`, {
      status,
      code: 'rate_limited',
    });
  }
  if (status === 401) {
    return new GoogleApiError(`${service} rejected the access token`, { status, code: 'unauthorized' });
  }
  if (status === 403) {
    return new GoogleApiError(`${service} denied the request`, { status, code: 'unauthorized' });
  }
  if (status === 404 || status === 410) {
    return new GoogleApiError(`${service} could not find the item`, { status, code: 'not_found' });
  }
  if (status === 416) {
    return new GoogleApiError('The requested range is not valid for this file', { status, code: 'invalid_range' });
  }
  return new GoogleApiError(`${service} returned HTTP ${status}`, { status, code: 'server' });
}

// Maps a fetch() rejection (timeout, DNS, connection reset) to a GoogleApiError.
export function errorFromFetchFailure(error, service = 'Google Drive') {
  if (error?.name === 'TimeoutError') {
    return new GoogleApiError(`${service} did not answer in time`, { code: 'network' });
  }
  return new GoogleApiError(`Could not reach ${service}`, { code: 'network' });
}
