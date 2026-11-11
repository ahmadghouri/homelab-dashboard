import { StorageActivity } from '../../models/StorageActivity.js';

const MAX_META_KEYS = 20;
const MAX_META_STRING = 300;

// Keeps meta small and flat: only primitive values, short strings.
function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return undefined;
  }
  const result = {};
  for (const [key, value] of Object.entries(meta).slice(0, MAX_META_KEYS)) {
    if (typeof value === 'string') {
      result[key] = value.slice(0, MAX_META_STRING);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      result[key] = value;
    } else if (value != null && typeof value.toString === 'function') {
      result[key] = String(value).slice(0, MAX_META_STRING);
    }
  }
  return result;
}

// Records one Drive action. Never throws: a failed audit entry must not fail the request.
// user may be a User document, { id, name }, or null for system actions.
export async function logActivity({ user, action, targetType, targetId, targetName, meta }) {
  try {
    await StorageActivity.create({
      userId: user?._id ?? user?.id ?? null,
      userName: user?.name ?? 'System',
      action,
      targetType,
      targetId: targetId == null ? null : String(targetId),
      targetName: String(targetName ?? '').slice(0, 300),
      meta: sanitizeMeta(meta),
    });
  } catch (error) {
    console.error('[drive] activity log failed:', error.message);
  }
}

export function listActivity({ limit = 50 } = {}) {
  return StorageActivity.find().sort({ createdAt: -1 }).limit(limit);
}
