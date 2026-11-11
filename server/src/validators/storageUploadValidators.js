import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';

const MAX_NAME_LENGTH = 255;
const DEFAULT_MIME_TYPE = 'application/octet-stream';
// type/subtype with optional parameters, no control characters.
const MIME_PATTERN = /^[\w.+-]+\/[\w.+-]+(\s*;[\x20-\x7e]*)?$/;

// Strips path separators and control characters so a name can never act as a path or header.
export function sanitizeFileName(value) {
  const cleaned = String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/[/\\]/g, '_')
    .trim();
  if (cleaned === '.' || cleaned === '..') {
    return '';
  }
  return cleaned.slice(0, MAX_NAME_LENGTH);
}

const objectId = z
  .string()
  .refine((value) => mongoose.isValidObjectId(value), 'Invalid folder id');

// ?download=1 asks for an attachment (needs download permission); anything else is inline.
export const contentQuerySchema = z.object({
  download: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((value) => value === '1' || value === 'true'),
});

export const createUploadSchema = z.object({
  fileName: z
    .string()
    .max(1024, 'File name is too long')
    .transform(sanitizeFileName)
    .pipe(z.string().min(1, 'File name is required')),
  mimeType: z
    .string()
    .trim()
    .max(255, 'MIME type is too long')
    .optional()
    .transform((value) => (value && MIME_PATTERN.test(value) ? value : DEFAULT_MIME_TYPE)),
  sizeBytes: z
    .number()
    .int('Size must be a whole number of bytes')
    .min(1, 'Empty files cannot be uploaded')
    .max(env.storage.maxUploadBytes, 'File is larger than the upload limit'),
  folderId: objectId.nullable().optional().default(null),
});
