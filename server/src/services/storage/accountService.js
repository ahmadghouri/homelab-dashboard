import { env } from '../../config/env.js';
import { OAuthState } from '../../models/OAuthState.js';
import { StorageAccount } from '../../models/StorageAccount.js';
import { StorageFile } from '../../models/StorageFile.js';
import { User } from '../../models/User.js';
import { emitToDashboard } from '../../sockets/registry.js';
import { HttpError } from '../../utils/httpError.js';
import { onStorageAccountError, onStorageAccountRemoved, onStorageQuota } from '../alertEngine.js';
import { logActivity } from './activityService.js';
import { decryptSecret, encryptSecret, randomToken, sha256 } from './crypto.js';
import { ensureAppFolder, getQuota } from './google/driveApi.js';
import {
  buildAuthUrl,
  exchangeCode,
  fetchUserInfo,
  refreshAccessToken,
  revokeToken,
} from './google/oauth.js';

export { releaseSpace, reserveSpace } from './accountSelector.js';

// Refresh the access token when it has less than this left.
const REFRESH_MARGIN_MS = 60 * 1000;
const REVOKED_MESSAGE = 'Google access was revoked or expired. Reconnect the account.';

// One refresh at a time per account: parallel uploads share the same refresh call.
const refreshing = new Map();

export function notifyAccountsChanged() {
  emitToDashboard('storage:accounts', {});
}

function alertTarget(account) {
  return { id: account._id.toString(), email: account.email };
}

export function reconnectError(account) {
  return new HttpError(502, `Drive account ${account.email} needs to be reconnected`);
}

// Alert hooks must never break the request that triggered them.
async function runHook(label, promise) {
  try {
    await promise;
  } catch (error) {
    console.error(`[storage] ${label} failed:`, error.message);
  }
}

export async function markAccountBroken(account, message) {
  await StorageAccount.updateOne(
    { _id: account._id },
    { $set: { status: 'error', lastError: message } },
  );
  await runHook('account error alert', onStorageAccountError(alertTarget(account), message));
  notifyAccountsChanged();
}

async function refreshTokens(account) {
  let tokens;
  try {
    tokens = await refreshAccessToken(decryptSecret(account.refreshTokenEnc));
  } catch (error) {
    if (error.code === 'invalid_grant') {
      await markAccountBroken(account, REVOKED_MESSAGE);
      throw reconnectError(account);
    }
    console.error(`[storage] token refresh failed for account ${account._id}:`, error.code);
    throw new HttpError(502, 'Google Drive is not reachable right now. Try again later.');
  }

  const update = {
    accessTokenEnc: encryptSecret(tokens.accessToken),
    tokenExpiresAt: tokens.expiresAt,
  };
  // Google may rotate the refresh token; the new one must replace the old one.
  if (tokens.refreshToken) {
    update.refreshTokenEnc = encryptSecret(tokens.refreshToken);
  }
  await StorageAccount.updateOne({ _id: account._id }, { $set: update });
  return tokens.accessToken;
}

// A valid Google access token for the account (refreshed and stored when it is about to expire).
export async function getAccessToken(accountId) {
  const account = await StorageAccount.findById(accountId).select(
    '+accessTokenEnc +refreshTokenEnc +tokenExpiresAt email status',
  );
  if (!account) {
    throw new HttpError(404, 'Drive account not found');
  }
  if (account.status !== 'connected' || !account.refreshTokenEnc) {
    throw reconnectError(account);
  }

  const expiresAt = account.tokenExpiresAt?.getTime() ?? 0;
  if (account.accessTokenEnc && expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return decryptSecret(account.accessTokenEnc);
  }

  const key = account._id.toString();
  if (!refreshing.has(key)) {
    refreshing.set(
      key,
      refreshTokens(account).finally(() => refreshing.delete(key)),
    );
  }
  return refreshing.get(key);
}

function usedPercent(quota) {
  if (!quota.totalBytes) {
    return null;
  }
  return (quota.usedBytes / quota.totalBytes) * 100;
}

