import { z } from 'zod';
import { DRIVE_SCOPES } from '../models/DriveAccess.js';
import { FILE_KINDS, FILE_NAME_MAX } from '../models/StorageFile.js';
import { FOLDER_COLORS, FOLDER_NAME_MAX } from '../models/StorageFolder.js';

const MAX_BATCH = 200;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// null, '', 'root' and 'null' all mean the root folder.
const folderRef = z
  .union([objectId, z.literal(''), z.literal('root'), z.literal('null'), z.null()])
  .transform((value) => (value && value !== 'root' && value !== 'null' ? value : null));

function nameSchema(max, label) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`)
    .refine((value) => !CONTROL_CHARS.test(value), `${label} contains invalid characters`)
    .refine((value) => !/[\\/]/.test(value), `${label} cannot contain / or \\`)
    .refine((value) => value !== '.' && value !== '..', `${label} is not allowed`);
}

const folderName = nameSchema(FOLDER_NAME_MAX, 'Folder name');
const fileName = nameSchema(FILE_NAME_MAX, 'File name');
const idList = z.array(objectId).max(MAX_BATCH, `Select at most ${MAX_BATCH} items`);

export const driveAccessSchema = z.object({
  canView: z.boolean(),
  canDownload: z.boolean().default(false),
  canUpload: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canShare: z.boolean().default(false),
  scope: z.enum(DRIVE_SCOPES),
  folderIds: z.array(objectId).max(MAX_BATCH).default([]),
});

export const folderListQuerySchema = z.object({ parentId: folderRef.optional() });

export const createFolderSchema = z.object({
  name: folderName,
  parentId: folderRef.optional().default(null),
});

export const updateFolderSchema = z
  .object({
    name: folderName.optional(),
    parentId: folderRef.optional(),
    color: z.enum(FOLDER_COLORS).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.parentId !== undefined || v.color !== undefined, {
    message: 'Nothing to update',
  });

export const fileListQuerySchema = z.object({
  folderId: folderRef.optional(),
  q: z.string().trim().max(100, 'Search is too long').optional().transform((v) => v || undefined),
  kind: z.enum(FILE_KINDS).optional(),
  accountId: objectId.optional(),
  sort: z.enum(['name', 'size', 'createdAt']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateFileSchema = z
  .object({ name: fileName.optional(), folderId: folderRef.optional() })
  .refine((v) => v.name !== undefined || v.folderId !== undefined, {
    message: 'Nothing to update',
  });

export const batchSchema = z
  .object({
    action: z.enum(['move', 'trash']),
    ids: idList.default([]),
    folderIds: idList.default([]),
    folderId: folderRef.optional(),
  })
  .refine((v) => v.ids.length + v.folderIds.length > 0, { message: 'Nothing selected' })
  .refine((v) => v.action !== 'move' || v.folderId !== undefined, {
    message: 'Choose a destination folder',
  });

export const restoreSchema = z
  .object({ fileIds: idList.default([]), folderIds: idList.default([]) })
  .refine((v) => v.fileIds.length + v.folderIds.length > 0, { message: 'Nothing selected' });

export const deleteForeverSchema = z
  .object({
    fileIds: idList.default([]),
    folderIds: idList.default([]),
    all: z.boolean().default(false),
  })
  .refine((v) => v.all || v.fileIds.length + v.folderIds.length > 0, {
    message: 'Nothing selected',
  });

export const createShareSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).nullable().default(null),
  allowDownload: z.boolean().default(true),
});

export const shareListQuerySchema = z.object({ fileId: objectId.optional() });

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;
