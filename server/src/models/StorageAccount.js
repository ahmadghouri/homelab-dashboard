import mongoose from 'mongoose';

export const STORAGE_ACCOUNT_STATUSES = ['connected', 'error', 'disconnected'];

// Fields that must never leave the server.
const SECRET_FIELDS = ['accessTokenEnc', 'refreshTokenEnc', 'tokenExpiresAt'];

// A connected Google Drive account. Tokens are encrypted (services/storage/crypto.js).
const storageAccountSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['google_drive'], default: 'google_drive' },
    googleUserId: { type: String, required: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    displayName: { type: String, trim: true, maxlength: 200, default: '' },
    avatarUrl: { type: String, maxlength: 2000, default: '' },
    accessTokenEnc: { type: String, select: false },
    refreshTokenEnc: { type: String, select: false },
    tokenExpiresAt: { type: Date, select: false },
    // Id of the "Homelab Drive" folder that holds every uploaded object of this account.
    appFolderId: { type: String, default: null },
    status: { type: String, enum: STORAGE_ACCOUNT_STATUSES, default: 'connected' },
    lastError: { type: String, maxlength: 300, default: null },
    quota: {
      // null means unlimited.
      totalBytes: { type: Number, default: null },
      usedBytes: { type: Number, default: 0 },
      trashBytes: { type: Number, default: 0 },
    },
    // Bytes promised to unfinished upload sessions. Changed only with atomic updates.
    reservedBytes: { type: Number, default: 0 },
    acceptUploads: { type: Boolean, default: true },
    // Lower comes first in "priority" routing.
    priority: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: null },
    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.googleUserId;
        delete ret.appFolderId;
        for (const field of SECRET_FIELDS) {
          delete ret[field];
        }
        return ret;
      },
    },
  },
);

storageAccountSchema.index({ status: 1, acceptUploads: 1, priority: 1 });

export const StorageAccount = mongoose.model('StorageAccount', storageAccountSchema);
