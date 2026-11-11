import { env } from '../config/env.js';
import { summarizeAccounts } from '../services/storage/accountSelector.js';
import {
  createConnectUrl,
  disconnectAccount,
  getSetupInfo,
  handleOAuthCallback,
  listAccounts,
  syncQuota,
  updateAccount,
} from '../services/storage/accountService.js';
import { getRoutingMode, setRoutingMode } from '../services/storage/routingSettings.js';
import { oauthCallbackSchema } from '../validators/storageAccountValidators.js';

// Admins see every account; other users with Drive access only see the totals.
export async function getAccounts(req, res) {
  const accounts = await listAccounts();
  const summary = summarizeAccounts(accounts);
  res.json({ accounts: req.user.role === 'admin' ? accounts : [], summary });
}

export function getSetup(req, res) {
  res.json(getSetupInfo());
}

export async function getConnectUrl(req, res) {
  res.json({ url: await createConnectUrl(req.user) });
}

// Reached through Google's redirect (no session cookie needed: the state proves the admin).
export async function googleCallback(req, res) {
  const parsed = oauthCallbackSchema.safeParse(req.query);
  const result = await handleOAuthCallback(parsed.success ? parsed.data : {});
  const target = new URL('/drive/connected', env.clientOrigin);
  target.searchParams.set('status', result.status);
  if (result.message) {
    target.searchParams.set('message', result.message);
  }
  res.redirect(302, target.toString());
}

export async function patchAccount(req, res) {
  res.json({ account: await updateAccount(req.params.id, req.body) });
}

export async function postSync(req, res) {
  res.json({ account: await syncQuota(req.params.id) });
}

export async function removeAccount(req, res) {
  await disconnectAccount(req.params.id, req.user);
  res.status(204).end();
}

export async function getRouting(req, res) {
  res.json({ mode: await getRoutingMode() });
}

export async function putRouting(req, res) {
  res.json({ mode: await setRoutingMode(req.body.mode) });
}
