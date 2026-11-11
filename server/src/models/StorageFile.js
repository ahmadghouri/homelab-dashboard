import path from 'node:path';
import mongoose from 'mongoose';

export const FILE_KINDS = [
  'image',
  'video',
  'audio',
  'pdf',
  'document',
  'spreadsheet',
  'presentation',
  'archive',
  'text',
  'other',
];
export const FILE_NAME_MAX = 255;

const KIND_BY_EXTENSION = {
  document: ['doc', 'docx', 'odt', 'rtf', 'pages'],
  spreadsheet: ['xls', 'xlsx', 'ods', 'csv', 'tsv', 'numbers'],
  presentation: ['ppt', 'pptx', 'odp', 'key'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', 'iso'],
  text: ['txt', 'md', 'log', 'json', 'xml', 'yml', 'yaml', 'ini', 'conf', 'js', 'ts', 'py', 'sh'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'avif', 'ico', 'tif', 'tiff'],
  video: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v', 'wmv', 'flv'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus', 'wma'],
  pdf: ['pdf'],
};

const KIND_BY_MIME_PART = [
  ['spreadsheet', ['spreadsheet', 'excel', 'csv']],
  ['presentation', ['presentation', 'powerpoint']],
  ['document', ['wordprocessing', 'msword', 'opendocument.text', 'rtf']],
  ['archive', ['zip', 'compressed', 'x-tar', 'x-7z', 'x-rar', 'gzip', 'x-bzip']],
];

// Derives the display kind from the MIME type, falling back to the file extension.
export function detectFileKind(mimeType = '', name = '') {
  const mime = String(mimeType).toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  for (const prefix of ['image', 'video', 'audio']) {
    if (mime.startsWith(`${prefix}/`)) return prefix;
  }
  for (const [kind, parts] of KIND_BY_MIME_PART) {
    if (parts.some((part) => mime.includes(part))) return kind;
  }
  const extension = path.extname(String(name)).slice(1).toLowerCase();
  for (const [kind, extensions] of Object.entries(KIND_BY_EXTENSION)) {
    if (extensions.includes(extension)) return kind;
  }
  if (mime.startsWith('text/')) return 'text';
  return 'other';
}

function idString(value) {
  return value?.toString() ?? null;
}

// One file stored on a connected Google Drive account. driveFileId never leaves the server.
const storageFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: FILE_NAME_MAX },
    mimeType: { type: String, default: 'application/octet-stream', maxlength: 255 },
    sizeBytes: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: FILE_KINDS },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageFolder', default: null },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageAccount', required: true },
    driveFileId: { type: String, required: true, select: false },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    trashedAt: { type: Date, default: null },
    // Set when the file went to the trash together with a folder.
    trashedWithFolderId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        ret.folderId = idString(ret.folderId);
        ret.accountId = idString(ret.accountId);
        ret.trashedWithFolderId = idString(ret.trashedWithFolderId);
        // uploadedBy may be populated with the user's name.
        const uploader = ret.uploadedBy;
        if (uploader && typeof uploader === 'object' && 'name' in uploader) {
          ret.uploadedByName = uploader.name;
          ret.uploadedBy = idString(uploader.id ?? uploader._id);
        } else {
          ret.uploadedBy = idString(uploader);
        }
        delete ret._id;
        delete ret.__v;
        delete ret.driveFileId;
        return ret;
      },
    },
  },
);

storageFileSchema.pre('validate', function setKind() {
  if (!this.kind) {
    this.kind = detectFileKind(this.mimeType, this.name);
  }
});

storageFileSchema.index({ folderId: 1, trashedAt: 1, name: 1 });
storageFileSchema.index({ trashedAt: 1, trashedWithFolderId: 1 });
storageFileSchema.index({ accountId: 1 });

export const StorageFile = mongoose.model('StorageFile', storageFileSchema);
