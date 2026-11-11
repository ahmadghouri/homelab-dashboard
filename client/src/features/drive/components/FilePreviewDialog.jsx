import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBytes } from '@/lib/format';
import { driveKeys } from '../queryKeys';
import { contentUrl, fileKindIcon, fileKindLabel, isPreviewable } from '../utils';

const TEXT_PREVIEW_BYTES = 200 * 1024;

// Reads at most the first 200 KB of a text file (Range request; stops reading even if the server ignores it).
async function fetchTextPreview(src, signal) {
  const response = await fetch(src, {
    headers: { Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` },
    credentials: 'include',
    signal,
  });
  if (!response.ok) {
    throw new Error('Could not load the file');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (received < TEXT_PREVIEW_BYTES) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    received += value.length;
  }
  reader.cancel().catch(() => {});
  const bytes = new Uint8Array(Math.min(received, TEXT_PREVIEW_BYTES));
  let position = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.length - position);
    bytes.set(part, position);
    position += part.length;
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function TextPreview({ src, sizeBytes }) {
  const { data, isPending, isError } = useQuery({
    queryKey: [...driveKeys.all, 'preview-text', src],
    queryFn: ({ signal }) => fetchTextPreview(src, signal),
    staleTime: 60 * 1000,
    retry: false,
  });

  if (isPending) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground" role="status">
        <LoaderCircleIcon className="size-5 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading preview</span>
      </div>
    );
  }
  if (isError) {
    return <p className="p-6 text-center text-sm text-danger">The preview could not be loaded.</p>;
  }
  return (
    <div className="flex min-h-0 flex-col gap-2">
      {sizeBytes > TEXT_PREVIEW_BYTES && (
        <p className="text-xs text-muted-foreground">
          Showing the first {formatBytes(TEXT_PREVIEW_BYTES, 0)} of {formatBytes(sizeBytes)}. Download the file to see all of it.
        </p>
      )}
      <pre className="max-h-[65dvh] min-h-0 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
        {data}
      </pre>
    </div>
  );
}

function NoPreview({ kind, message, downloadUrl }) {
  const Icon = fileKindIcon(kind);
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {downloadUrl && (
        <Button asChild variant="outline">
          <a href={downloadUrl} download>
            <DownloadIcon aria-hidden="true" />
            Download
          </a>
        </Button>
      )}
    </div>
  );
}

// Renders a file inline by kind. Also used by the public share page. Give it key={src} so a new file
// starts without the previous file's error state.
// src: inline content URL; downloadUrl: attachment URL or null when downloads are not allowed.
export function FilePreviewContent({ kind, name, src, sizeBytes, downloadUrl = null }) {
  const [failed, setFailed] = useState(false);
  const handleError = () => setFailed(true);

  if (failed) {
    return (
      <NoPreview
        kind={kind}
        message="This file cannot be shown in the browser. Download it to open it on your device."
        downloadUrl={downloadUrl}
      />
    );
  }

  switch (kind) {
    case 'image':
      return (
        <img
          src={src}
          alt={name}
          onError={handleError}
          className="mx-auto max-h-[65dvh] w-auto max-w-full rounded-md object-contain"
        />
      );
    case 'video':
      // The browser sends Range requests itself, so seeking works without loading the whole file.
      return (
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          onError={handleError}
          className="mx-auto max-h-[65dvh] w-full rounded-md bg-black"
        />
      );
    case 'audio':
      return (
        <div className="flex flex-col items-center gap-4 py-8">
          <NoPreviewIcon kind={kind} />
          <audio src={src} controls preload="metadata" onError={handleError} className="w-full max-w-md" />
        </div>
      );
    case 'pdf':
      return <iframe src={src} title={name} className="h-[65dvh] w-full rounded-md border bg-white" />;
    case 'text':
      return <TextPreview src={src} sizeBytes={sizeBytes} />;
    default:
      return <NoPreview kind={kind} message="No preview for this file type." downloadUrl={downloadUrl} />;
  }
}

function NoPreviewIcon({ kind }) {
  const Icon = fileKindIcon(kind);
  return (
    <div className="flex size-16 items-center justify-center rounded-full bg-muted">
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

// Preview of a Drive file. files (optional): the list it belongs to, for previous / next with the arrow keys.
// canDownload (optional, default true): show the Download button; the server checks the permission anyway.
export function FilePreviewDialog({ file, open, onOpenChange, files, canDownload = true }) {
  const [selectedId, setSelectedId] = useState(file?.id ?? null);
  const [openedWith, setOpenedWith] = useState(file?.id ?? null);
  // A new file from the parent starts the preview there again.
  if ((file?.id ?? null) !== openedWith) {
    setOpenedWith(file?.id ?? null);
    setSelectedId(file?.id ?? null);
  }

  const list = files?.length ? files : file ? [file] : [];
  const index = list.findIndex((item) => item.id === selectedId);
  const current = index >= 0 ? list[index] : file;
  const hasPrevious = index > 0;
  const hasNext = index >= 0 && index < list.length - 1;

  const go = (step) => {
    const next = list[index + step];
    if (next) {
      setSelectedId(next.id);
    }
  };

  const handleKeyDown = (event) => {
    // Arrow keys inside the media controls seek or change the volume; leave them alone.
    if (event.target.closest?.('video, audio, input, textarea, select')) {
      return;
    }
    if (event.key === 'ArrowLeft' && hasPrevious) {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'ArrowRight' && hasNext) {
      event.preventDefault();
      go(1);
    }
  };

  if (!current) {
    return null;
  }

  const downloadUrl = canDownload ? contentUrl(current.id, { download: true }) : null;
  const src = contentUrl(current.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[95dvh] flex-col sm:max-w-5xl" onKeyDown={handleKeyDown}>
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle className="truncate leading-normal" title={current.name}>
            {current.name}
          </DialogTitle>
          <DialogDescription>
            {fileKindLabel(current.kind)} · {formatBytes(current.sizeBytes)}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-auto">
          {isPreviewable(current) ? (
            <FilePreviewContent
              key={src}
              kind={current.kind}
              name={current.name}
              src={src}
              sizeBytes={current.sizeBytes}
              downloadUrl={downloadUrl}
            />
          ) : (
            <NoPreview kind={current.kind} message="No preview for this file type." downloadUrl={downloadUrl} />
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          {list.length > 1 ? (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="icon" onClick={() => go(-1)} disabled={!hasPrevious} aria-label="Previous file">
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                {index + 1} of {list.length}
              </span>
              <Button variant="outline" size="icon" onClick={() => go(1)} disabled={!hasNext} aria-label="Next file">
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <span />
          )}
          {downloadUrl && (
            <Button asChild>
              <a href={downloadUrl} download>
                <DownloadIcon aria-hidden="true" />
                Download
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
