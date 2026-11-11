import { DRIVE_PERMISSIONS } from '../models/DriveAccess.js';
import { getEffectiveAccess, NO_DRIVE_ACCESS_MESSAGE } from '../services/storage/accessService.js';
import { HttpError } from '../utils/httpError.js';

// Sets req.driveAccess to the user's effective Drive permissions. Needs requireAuth first.
export async function loadDriveAccess(req, res, next) {
  req.driveAccess = await getEffectiveAccess(req.user);
  next();
}

// Accepts 'canView' style names and the short form 'view'.
function permissionName(permission) {
  if (DRIVE_PERMISSIONS.includes(permission)) {
    return permission;
  }
  const long = `can${permission.charAt(0).toUpperCase()}${permission.slice(1)}`;
  if (DRIVE_PERMISSIONS.includes(long)) {
    return long;
  }
  throw new Error(`Unknown Drive permission: ${permission}`);
}

// Rejects with 403 unless the user has the Drive permission. Loads the access when
// loadDriveAccess did not run yet.
export function requireDrive(permission = 'canView') {
  const name = permissionName(permission);
  return async (req, res, next) => {
    if (!req.driveAccess) {
      req.driveAccess = await getEffectiveAccess(req.user);
    }
    if (req.driveAccess[name] !== true) {
      throw new HttpError(403, NO_DRIVE_ACCESS_MESSAGE);
    }
    next();
  };
}
