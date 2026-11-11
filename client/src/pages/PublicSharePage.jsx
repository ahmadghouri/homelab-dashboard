import { useQuery } from '@tanstack/react-query';
import { ClockIcon, DownloadIcon, Link2OffIcon, ShieldBanIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { ApiError, apiClient } from '@/api/client';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FilePreviewContent } from '@/features/drive/components/FilePreviewDialog';
import { driveKeys } from '@/features/drive/queryKeys';
import { fileKindIcon, fileKindLabel, isPreviewable } from '@/features/drive/utils';
import { APP_ICON as AppIcon, APP_NAME } from '@/layouts/navItems';
import { formatBytes, formatDateTime } from '@/lib/format';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

// Public share endpoints (no login). Returns { file: { name, mimeType, kind, sizeBytes }, allowDownload, expiresAt }.
function getPublicShare(token, { signal } = {}) {
  return apiClient.get(`/public/shares/${encodeURIComponent(token)}`, { signal });
}

function publicContentUrl(token, { download = false } = {}) {
  return `${BASE_URL}/public/shares/${encodeURIComponent(token)}/content${download ? '?download=1' : ''}`;
}

function usePublicShare(token) {
  return useQuery({
    queryKey: [...driveKeys.all, 'public-share', token],
    queryFn: ({ signal }) => getPublicShare(token, { signal }),
    enabled: Boolean(token),
    refetchOnWindowFocus: false,
  });
}

function ShareState({ token }) {
  const { data, isPending, isError, error, refetch, isRefetching } = usePublicShare(token);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label="Loading the shared file">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
      return (
        <EmptyState
          icon={Link2OffIcon}
          title="This link is not available"
          description="It may have expired or been revoked, or the file was removed. Ask the person who shared it for a new link."
        />
      );
    }
    if (error instanceof ApiError && error.status === 429) {
      return (
        <ErrorState
          title="Too many requests"
          message="Wait a minute, then try again."
          onRetry={() => refetch()}
          isRetrying={isRefetching}
        />
      );
    }
    return (
      <ErrorState
        title="Could not load the shared file"
        message={error?.message}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
      />
    );
  }

  const { file, allowDownload, expiresAt } = data;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return (
      <EmptyState
        icon={ClockIcon}
        title="This link has expired"
        description="Ask the person who shared it for a new link."
      />
    );
  }

  const Icon = fileKindIcon(file.kind);
  const src = publicContentUrl(token);
  const downloadUrl = allowDownload ? publicContentUrl(token, { download: true }) : null;

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold" title={file.name}>
              {file.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {fileKindLabel(file.kind)} · {formatBytes(file.sizeBytes)}
              {expiresAt && ` · Link expires ${formatDateTime(expiresAt)}`}
            </p>
          </div>
        </div>
        {downloadUrl && (
          <Button asChild size="lg" className="sm:self-center">
            <a href={downloadUrl} download>
              <DownloadIcon aria-hidden="true" />
              Download
            </a>
          </Button>
        )}
      </header>

      {!allowDownload && (
        <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <ShieldBanIcon className="size-4 shrink-0" aria-hidden="true" />
          The owner did not allow downloads for this link.
        </p>
      )}

      <div className="rounded-xl border bg-card p-3 sm:p-4">
        {isPreviewable(file) ? (
          <FilePreviewContent
            key={src}
            kind={file.kind}
            name={file.name}
            src={src}
            sizeBytes={file.sizeBytes}
            downloadUrl={downloadUrl}
          />
        ) : (
          <FilePreviewContent kind="other" name={file.name} src={src} downloadUrl={downloadUrl} />
        )}
      </div>
    </article>
  );
}

// Public page for a shared file: /s/:token. No login and no app layout.
export function PublicSharePage() {
  const { token } = useParams();

  useEffect(() => {
    const previous = document.title;
    document.title = `Shared file · ${APP_NAME}`;
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <AppIcon className="size-4" aria-hidden="true" />
        </div>
        <span className="font-semibold">{APP_NAME}</span>
        <span className="text-sm text-muted-foreground">Shared file</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-4 md:p-6">
        <ShareState token={token} />
      </main>
    </div>
  );
}
