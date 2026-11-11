import mongoose from 'mongoose';

export const STORAGE_ACTIONS = [
  'upload',
  'download',
  'rename',
  'move',
  'trash',
  'restore',
  'delete',
  'share',
  'unshare',
  'folder_create',
  'access_change',
  'account_connect',
  'account_disconnect',
];
export const STORAGE_TARGET_TYPES = ['file', 'folder', 'share', 'user', 'account', 'trash'];
export const STORAGE_ACTIVITY_RETENTION_DAYS = 180;

// Drive audit log. Names are copied so entries stay readable after renames and deletes.
const storageActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: 'System' },
    action: { type: String, enum: STORAGE_ACTIONS, required: true },
    targetType: { type: String, enum: STORAGE_TARGET_TYPES, required: true },
    targetId: { type: String, default: null },
    targetName: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        ret.userId = ret.userId?.toString() ?? null;
        delete ret._id;
        delete ret.__v;
        delete ret.updatedAt;
        return ret;
      },
    },
  },
);

storageActivitySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: STORAGE_ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 },
);

export const StorageActivity = mongoose.model('StorageActivity', storageActivitySchema);
