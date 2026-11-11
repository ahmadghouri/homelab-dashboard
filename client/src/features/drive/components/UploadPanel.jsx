import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  CircleXIcon,
  LoaderCircleIcon,
  RotateCwIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/format';
import { isUploadActive, useUploads } from '../hooks/useUploads';

function statusText(upload) {
  switch (upload.status) {
    case 'queued':
      return `Waiting · ${formatBytes(upload.size)}`;
    case 'uploading':
      if (upload.retrying) {
        return 'Connection lost, retrying...';
      }
      return `${formatBytes(upload.uploaded)} of ${formatBytes(upload.size)}${
        upload.speed > 0 ? ` · ${formatBytes(upload.speed)}/s` : ''
      }`;
    case 'completed':
      return `Uploaded · ${formatBytes(upload.size)}`;
    case 'cancelled':
      return 'Cancelled';
    default:
      return upload.error ?? 'Upload failed';
  }
}

function StatusIcon({ status }) {
  if (status === 'completed') {
    return <CircleCheckIcon className="size-4 text-success" aria-hidden="true" />;
  }
  if (status === 'failed') {
    return <TriangleAlertIcon className="size-4 text-danger" aria-hidden="true" />;
  }
  if (status === 'cancelled') {
    return <CircleXIcon className="size-4 text-muted-foreground" aria-hidden="true" />;
  }
  return (
    <LoaderCircleIcon
      className={status === 'uploading' ? 'size-4 animate-spin text-muted-foreground' : 'size-4 text-muted-foreground'}
      aria-hidden="true"
    />
  );
}

function UploadRow({ upload, onCancel, onRetry, onDismiss }) {
  const percent = upload.size > 0 ? Math.round((upload.uploaded / upload.size) * 100) : 0;
  const active = isUploadActive(upload);

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <StatusIcon status={upload.status} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={upload.name}>
          {upload.name}
        </span>
        {upload.status === 'failed' && (
          <Button variant="ghost" size="icon-xs" onClick={() => onRetry(upload.id)} aria-label={`Retry ${upload.name}`}>
            <RotateCwIcon aria-hidden="true" />
          </Button>
        )}
        {active ? (
          <Button variant="ghost" size="icon-xs" onClick={() => onCancel(upload.id)} aria-label={`Cancel ${upload.name}`}>
            <XIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon-xs" onClick={() => onDismiss(upload.id)} aria-label={`Remove ${upload.name} from the list`}>
            <XIcon aria-hidden="true" />
          </Button>
        )}
      </div>
      {active && (
        <div
          role="progressbar"
          aria-label={`Uploading ${upload.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent}%`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
      )}
      <p className={upload.status === 'failed' ? 'text-xs text-danger' : 'text-xs text-muted-foreground'}>
        {statusText(upload)}
        {upload.status === 'uploading' && !upload.retrying && ` · ${percent}%`}
      </p>
    </li>
  );
}

// Floating upload queue, fixed at the bottom right. Mounted once in AppLayout.
export function UploadPanel() {
  const { uploads, activeCount, cancel, retry, dismiss, clearFinished } = useUploads();
  const [collapsed, setCollapsed] = useState(false);

  if (uploads.length === 0) {
    return null;
  }

  const doneCount = uploads.filter((upload) => upload.status === 'completed').length;
  const failedCount = uploads.filter((upload) => upload.status === 'failed').length;
  let title;
  if (activeCount > 0) {
    title = `Uploading ${activeCount} ${activeCount === 1 ? 'file' : 'files'}`;
  } else if (failedCount > 0) {
    title = `${failedCount} ${failedCount === 1 ? 'upload' : 'uploads'} failed`;
  } else {
    title = `${doneCount} ${doneCount === 1 ? 'upload' : 'uploads'} complete`;
  }

  return (
    <section
      aria-label="Uploads"
      className="fixed right-4 bottom-4 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
    >
      <header className="flex items-center gap-1 border-b bg-muted/50 px-3 py-2">
        <h2 className="flex-1 truncate text-sm font-medium" aria-live="polite">
          {title}
        </h2>
        {activeCount < uploads.length && (
          <Button variant="ghost" size="sm" onClick={clearFinished}>
            Clear
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-controls="upload-panel-list"
          aria-label={collapsed ? 'Show uploads' : 'Hide uploads'}
        >
          {collapsed ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
        </Button>
      </header>
      {!collapsed && (
        <ul id="upload-panel-list" className="max-h-72 divide-y overflow-y-auto">
          {uploads.map((upload) => (
            <UploadRow key={upload.id} upload={upload} onCancel={cancel} onRetry={retry} onDismiss={dismiss} />
          ))}
        </ul>
      )}
    </section>
  );
}