// Reads the account's quota from Google, stores it and updates the "almost full" alert.
export async function syncQuota(accountId) {
  const accessToken = await getAccessToken(accountId);
  let quota;
  try {
    quota = await getQuota(accessToken);
  } catch (error) {
    const account = await StorageAccount.findById(accountId).select('email');
    if (error.code === 'invalid_grant') {
      await markAccountBroken(account, REVOKED_MESSAGE);
      throw reconnectError(account);
    }
    console.error(`[storage] quota sync failed for account ${accountId}:`, error.code);
    throw new HttpError(502, 'Could not read the Drive storage quota. Try again later.');
  }

  const account = await StorageAccount.findByIdAndUpdate(
    accountId,
    {
      $set: {
        quota: {
          totalBytes: quota.totalBytes ?? null,
          usedBytes: quota.usedBytes ?? 0,
          trashBytes: quota.trashBytes ?? 0,
        },
        lastSyncedAt: new Date(),
        lastError: null,
      },
    },
    { returnDocument: 'after' },
  );
  if (!account) {
    throw new HttpError(404, 'Drive account not found');
  }

  await runHook('quota alert', onStorageQuota(alertTarget(account), usedPercent(account.quota)));
  await runHook('account error alert', onStorageAccountError(alertTarget(account), null));
  notifyAccountsChanged();
  return account;
}

// ---------- Management (admin) ----------

export function isGoogleConfigured() {
  return Boolean(env.storage.googleClientId && env.storage.googleClientSecret);
}

export function getSetupInfo() {
  return { googleConfigured: isGoogleConfigured(), redirectUri: env.storage.googleRedirectUri };
}

export function listAccounts() {
  return StorageAccount.find().sort({ priority: 1, createdAt: 1 });
}

async function findAccountOrThrow(id) {
  const account = await StorageAccount.findById(id);
  if (!account) {
    throw new HttpError(404, 'Drive account not found');
  }
  return account;
}

// patch: { acceptUploads?, priority? } (already validated)
export async function updateAccount(id, patch) {
  const account = await findAccountOrThrow(id);
  account.set(patch);
  await account.save();
  notifyAccountsChanged();
  return account;
}

export async function disconnectAccount(id, user) {
  const account = await StorageAccount.findById(id).select('+refreshTokenEnc');
  if (!account) {
    throw new HttpError(404, 'Drive account not found');
  }
  // Trashed files count too: they still live on this account until purged.
  const files = await StorageFile.countDocuments({ accountId: account._id });
  if (files > 0) {
    throw new HttpError(
      409,
      `This account still holds ${files} file${files === 1 ? '' : 's'}. Delete them (and empty the trash) first.`,
      { files },
    );
  }

  if (account.refreshTokenEnc) {
    try {
      await revokeToken(decryptSecret(account.refreshTokenEnc));
    } catch (error) {
      console.error(`[storage] token revoke failed for account ${account._id}:`, error.code);
    }
  }
  await StorageAccount.deleteOne({ _id: account._id });
  await runHook('alert cleanup', onStorageAccountRemoved(account._id.toString()));
  await recordActivity(user, 'account_disconnect', account);
  notifyAccountsChanged();
}

async function recordActivity(user, action, account) {
  await runHook(
    'activity log',
    logActivity({
      user,
      action,
      targetType: 'account',
      targetId: account._id,
      targetName: account.email,
    }),
  );
}

// ---------- Google connect flow ----------

const STATE_TTL_MS = 10 * 60 * 1000;

class ConnectError extends Error {}

// Creates a single-use state bound to the admin and returns the Google consent URL.
export async function createConnectUrl(user) {
  if (!isGoogleConfigured()) {
    throw new HttpError(409, 'Google Drive is not configured on the server');
  }
  const state = randomToken();
  await OAuthState.create({
    stateHash: sha256(state),
    userId: user._id,
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  });
  return buildAuthUrl({ state });
}

