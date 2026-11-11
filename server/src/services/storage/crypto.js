// Encryption helpers for secrets stored by the Drive feature (Google tokens, upload session URIs,
// share tokens). AES-256-GCM with a random 12-byte IV; stored as "v1:<iv>:<tag>:<ciphertext>" (base64).
import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HKDF_INFO = 'homelab-storage-tokens';

// STORAGE_ENCRYPTION_KEY wins (sha256 of it). Otherwise a key is derived from JWT_SECRET, so
// changing JWT_SECRET means the Drive accounts must be reconnected.
export function deriveKey({ encryptionKey, jwtSecret }) {
  if (encryptionKey) {
    return crypto.createHash('sha256').update(encryptionKey, 'utf8').digest();
  }
  if (!jwtSecret) {
    throw new Error('No key material for storage secrets');
  }
  return Buffer.from(crypto.hkdfSync('sha256', jwtSecret, Buffer.alloc(0), HKDF_INFO, 32));
}

let cachedKey = null;

function key() {
  if (!cachedKey) {
    cachedKey = deriveKey({ encryptionKey: env.storage.encryptionKey, jwtSecret: env.jwtSecret });
  }
  return cachedKey;
}

// Returns null for null / undefined so optional fields can be passed straight through.
export function encryptSecret(text, keyOverride) {
  if (text === null || text === undefined) {
    return null;
  }
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyOverride ?? key(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

// Throws a generic error (never the input) when the blob is malformed, was tampered with, or was
// encrypted with another key.
export function decryptSecret(blob, keyOverride) {
  if (blob === null || blob === undefined) {
    return null;
  }
  const parts = typeof blob === 'string' ? blob.split(':') : [];
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Stored secret has an unknown format');
  }
  try {
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error('bad header');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyOverride ?? key(), iv, {
      authTagLength: TAG_BYTES,
    });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Stored secret could not be decrypted');
  }
}

// 32 random bytes, base64url (43 characters). Used for OAuth state and share links.
export function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// Hex sha256, used to store lookups for tokens without storing the tokens themselves.
export function sha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}
