import mongoose from 'mongoose';

export const DRIVE_PERMISSIONS = ['canView', 'canDownload', 'canUpload', 'canDelete', 'canShare'];
export const DRIVE_SCOPES = ['all', 'folders'];

// Drive permissions the admin gave one user. Admins never need a document (always full access);
// a viewer without a document has no Drive access at all.
const driveAccessSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    canView: { type: Boolean, default: false },
    canDownload: { type: Boolean, default: false },
    canUpload: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
    canShare: { type: Boolean, default: false },
    scope: { type: String, enum: DRIVE_SCOPES, default: 'folders' },
    // With scope 'folders': access covers these folders and their whole subtree.
    folderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StorageFolder' }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        ret.userId = ret.userId?.toString();
        ret.folderIds = (ret.folderIds ?? []).map(String);
        ret.updatedBy = ret.updatedBy?.toString() ?? null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const DriveAccess = mongoose.model('DriveAccess', driveAccessSchema);
