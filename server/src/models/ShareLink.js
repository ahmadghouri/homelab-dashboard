import mongoose from 'mongoose';

// A public link to one file. Only the sha256 of the token is searchable; the token itself is
// kept encrypted so the creator can copy the link again.
const shareLinkSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageFile', required: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    tokenEnc: { type: String, required: true, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, default: null },
    allowDownload: { type: Boolean, default: true },
    revokedAt: { type: Date, default: null },
    views: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        ret.fileId = ret.fileId?.toString();
        ret.createdBy = ret.createdBy?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.tokenHash;
        delete ret.tokenEnc;
        return ret;
      },
    },
  },
);

shareLinkSchema.index({ createdBy: 1, createdAt: -1 });
shareLinkSchema.index({ fileId: 1 });

export const ShareLink = mongoose.model('ShareLink', shareLinkSchema);
