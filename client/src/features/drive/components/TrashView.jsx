import { FolderIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDriveMutations } from '../hooks/useDriveMutations';
import { useSelection } from '../hooks/useSelection';
import { useTrash } from '../hooks/useTrash';
import { fileKindIcon, splitIds, toDriveItems } from '../utils';
import { SelectCheckbox } from './FileActionsMenu';

const EMPTY = '–';

function countLabel(items) {
  return items.length === 1 ? `"${items[0].name}"` : `${items.length} items`;
}

function buildColumns({ items, selection, isAdmin, onRestore, onDelete, busy }) {
  const selectedCount = selection.selectedItems.length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  return [
    {
      id: 'select',
      header: () => (
        <SelectCheckbox
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          onChange={() => selection.setAll(!allSelected)}
          label="Select all"
        />
      ),
      enableSorting: false,
      cell: ({ row }) => (
        <SelectCheckbox
          checked={selection.selectedKeys.has(row.original.key)}
          onChange={(event) => selection.toggle(row.original, { range: event.nativeEvent.shiftKey })}
          label={`Select ${row.original.name}`}
        />
      ),
      meta: { className: 'w-8' },
    },
    {
      id: 'name',
      header: 'Name',
      accessorFn: (item) => item.name.toLowerCase(),
      cell: ({ row }) => {
        const item = row.original;
        const Icon = item.type === 'folder' ? FolderIcon : fileKindIcon(item.kind);
        return (
          <div className="flex max-w-48 min-w-0 items-center gap-2 sm:max-w-sm">
            <Icon
              className={cn('size-4 shrink-0', item.type === 'folder' ? 'text-primary' : 'text-muted-foreground')}
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium" title={item.name}>
                {item.name}
              </span>
              <span className="text-xs text-muted-foreground sm:hidden">
                Deleted {formatRelativeTime(item.trashedAt)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'size',
      header: 'Size',
      accessorFn: (item) => item.sizeBytes ?? 0,
      cell: ({ row }) => {
        const item = row.original;
        if (item.type === 'file') {
          return formatBytes(item.sizeBytes);
        }
        return `Folder · ${item.fileCount ?? 0} ${item.fileCount === 1 ? 'file' : 'files'}`;
      },
      meta: { className: 'hidden sm:table-cell' },
    },
    {
      id: 'trashedAt',
      header: 'Deleted',
      accessorFn: (item) => new Date(item.trashedAt ?? 0).getTime(),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.trashedAt ? formatRelativeTime(row.original.trashedAt) : EMPTY}</span>
          {row.original.deleteAt && (
            <span className="text-xs text-muted-foreground">
              Gone for good {formatRelativeTime(row.original.deleteAt)}
            </span>
          )}
        </div>
      ),
      meta: { className: 'hidden sm:table-cell' },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onRestore([row.original])}
            disabled={busy}
            aria-label={`Restore ${row.original.name}`}
            title="Restore"
          >
            <RotateCcwIcon aria-hidden="true" />
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete([row.original])}
              disabled={busy}
              aria-label={`Delete ${row.original.name} forever`}
              title="Delete forever"
              className="text-destructive hover:text-destructive"
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
      meta: { className: 'w-20 text-right' },
    },
  ];
}

// Trashed files and folders: restore (delete permission), delete forever and empty (admin).
export function TrashView({ isAdmin }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useTrash();
  const { restore, deleteForever } = useDriveMutations();
  const items = data ? toDriveItems(data) : [];
  const selection = useSelection(items);
  // { items } to delete forever, or { all: true } to empty the trash.
  const [confirm, setConfirm] = useState(null);
  const busy = restore.isPending || deleteForever.isPending;

  const handleRestore = (targets) =>
    restore.mutate(splitIds(targets), {
      onSuccess: () => {
        selection.clear();
        toast.success(`${countLabel(targets)} restored`);
      },
      onError: (mutationError) => toast.error(mutationError.message),
    });

  const handleDelete = () => {
    const payload = confirm.all ? { all: true } : splitIds(confirm.items);
    deleteForever.mutate(payload, {
      onSuccess: () => {
        toast.success(confirm.all ? 'Trash emptied' : `${countLabel(confirm.items)} deleted forever`);
        setConfirm(null);
        selection.clear();
      },
      onError: (mutationError) => toast.error(mutationError.message),
    });
  };

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={Trash2Icon} title="Trash is empty" description="Deleted files and folders show up here." />
    );
  }

  const selected = selection.selectedItems;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Items in the trash are deleted for good after the retention period (30 days by default).
        </p>
        {isAdmin && (
          <Button variant="destructive" onClick={() => setConfirm({ all: true })} disabled={busy}>
            <Trash2Icon aria-hidden="true" />
            Empty trash
          </Button>
        )}
      </div>

      {selected.length > 0 && (
        <div
          role="toolbar"
          aria-label="Selected items"
          className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2"
        >
          <span className="mr-auto text-sm font-medium">{selected.length} selected</span>
          <Button variant="outline" size="sm" onClick={() => handleRestore(selected)} disabled={busy}>
            <RotateCcwIcon aria-hidden="true" />
            Restore
          </Button>
          {isAdmin && (
            <Button variant="destructive" size="sm" onClick={() => setConfirm({ items: selected })} disabled={busy}>
              <Trash2Icon aria-hidden="true" />
              Delete forever
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={selection.clear}>
            Clear
          </Button>
        </div>
      )}

      <DataTable
        columns={buildColumns({
          items,
          selection,
          isAdmin,
          busy,
          onRestore: handleRestore,
          onDelete: (targets) => setConfirm({ items: targets }),
        })}
        data={items}
        getRowId={(item) => item.key}
        initialSorting={[{ id: 'trashedAt', desc: true }]}
        emptyMessage="Trash is empty"
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && !deleteForever.isPending && setConfirm(null)}
        title={confirm?.all ? 'Empty the trash?' : `Delete ${confirm ? countLabel(confirm.items) : ''} forever?`}
        description={
          confirm?.all
            ? 'Every item in the trash is deleted from Google Drive. This cannot be undone.'
            : 'The files are deleted from Google Drive, including everything inside deleted folders. This cannot be undone.'
        }
        confirmLabel={confirm?.all ? 'Empty trash' : 'Delete forever'}
        destructive
        isPending={deleteForever.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
