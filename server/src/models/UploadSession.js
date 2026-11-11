import mongoose from 'mongoose';

export const UPLOAD_STATUSES = ['uploading', 'completed', 'failed', 'cancelled'];
export const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
// Documents stay a week after expiry so the cleanup job always releases their reservation first.
const KEEP_AFTER_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

// One resumable upload into a Google Drive resumable session. The offset is always the one
// Google reported, never the one the client claims. The session URI is a bearer credential
// for the upload, so it is stored encrypted and never selected by default.
const uploadSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageAccount', required: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageFolder', default: null },
    fileName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 255 },
    sizeBytes: { type: Number, required: true, min: 1 },
    sessionUriEnc: { type: String, required: true, select: false },
    offset: { type: Number, default: 0 },
    status: { type: String, enum: UPLOAD_STATUSES, default: 'uploading' },
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageFile', default: null },
    // Set while one chunk is streaming to Google, so a second chunk for the same session is rejected.
    chunkLockedAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + UPLOAD_SESSION_TTL_MS),
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.sessionUriEnc;
        delete ret.chunkLockedAt;
        return ret;
      },
    },
  },
);

uploadSessionSchema.index({ status: 1, expiresAt: 1 });
uploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: KEEP_AFTER_EXPIRY_SECONDS });

export const UploadSession = mongoose.model('UploadSession', uploadSessionSchema);
