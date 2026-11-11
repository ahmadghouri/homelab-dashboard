import mongoose from 'mongoose';

export const FOLDER_COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
export const FOLDER_NAME_MAX = 120;

// A virtual Drive folder. Folders live only in the database; the files themselves sit flat
// in one app folder per Google account.
const storageFolderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: FOLDER_NAME_MAX },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageFolder', default: null },
    color: { type: String, enum: [...FOLDER_COLORS, null], default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    trashedAt: { type: Date, default: null },
    // Set when the folder went to the trash together with an ancestor folder.
    trashedWithFolderId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        ret.parentId = ret.parentId?.toString() ?? null;
        ret.createdBy = ret.createdBy?.toString() ?? null;
        ret.trashedWithFolderId = ret.trashedWithFolderId?.toString() ?? null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

storageFolderSchema.index({ parentId: 1, trashedAt: 1, name: 1 });
storageFolderSchema.index({ trashedWithFolderId: 1 });

export const StorageFolder = mongoose.model('StorageFolder', storageFolderSchema);
