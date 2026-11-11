// Google OAuth 2.0 (authorization code flow with offline access) over plain fetch.
// Endpoints come from env.storage so tests can point them at a local mock server.
import { env } from '../../../config/env.js';
import { GoogleApiError, errorFromFetchFailure, errorFromResponse } from './errors.js';

const REQUEST_TIMEOUT_MS = 30_000;
const SERVICE = 'Google sign-in';

export const GOOGLE_SCOPES = Object.freeze([
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
]);

export function buildAuthUrl({ state }) {
  const url = new URL('/o/oauth2/v2/auth', env.storage.googleAuthBase);
  url.search = new URLSearchParams({
    client_id: env.storage.googleClientId,
    redirect_uri: env.storage.googleRedirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString();
  return url.toString();
}

async function postForm(path, params) {
  let response;
  try {
    response = await fetch(new URL(path, env.storage.googleOauthBase), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw errorFromFetchFailure(error, SERVICE);
  }
  if (!response.ok) {
    throw await errorFromResponse(response, SERVICE);
  }
  return response;
}

async function readTokenResponse(response) {
  const data = await response.json().catch(() => null);
  if (!data || typeof data.access_token !== 'string') {
    throw new GoogleApiError('Google sign-in sent an invalid response', { status: response.status, code: 'server' });
  }
  const seconds = Number(data.expires_in);
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 3600) * 1000),
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : null,
    idToken: typeof data.id_token === 'string' ? data.id_token : null,
    scope: typeof data.scope === 'string' ? data.scope : '',
  };
}

// Exchanges the callback `code`. refreshToken can be null if Google did not send one (it should,
// because of prompt=consent); `scope` lists what the user actually granted.
export async function exchangeCode(code) {
  const response = await postForm('/token', {
    grant_type: 'authorization_code',
    code,
    client_id: env.storage.googleClientId,
    client_secret: env.storage.googleClientSecret,
    redirect_uri: env.storage.googleRedirectUri,
  });
  return readTokenResponse(response);
}

// Returns a new access token. `refreshToken` is only set when Google rotated it: store it then.
// Throws GoogleApiError with code 'invalid_grant' when the grant was revoked or expired.
export async function refreshAccessToken(refreshToken) {
  const response = await postForm('/token', {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.storage.googleClientId,
    client_secret: env.storage.googleClientSecret,
  });
  const tokens = await readTokenResponse(response);
  const result = { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt };
  if (tokens.refreshToken && tokens.refreshToken !== refreshToken) {
    result.refreshToken = tokens.refreshToken;
  }
  return result;
}

export async function fetchUserInfo(accessToken) {
  let response;
  try {
    response = await fetch(new URL('/oauth2/v3/userinfo', env.storage.googleApiBase), {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw errorFromFetchFailure(error, SERVICE);
  }
  if (!response.ok) {
    throw await errorFromResponse(response, SERVICE);
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data.sub !== 'string' || !data.sub) {
    throw new GoogleApiError('Google sign-in sent an invalid profile', { status: response.status, code: 'server' });
  }
  return {
    googleUserId: data.sub,
    email: typeof data.email === 'string' ? data.email : '',
    name: typeof data.name === 'string' ? data.name : '',
    picture: typeof data.picture === 'string' ? data.picture : '',
  };
}

// Best effort: returns true when Google confirmed the revocation, false otherwise. Never throws.
export async function revokeToken(token) {
  if (!token) {
    return false;
  }
  try {
    const response = await postForm('/revoke', { token });
    await response.body?.cancel().catch(() => {});
    return true;
  } catch {
    return false;
  }
}
