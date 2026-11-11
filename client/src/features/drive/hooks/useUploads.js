import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { formatBytes } from '@/lib/format';
import { cancelUpload, createUpload, getUploadStatus, uploadChunkPath } from '../api';
import { driveKeys } from '../queryKeys';

// Resumable chunked uploads to /api/storage/uploads. One file at a time, 8 MiB chunks.
// The queue lives in a small external store owned by UploadProvider (mounted in AppLayout),
// so uploads keep running while the user moves between pages.

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
// Same default as the server (env.storage.maxUploadBytes). The server still checks its own limit.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const ACTIVE_STATUSES = new Set(['queued', 'uploading']);

export function isUploadActive(upload) {
  return ACTIVE_STATUSES.has(upload.status);
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function isTransient(status) {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

// PUT one chunk with a raw body. Returns { status, data }; status 0 means a network error.
async function putChunk(uploadId, file, start, end, signal) {
  let response;
  try {
    response = await fetch(uploadChunkPath(uploadId), {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
      },
      body: file.slice(start, end),
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    return { status: 0, data: null };
  }
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;
  return { status: response.status, data };
}

function offsetFrom(data) {
  const offset = data?.offset ?? data?.details?.offset;
  return Number.isInteger(offset) && offset >= 0 ? offset : null;
}

function errorMessage(error) {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  return 'Upload failed. Try again.';
}

// Exported for tests; the app uses UploadProvider.
export function createUploadStore({ onCompleted }) {
  let uploads = [];
  const listeners = new Set();
  // id -> { file, uploadId, chunkSize, controller }; kept out of the snapshot.
  const jobs = new Map();
  let running = false;
  let nextId = 1;

  const emit = () => listeners.forEach((listener) => listener());

  const update = (id, changes) => {
    uploads = uploads.map((upload) => (upload.id === id ? { ...upload, ...changes } : upload));
    emit();
  };

  const find = (id) => uploads.find((upload) => upload.id === id);

  // Asks the server where the Drive session stands. Returns null when the session is gone.
  async function querySession(uploadId, signal) {
    try {
      return await getUploadStatus(uploadId, { signal });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
        return null;
      }
      throw error;
    }
  }

  async function sendChunks(id, job, startOffset, signal) {
    const { file, uploadId, chunkSize } = job;
    let offset = startOffset;
    let failures = 0;

    for (;;) {
      const end = Math.min(offset + chunkSize, file.size);
      const startedAt = performance.now();
      const { status, data } = await putChunk(uploadId, file, offset, end, signal);

      if (status >= 200 && status < 300) {
        failures = 0;
        const seconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
        const instant = (end - offset) / seconds;
        const previous = find(id)?.speed ?? 0;
        const speed = previous ? previous * 0.6 + instant * 0.4 : instant;
        if (data?.status === 'completed') {
          return data.file ?? null;
        }
        offset = offsetFrom(data) ?? end;
        update(id, { uploaded: offset, speed });
        continue;
      }

      if (status === 409) {
        // The server's offset (from Google) wins over ours: continue from there.
        failures += 1;
        if (failures > MAX_RETRIES) {
          throw new ApiError('The upload got out of sync. Try again.', 409);
        }
        const serverOffset = offsetFrom(data);
        if (serverOffset !== null) {
          offset = serverOffset;
        } else {
          const session = await querySession(uploadId, signal);
          if (!session || session.status !== 'uploading') {
            throw new ApiError('The upload session has ended. Try again.', 409);
          }
          offset = session.offset;
        }
        update(id, { uploaded: offset });
        continue;
      }

      if (!isTransient(status)) {
        throw new ApiError(data?.message ?? 'Upload failed', status, data?.details);
      }

      failures += 1;
      if (failures > MAX_RETRIES) {
        throw new ApiError(
          status === 0 ? 'Network error. Check the connection and retry.' : (data?.message ?? 'Upload failed'),
          status,
        );
      }
      update(id, { speed: 0, retrying: true });
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (failures - 1), signal);
      try {
        const session = await querySession(uploadId, signal);
        if (!session) {
          throw new ApiError('The upload session has expired. Try again.', 404);
        }
        if (session.status === 'completed') {
          return null;
        }
        if (session.status !== 'uploading') {
          throw new ApiError('The upload session has ended. Try again.', 409);
        }
        offset = session.offset;
      } catch (error) {
        // Still offline or the server is busy: keep the old offset; the next PUT counts as another failure.
        if (!(error instanceof ApiError) || !isTransient(error.status)) {
          throw error;
        }
      }
      update(id, { uploaded: offset, retrying: false });
    }
  }

  async function runJob(id) {
    const job = jobs.get(id);
    const controller = new AbortController();
    job.controller = controller;
    const { signal } = controller;
    update(id, { status: 'uploading', error: null, speed: 0, retrying: false });

    try {
      let offset = 0;
      let completedFile;

      // Retry of a failed upload: resume the old Drive session when it still exists.
      if (job.uploadId) {
        const session = await querySession(job.uploadId, signal);
        if (session?.status === 'uploading') {
          offset = session.offset;
        } else if (session?.status === 'completed') {
          completedFile = null;
        } else {
          job.uploadId = null;
        }
      }

      if (completedFile === undefined && !job.uploadId) {
        const { file } = job;
        const created = await createUpload({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          folderId: find(id)?.folderId ?? null,
        });
        if (signal.aborted) {
          cancelUpload(created.uploadId).catch(() => {});
          return;
        }
        job.uploadId = created.uploadId;
        job.chunkSize = created.chunkSize || DEFAULT_CHUNK_SIZE;
        offset = created.offset ?? 0;
      }

      if (completedFile === undefined) {
        update(id, { uploaded: offset });
        completedFile = await sendChunks(id, job, offset, signal);
      }

      update(id, { status: 'completed', uploaded: job.file.size, speed: 0, retrying: false });
      job.uploadId = null;
      onCompleted(find(id), completedFile);
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      update(id, { status: 'failed', error: errorMessage(error), speed: 0, retrying: false });
    } finally {
      job.controller = null;
    }
  }

  async function pump() {
    if (running) {
      return;
    }
    running = true;
    try {
      let next = uploads.find((upload) => upload.status === 'queued');
      while (next) {
        await runJob(next.id);
        next = uploads.find((upload) => upload.status === 'queued');
      }
    } finally {
      running = false;
    }
  }

  // Ends the Drive session on the server so its reserved space is released.
  function releaseSession(job) {
    if (job?.uploadId) {
      cancelUpload(job.uploadId).catch(() => {});
      job.uploadId = null;
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => uploads,

    // files: File[] (or a FileList). folderId: target folder, null for the root.
    addFiles(fileList, folderId = null) {
      const added = [];
      for (const file of Array.from(fileList ?? [])) {
        if (file.size === 0) {
          toast.error(`${file.name} is empty`, { description: 'Empty files cannot be uploaded.' });
          continue;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(`${file.name} is too large`, {
            description: `The upload limit is ${formatBytes(MAX_UPLOAD_BYTES, 0)} per file.`,
          });
          continue;
        }
        const id = `upload-${nextId++}`;
        jobs.set(id, { file, uploadId: null, chunkSize: DEFAULT_CHUNK_SIZE, controller: null });
        added.push({
          id,
          name: file.name,
          size: file.size,
          folderId,
          status: 'queued',
          uploaded: 0,
          speed: 0,
          retrying: false,
          error: null,
        });
      }
      if (added.length > 0) {
        uploads = [...uploads, ...added];
        emit();
        pump();
      }
      return added.length;
    },

    cancel(id) {
      const upload = find(id);
      const job = jobs.get(id);
      if (!upload || !job || upload.status === 'completed' || upload.status === 'cancelled') {
        return;
      }
      update(id, { status: 'cancelled', speed: 0, retrying: false });
      job.controller?.abort();
      releaseSession(job);
    },

    retry(id) {
      if (find(id)?.status !== 'failed') {
        return;
      }
      update(id, { status: 'queued', error: null });
      pump();
    },

    // Removes one finished entry from the list.
    dismiss(id) {
      const upload = find(id);
      if (!upload || isUploadActive(upload)) {
        return;
      }
      releaseSession(jobs.get(id));
      jobs.delete(id);
      uploads = uploads.filter((item) => item.id !== id);
      emit();
    },

    // Removes every finished entry (completed, cancelled and failed).
    clearFinished() {
      for (const upload of uploads) {
        if (!isUploadActive(upload)) {
          releaseSession(jobs.get(upload.id));
          jobs.delete(upload.id);
        }
      }
      uploads = uploads.filter(isUploadActive);
      emit();
    },

    // Stops running requests when the provider unmounts (logout).
    abortAll() {
      for (const job of jobs.values()) {
        job.controller?.abort();
      }
    },
  };
}

const UploadContext = createContext(null);

function isFileListOf(queryKey, folderId) {
  const params = queryKey[driveKeys.fileLists().length];
  // Searches span folders, so they refresh after every upload.
  return !params || Boolean(params.q) || (params.folderId ?? null) === (folderId ?? null);
}

// Mounted once in AppLayout. Children use useUploads().
export function UploadProvider({ children }) {
  const queryClient = useQueryClient();
  const [store] = useState(() =>
    createUploadStore({
      onCompleted: (upload) => {
        queryClient.invalidateQueries({
          queryKey: driveKeys.fileLists(),
          predicate: (query) => isFileListOf(query.queryKey, upload.folderId),
        });
        queryClient.invalidateQueries({ queryKey: driveKeys.summary() });
        queryClient.invalidateQueries({ queryKey: driveKeys.accounts() });
      },
    }),
  );
  const uploads = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const hasActive = uploads.some(isUploadActive);

  // Leaving the page would stop the running uploads: let the browser ask first.
  useEffect(() => {
    if (!hasActive) {
      return undefined;
    }
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasActive]);

  useEffect(() => () => store.abortAll(), [store]);

  return createElement(UploadContext, { value: store }, children);
}

// Returns { uploads, activeCount, addFiles(files, folderId), cancel(id), retry(id), dismiss(id), clearFinished() }.
// uploads: [{ id, name, size, folderId, status: 'queued' | 'uploading' | 'completed' | 'failed' | 'cancelled',
// uploaded, speed (bytes per second), retrying, error }].
export function useUploads() {
  const store = useContext(UploadContext);
  if (!store) {
    throw new Error('useUploads must be used inside UploadProvider');
  }
  const uploads = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return {
    uploads,
    activeCount: uploads.filter(isUploadActive).length,
    addFiles: store.addFiles,
    cancel: store.cancel,
    retry: store.retry,
    dismiss: store.dismiss,
    clearFinished: store.clearFinished,
  };
}