// Marks the state used (atomically, so it works once) and returns the admin who started it.
async function consumeState(state) {
  const now = new Date();
  const entry = await OAuthState.findOneAndUpdate(
    { stateHash: sha256(state), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  ).lean();
  const user = entry && (await User.findById(entry.userId));
  if (!user || user.role !== 'admin') {
    throw new ConnectError('This connect link is invalid or expired. Start again from Drive > Accounts.');
  }
  return user;
}

async function nextPriority() {
  const last = await StorageAccount.findOne().sort({ priority: -1 }).select('priority').lean();
  return last ? last.priority + 1 : 0;
}

async function upsertAccount(tokens, profile, user) {
  const existing = await StorageAccount.exists({ googleUserId: profile.googleUserId });
  if (!tokens.refreshToken && !existing) {
    throw new ConnectError(
      'Google did not grant offline access. Remove the app in your Google account settings and connect again.',
    );
  }
  const set = {
    email: profile.email,
    displayName: profile.name ?? '',
    avatarUrl: profile.picture ?? '',
    accessTokenEnc: encryptSecret(tokens.accessToken),
    tokenExpiresAt: tokens.expiresAt,
    status: 'connected',
    lastError: null,
    connectedBy: user._id,
  };
  if (tokens.refreshToken) {
    set.refreshTokenEnc = encryptSecret(tokens.refreshToken);
  }
  const setOnInsert = existing ? {} : { priority: await nextPriority() };
  return StorageAccount.findOneAndUpdate(
    { googleUserId: profile.googleUserId },
    { $set: set, $setOnInsert: setOnInsert },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

async function connectWithGoogle(code, user) {
  let tokens;
  let profile;
  try {
    tokens = await exchangeCode(code);
    profile = await fetchUserInfo(tokens.accessToken);
  } catch (error) {
    console.error('[storage] Google sign-in failed:', error.code ?? error.message);
    throw new ConnectError('Google sign-in failed. Try again.');
  }
  if (!profile.googleUserId || !profile.email) {
    throw new ConnectError('Google did not return the account email. Try again.');
  }

  const account = await upsertAccount(tokens, profile, user);
  try {
    account.appFolderId = await ensureAppFolder(tokens.accessToken);
    await account.save();
  } catch (error) {
    console.error(`[storage] app folder setup failed for account ${account._id}:`, error.code);
    throw new ConnectError('Connected, but the Drive folder could not be created. Try again.');
  }
  return account;
}

// Handles Google's redirect. Never throws: returns { status: 'success' } or
// { status: 'error', message } with a message that is safe to show.
export async function handleOAuthCallback({ code, state, error }) {
  try {
    if (!state) {
      throw new ConnectError('The Google response was incomplete. Try again.');
    }
    const user = await consumeState(state);
    if (error || !code) {
      throw new ConnectError(
        error === 'access_denied' ? 'Google access was not granted.' : 'Google sign-in failed. Try again.',
      );
    }
    const account = await connectWithGoogle(code, user);
    try {
      await syncQuota(account._id);
    } catch (syncError) {
      console.error(`[storage] first quota sync failed for ${account._id}:`, syncError.message);
    }
    await runHook('account error alert', onStorageAccountError(alertTarget(account), null));
    await recordActivity(user, 'account_connect', account);
    notifyAccountsChanged();
    return { status: 'success' };
  } catch (failure) {
    if (failure instanceof ConnectError) {
      return { status: 'error', message: failure.message };
    }
    console.error('[storage] connect failed:', failure.message);
    return { status: 'error', message: 'Could not connect the Drive account. Try again.' };
  }
}

// Jobs: syncs every connected account one after another. Errors are logged per account.
export async function syncAllAccounts() {
  const accounts = await StorageAccount.find({ status: 'connected' }).select('_id').lean();
  for (const { _id } of accounts) {
    try {
      await syncQuota(_id);
    } catch (error) {
      console.error(`[storage] quota sync failed for account ${_id}:`, error.message);
    }
  }
}
