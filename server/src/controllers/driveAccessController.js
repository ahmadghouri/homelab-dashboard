import { listUserAccess, saveUserAccess } from '../services/storage/accessService.js';
import { logActivity } from '../services/storage/activityService.js';

export async function getAccessList(req, res) {
  res.json({ users: await listUserAccess() });
}

export async function putUserAccess(req, res) {
  const { user, access } = await saveUserAccess(req.params.userId, req.body, req.user);
  await logActivity({
    user: req.user,
    action: 'access_change',
    targetType: 'user',
    targetId: user.id,
    targetName: user.name,
    meta: {
      canView: access.canView,
      canDownload: access.canDownload,
      canUpload: access.canUpload,
      canDelete: access.canDelete,
      canShare: access.canShare,
      scope: access.scope,
      folders: access.folderIds.length,
    },
  });
  res.json({ userId: user.id, name: user.name, email: user.email, role: user.role, access });
}

export function getMyAccess(req, res) {
  res.json({ access: req.driveAccess });
}
