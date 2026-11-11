import { ArrowLeftIcon, Settings2Icon, ShieldOffIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/useMe';
import { isAdmin as isAdminUser } from '@/features/auth/utils';
import { DriveToolbar } from '@/features/drive/components/DriveToolbar';
import { FileBrowser } from '@/features/drive/components/FileBrowser';
import { FolderBreadcrumbs } from '@/features/drive/components/FolderBreadcrumbs';
import { NewFolderDialog } from '@/features/drive/components/NewFolderDialog';
import { StorageSummaryCard } from '@/features/drive/components/StorageSummaryCard';
import { TrashView } from '@/features/drive/components/TrashView';
import { useMyDriveAccess } from '@/features/drive/hooks/useMyDriveAccess';
import { FILE_KINDS } from '@/features/drive/utils';

const TITLE = 'Drive';
const DESCRIPTION = 'Files stored across the connected Google Drive accounts.';
const VIEW_STORAGE_KEY = 'drive:view';
const KIND_VALUES = new Set(FILE_KINDS.map((kind) => kind.value));

function readStoredView() {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function LoadingPage() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-8 w-full max-w-md" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="aspect-[4/3] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function DrivePage() {
  const { data: user } = useMe();
  const admin = isAdminUser(user);
  const { access, isPending, isError, error, refetch, isRefetching } = useMyDriveAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(readStoredView);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const folderId = searchParams.get('folder') || null;
  const query = (searchParams.get('q') ?? '').trim();
  const rawKind = searchParams.get('kind') ?? '';
  const kind = KIND_VALUES.has(rawKind) ? rawKind : '';
  const inTrash = searchParams.get('view') === 'trash';
  // Folder-scoped users have no files at the top level, only their entry folders.
  const canUploadHere = access.canUpload && (access.scope === 'all' || Boolean(folderId)) && !query;

  // Folder changes are new history entries (back works); search and filters replace the entry.
  const updateParams = (changes, { push = false } = {}) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
        }
        return next;
      },
      { replace: !push },
    );

  const openFolder = (id) => updateParams({ folder: id, q: null }, { push: true });

  const changeView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
  };

  const headerActions = (
    <>
      {admin && (
        <Button variant="outline" asChild>
          <Link to="/drive/accounts">
            <Settings2Icon aria-hidden="true" />
            Accounts
          </Link>
        </Button>
      )}
      {access.canDelete &&
        (inTrash ? (
          <Button variant="outline" onClick={() => updateParams({ view: null }, { push: true })}>
            <ArrowLeftIcon aria-hidden="true" />
            Back to files
          </Button>
        ) : (
          <Button variant="outline" onClick={() => updateParams({ view: 'trash' }, { push: true })}>
            <Trash2Icon aria-hidden="true" />
            Trash
          </Button>
        ))}
    </>
  );

  if (isPending) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <LoadingPage />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />
      </>
    );
  }

  if (!access.canView) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <EmptyState
          icon={ShieldOffIcon}
          title="No Drive access"
          description="Your account cannot open Drive yet. Ask an admin to give you access."
        />
      </>
    );
  }

  if (inTrash) {
    return (
      <>
        <PageHeader title="Trash" description="Deleted files and folders." actions={headerActions} />
        {access.canDelete ? (
          <TrashView isAdmin={admin} />
        ) : (
          <EmptyState
            icon={ShieldOffIcon}
            title="No access to the trash"
            description="Opening the trash needs the delete permission. Ask an admin."
          />
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader title={TITLE} description={DESCRIPTION} actions={headerActions} />
      <StorageSummaryCard isAdmin={admin} />
      <DriveToolbar
        query={query}
        onQueryChange={(next) => updateParams({ q: next })}
        kind={kind}
        onKindChange={(next) => updateParams({ kind: next })}
        view={view}
        onViewChange={changeView}
        folderId={folderId}
        canUpload={canUploadHere}
        onNewFolder={() => setNewFolderOpen(true)}
      />
      <FolderBreadcrumbs folderId={folderId} query={query} onNavigate={openFolder} />
      <FileBrowser
        key={`${folderId ?? 'root'}|${query}|${kind}`}
        folderId={folderId}
        query={query}
        kind={kind}
        view={view}
        access={access}
        isAdmin={admin}
        canUploadHere={canUploadHere}
        onOpenFolder={openFolder}
      />
      {newFolderOpen && <NewFolderDialog parentId={folderId} onClose={() => setNewFolderOpen(false)} />}
    </>
  );
}
