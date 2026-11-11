import { ChevronLeftIcon, ChevronRightIcon, FolderInputIcon, FolderOpenIcon, SearchXIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDriveAccounts } from '../hooks/useDriveAccounts';
import { useDriveFiles } from '../hooks/useDriveFiles';
import { useDriveMutations } from '../hooks/useDriveMutations';
import { useSelection } from '../hooks/useSelection';
import { splitIds, toDriveItems } from '../utils';
import { FileGrid } from './FileGrid';
import { FilePreviewDialog } from './FilePreviewDialog';
import { FileTable } from './FileTable';
import { MoveDialog } from './MoveDialog';
import { RenameDialog } from './RenameDialog';
import { ShareDialog } from './ShareDialog';
import { UploadDropZone } from './UploadDropZone';

const PAGE_SIZE = 100;

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" aria-busy="true">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="aspect-[4/3] w-full rounded-xl" />
      ))}
    </div>
  );
}

function countLabel(items) {
  return items.length === 1 ? `"${items[0].name}"` : `${items.length} items`;
}

function SelectionBar({ items, access, busy, onMove, onTrash, onClear }) {
  return (
    <div
      role="toolbar"
      aria-label="Selected items"
      className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur"
    >
      <span className="mr-auto text-sm font-medium">{items.length} selected</span>
      {access.canUpload && (
        <Button variant="outline" size="sm" onClick={onMove} disabled={busy}>
          <FolderInputIcon aria-hidden="true" />
          Move
        </Button>
      )}
      {access.canDelete && (
        <Button variant="destructive" size="sm" onClick={onTrash} disabled={busy}>
          <Trash2Icon aria-hidden="true" />
          Move to trash
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear selection">
        <XIcon aria-hidden="true" />
        <span className="hidden sm:inline">Clear</span>
      </Button>
    </div>
  );
}

function Pager({ page, total, onPageChange }) {
  const pageCount = Math.ceil(total / PAGE_SIZE);
  if (pageCount <= 1) {
    return null;
  }
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {first}–{last} of {total} files
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function EmptyListing({ query, kind, canUpload }) {
  if (query || kind) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="No matching files"
        description={query ? `Nothing in your folders matches "${query}".` : 'No files of this kind in this folder.'}
      />
    );
  }
  return (
    <EmptyState
      icon={FolderOpenIcon}
      title={canUpload ? 'No files yet. Upload or drop files here.' : 'This folder is empty'}
      description={canUpload ? 'Files of any type can be uploaded, up to 10 GB each.' : undefined}
    />
  );
}

// The folder listing (or search results) with selection, per-item actions and their dialogs.
// Keyed by folder, search and kind in the page, so selection and paging reset when those change.
// canUploadHere: uploads and drops into this folder are allowed (false in search results).
export function FileBrowser({ folderId, query, kind, view, access, isAdmin, canUploadHere, onOpenFolder }) {
  const [page, setPage] = useState(1);
  // { type: 'preview' | 'share' | 'rename', item } or { type: 'move' | 'trash', items }.
  const [dialog, setDialog] = useState(null);
  const params = {
    ...(query ? { q: query } : folderId ? { folderId } : {}),
    ...(kind ? { kind } : {}),
    sort: 'name',
    order: 'asc',
    page,
    limit: PAGE_SIZE,
  };
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } = useDriveFiles(params);
  const { data: accountData } = useDriveAccounts({ enabled: isAdmin });
  const { trash } = useDriveMutations();
  const items = data ? toDriveItems({ folders: query ? [] : data.folders, files: data.files }) : [];
  const selection = useSelection(items);
  const files = items.filter((item) => item.type === 'file');
  const accountNames = isAdmin
    ? new Map((accountData?.accounts ?? []).map((account) => [account.id, account.email]))
    : undefined;

  const closeDialog = () => setDialog(null);

  const openItem = (item) => {
    if (item.type === 'folder') {
      onOpenFolder(item.id);
    } else if (access.canView) {
      setDialog({ type: 'preview', item });
    }
  };

  const handleAction = (action, item) => {
    if (action === 'open') {
      onOpenFolder(item.id);
    } else if (action === 'move' || action === 'trash') {
      setDialog({ type: action, items: [item] });
    } else {
      setDialog({ type: action, item });
    }
  };

  const handleTrash = () => {
    const targets = dialog.items;
    trash.mutate(splitIds(targets), {
      onSuccess: () => {
        closeDialog();
        selection.clear();
        toast.success(`${countLabel(targets)} moved to the trash`);
      },
      onError: (mutationError) => toast.error(mutationError.message),
    });
  };

  let content;
  if (isPending) {
    content = <LoadingGrid />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else if (items.length === 0) {
    content = <EmptyListing query={query} kind={kind} canUpload={canUploadHere} />;
  } else {
    const listProps = {
      items,
      selectedKeys: selection.selectedKeys,
      onToggle: selection.toggle,
      onOpen: openItem,
      access,
      onAction: handleAction,
    };
    content = (
      <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
        {view === 'list' ? (
          <FileTable {...listProps} onToggleAll={selection.setAll} accountNames={accountNames} />
        ) : (
          <FileGrid {...listProps} />
        )}
      </div>
    );
  }

  const selected = selection.selectedItems;
  const body = (
    <div
      className="flex min-h-64 flex-col gap-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && selected.length > 0 && !dialog) {
          selection.clear();
        }
      }}
    >
      {selected.length > 0 && (
        <SelectionBar
          items={selected}
          access={access}
          busy={trash.isPending}
          onMove={() => setDialog({ type: 'move', items: selected })}
          onTrash={() => setDialog({ type: 'trash', items: selected })}
          onClear={selection.clear}
        />
      )}
      {content}
      {data && <Pager page={page} total={data.total} onPageChange={setPage} />}
    </div>
  );

  return (
    <>
      {canUploadHere ? <UploadDropZone folderId={folderId ?? null}>{body}</UploadDropZone> : body}

      {dialog?.type === 'preview' && (
        <FilePreviewDialog
          file={dialog.item}
          open
          onOpenChange={(open) => !open && closeDialog()}
          files={files}
          canDownload={access.canDownload}
        />
      )}
      {dialog?.type === 'share' && (
        <ShareDialog file={dialog.item} open onOpenChange={(open) => !open && closeDialog()} />
      )}
      {dialog?.type === 'rename' && <RenameDialog item={dialog.item} onClose={closeDialog} />}
      {dialog?.type === 'move' && (
        <MoveDialog items={dialog.items} onClose={closeDialog} onDone={selection.clear} />
      )}
      <ConfirmDialog
        open={dialog?.type === 'trash'}
        onOpenChange={(open) => !open && !trash.isPending && closeDialog()}
        title={dialog?.type === 'trash' ? `Move ${countLabel(dialog.items)} to the trash?` : ''}
        description="Folders go to the trash with everything inside them. Items can be restored from the trash until they are deleted for good (after 30 days by default)."
        confirmLabel="Move to trash"
        destructive
        isPending={trash.isPending}
        onConfirm={handleTrash}
      />
    </>
  );
}
