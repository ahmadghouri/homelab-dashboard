import mongoose from 'mongoose';
import { StorageAccount } from '../../models/StorageAccount.js';
import { HttpError } from '../../utils/httpError.js';
import { getRoutingMode, nextRoundRobinSlot } from './routingSettings.js';

// Free bytes left after used space and open reservations. null total = unlimited (Infinity).
export function freeBytesOf(account) {
  const total = account.quota?.totalBytes;
  if (total === null || total === undefined) {
    return Infinity;
  }
  return total - (account.quota?.usedBytes ?? 0) - (account.reservedBytes ?? 0);
}

// Totals over every account. totalBytes / freeBytes are null when any account is unlimited.
// Free space counts only accounts that can take uploads now.
export function summarizeAccounts(accounts) {
  let totalBytes = 0;
  let usedBytes = 0;
  let freeBytes = 0;
  let connected = 0;
  for (const account of accounts) {
    const total = account.quota?.totalBytes ?? null;
    usedBytes += account.quota?.usedBytes ?? 0;
    totalBytes = total === null || totalBytes === null ? null : totalBytes + total;
    if (account.status === 'connected') {
      connected += 1;
      if (account.acceptUploads) {
        const free = freeBytesOf(account);
        freeBytes = free === Infinity || freeBytes === null ? null : freeBytes + Math.max(0, free);
      }
    }
  }
  return { totalBytes, usedBytes, freeBytes, accounts: accounts.length, connected };
}

function byPriority(a, b) {
  return a.priority - b.priority || a.createdAt - b.createdAt;
}

async function orderCandidates(candidates) {
  const sorted = [...candidates].sort(byPriority);
  const mode = await getRoutingMode();
  if (mode === 'most_free') {
    return sorted.sort((a, b) => {
      const diff = freeBytesOf(b) - freeBytesOf(a);
      // Two unlimited accounts give NaN; keep priority order then.
      return Number.isNaN(diff) || diff === 0 ? 0 : diff;
    });
  }
  if (mode === 'round_robin') {
    const start = (await nextRoundRobinSlot()) % sorted.length;
    return [...sorted.slice(start), ...sorted.slice(0, start)];
  }
  return sorted;
}

// Matches the account only while it can still take `bytes` (checked inside MongoDB, so two
// uploads can never both take the last free space).
function reservableFilter(accountId, bytes) {
  return {
    _id: accountId,
    status: 'connected',
    acceptUploads: true,
    $expr: {
      $or: [
        { $eq: [{ $ifNull: ['$quota.totalBytes', null] }, null] },
        {
          $lte: [
            { $add: [{ $ifNull: ['$quota.usedBytes', 0] }, '$reservedBytes', bytes] },
            '$quota.totalBytes',
          ],
        },
      ],
    },
  };
}

// Reserves `bytes` on one account chosen by the routing mode and returns the account document.
// preferredAccountId (optional) is tried first when it fits.
export async function reserveSpace(bytes, { preferredAccountId } = {}) {
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new HttpError(400, 'Invalid file size');
  }
  const candidates = await StorageAccount.find({ status: 'connected', acceptUploads: true })
    .select('quota reservedBytes priority createdAt')
    .lean();
  const fitting = candidates.filter((account) => freeBytesOf(account) >= bytes);
  if (fitting.length === 0) {
    throw new HttpError(507, 'Not enough space on any connected Drive account');
  }

  let ordered = await orderCandidates(fitting);
  if (preferredAccountId && mongoose.isValidObjectId(preferredAccountId)) {
    const preferred = String(preferredAccountId);
    ordered = [
      ...ordered.filter((account) => String(account._id) === preferred),
      ...ordered.filter((account) => String(account._id) !== preferred),
    ];
  }

  // The list may be stale by now; the conditional update decides. Fall through on a lost race.
  for (const candidate of ordered) {
    const account = await StorageAccount.findOneAndUpdate(
      reservableFilter(candidate._id, bytes),
      { $inc: { reservedBytes: bytes } },
      { returnDocument: 'after' },
    );
    if (account) {
      return account;
    }
  }
  throw new HttpError(507, 'Not enough space on any connected Drive account');
}

// Gives back a reservation (upload finished, cancelled or expired). Never goes below zero.
export async function releaseSpace(accountId, bytes) {
  if (!accountId || !Number.isFinite(bytes) || bytes <= 0) {
    return;
  }
  await StorageAccount.updateOne(
    { _id: accountId },
    [{ $set: { reservedBytes: { $max: [0, { $subtract: ['$reservedBytes', bytes] }] } } }],
    { updatePipeline: true },
  );
}
