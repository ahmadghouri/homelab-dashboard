import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StorageFile } from '../../models/StorageFile.js';
import { HttpError } from '../../utils/httpError.js';
import { getAccessToken } from './accountService.js';
import { logActivity } from './activityService.js';
import { openDownload } from './google/driveApi.js';

const DEFAULT_MIME_TYPE = 'application/octet-stream';
const MIME_PATTERN = /^[\w.+-]+\/[\w.+-]+$/;
// One simple byte range ("bytes=0-", "bytes=100-199", "bytes=-500"). Anything else is ignored
// and the whole file is sent, which is always a valid answer to a Range request.
const SINGLE_RANGE_PATTERN = /^bytes=(\d+-\d*|-\d+)$/;
// Types a browser could render as an active document on our origin. Always downloaded.
const ACTIVE_MIME_PATTERN = /(html|svg|xml|javascript|ecmascript)/i;
const ACTIVE_EXTENSION_PATTERN = /\.(html?|xhtml|svgz?|xml|xsl|js|mjs)$/i;

function safeMimeType(mimeType) {
  const base = String(mimeType ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  return MIME_PATTERN.test(base) ? base : DEFAULT_MIME_TYPE;
}

export function isActiveContent(name, mimeType) {
  return ACTIVE_MIME_PATTERN.test(mimeType) || ACTIVE_EXTENSION_PATTERN.test(name ?? '');
}

// RFC 6266 / RFC 5987: an ASCII fallback for old clients plus the exact UTF-8 name.
export function contentDisposition(type, fileName) {
  const name = String(fileName || 'download');
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function parseRangeHeader(value) {
  return typeof value === 'string' && SINGLE_RANGE_PATTERN.test(value.trim())
    ? value.trim()
    : undefined;
}

async function loadDriveFileId(file) {
  if (file.driveFileId) {
    return file.driveFileId;
  }
  const stored = await StorageFile.findById(file._id ?? file.id)
    .select('+driveFileId')
    .lean();
  if (!stored?.driveFileId) {
    throw new HttpError(404, 'File not found');
  }
  return stored.driveFileId;
}

function isClientGone(error, controller) {
  return (
    controller.signal.aborted ||
    error?.name === 'AbortError' ||
    error?.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    error?.code === 'ABORT_ERR'
  );
}

function setContentHeaders(res, file, upstream, download) {
  const mimeType = safeMimeType(file.mimeType);
  const attachment = download || isActiveContent(file.name, mimeType);
  res.status(upstream.status === 206 ? 206 : 200);
  res.setHeader('Content-Type', mimeType);
  if (upstream.headers.contentLength != null) {
    res.setHeader('Content-Length', String(upstream.headers.contentLength));
  }
  if (upstream.status === 206 && upstream.headers.contentRange) {
    res.setHeader('Content-Range', upstream.headers.contentRange);
  }
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', contentDisposition(attachment ? 'attachment' : 'inline', file.name));
  res.setHeader('Cache-Control', 'private, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Even if a browser rendered the content as a page, it runs without scripts or origin.
  // PDFs are left out because browsers refuse to show a PDF in a sandboxed document.
  if (mimeType !== 'application/pdf') {
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  }
}

function sendRangeNotSatisfiable(res, file) {
  res.status(416);
  res.setHeader('Content-Range', `bytes */${file.sizeBytes}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end();
}

// Streams one stored file from Google Drive to the HTTP response. Shared by the logged-in
// content route and the public share route (S3). Permission checks happen before this call.
// `user` is the logged-in user for the download activity entry (null for public links).
export async function streamFileContent(req, res, file, { download = false, user = req.user } = {}) {
  const range = parseRangeHeader(req.headers.range);
  const [driveFileId, accessToken] = await Promise.all([
    loadDriveFileId(file),
    getAccessToken(file.accountId),
  ]);

  // Stops the Google request as soon as the client goes away (closed tab, video seek).
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableFinished) {
      controller.abort();
    }
  };
  res.on('close', onClose);

  let upstream;
  try {
    upstream = await openDownload(accessToken, driveFileId, { range, signal: controller.signal });
  } catch (error) {
    res.off('close', onClose);
    if (isClientGone(error, controller)) {
      return;
    }
    if (error?.code === 'invalid_range' || error?.status === 416) {
      sendRangeNotSatisfiable(res, file);
      return;
    }
    if (error?.code === 'not_found' || error?.status === 404) {
      throw new HttpError(404, 'File content is no longer available on Google Drive');
    }
    console.error('[drive] download failed:', error?.code ?? error?.name, `file=${file._id ?? file.id}`);
    throw new HttpError(502, 'Could not read the file from Google Drive');
  }

  setContentHeaders(res, file, upstream, download);
  const isFirstPart = !range || range.startsWith('bytes=0-');
  if (download && isFirstPart) {
    logActivity({
      user: user ?? null,
      action: 'download',
      targetType: 'file',
      targetId: file._id ?? file.id,
      targetName: file.name,
      meta: user ? undefined : { via: 'share' },
    }).catch((error) => console.error('[drive] activity log failed:', error.message));
  }

  if (req.method === 'HEAD') {
    controller.abort();
    upstream.body?.cancel?.().catch(() => {});
    res.end();
    return;
  }

  // The client may already be gone (fast tab close, cancelled preview). Piping into a closed
  // response fails without consuming the body, so stop the Google download instead.
  if (res.destroyed || res.writableEnded) {
    res.off('close', onClose);
    controller.abort();
    upstream.body?.cancel?.().catch(() => {});
    return;
  }

  const body = Readable.fromWeb(upstream.body);
  try {
    await pipeline(body, res);
  } catch (error) {
    if (!isClientGone(error, controller)) {
      console.error('[drive] stream failed:', error?.code ?? error?.name, `file=${file._id ?? file.id}`);
    }
    // Destroy the body before aborting so the abort cannot surface as an unhandled
    // 'error' event on a stream nobody listens to (that would crash the process).
    body.destroy();
    controller.abort();
    res.destroy();
  } finally {
    res.off('close', onClose);
  }
}
