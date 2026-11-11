import { FolderIcon } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { formatBytes, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { fileKindIcon, fileKindLabel } from '../utils';
import { FileActionsMenu, SelectCheckbox } from './FileActionsMenu';

const EMPTY = '–';

// Folders always sort before files.
const typeRank = (item) => (item.type === 'folder' ? 0 : 1);

function bySortValue(getValue) {
  return (a, b) => {
    const rank = typeRank(a.original) - typeRank(b.original);
    if (rank !== 0) {
      return rank;
    }
    const left = getValue(a.original);
    const right = getValue(b.original);
    return typeof left === 'string' ? left.localeCompare(right) : left - right;
  };
}

const modifiedAt = (item) => new Date(item.updatedAt ?? item.createdAt ?? 0).getTime();

// uploadedBy may be populated ({ name, email }) or only an id; uploadedByName is a fallback.
export function uploaderName(file) {
  const uploader = file.uploadedBy;
  if (uploader && typeof uploader === 'object') {
    return uploader.name ?? uploader.email ?? EMPTY;
  }
  return file.uploadedByName ?? EMPTY;
}

function NameCell({ item, onOpen }) {
  const Icon = item.type === 'folder' ? FolderIcon : fileKindIcon(item.kind);
  return (
    <div className="flex max-w-56 min-w-0 items-center gap-2 sm:max-w-sm lg:max-w-md">
      <Icon
        className={cn('size-4 shrink-0', item.type === 'folder' ? 'fill-primary/15 text-primary' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col">
        <button
          type="button"
          onClick={() => onOpen(item)}
          title={item.name}
          className="truncate rounded-sm text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {item.name}
        </button>
        {/* On phones the secondary columns are hidden, so show the size here. */}
        {item.type === 'file' && (
          <span className="text-xs text-muted-foreground sm:hidden">{formatBytes(item.sizeBytes)}</span>
        )}
      </div>
    </div>
  );
}

function buildColumns({ items, selectedKeys, onToggle, onToggleAll, onOpen, access, onAction, accountNames }) {
  const selectedCount = items.filter((item) => selectedKeys.has(item.key)).length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  const columns = [
    {
      id: 'select',
      header: () => (
        <SelectCheckbox
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          onChange={() => onToggleAll(!allSelected)}
          label="Select all"
        />
      ),
      enableSorting: false,
      cell: ({ row }) => (
        <SelectCheckbox
          checked={selectedKeys.has(row.original.key)}
          onChange={(event) => onToggle(row.original, { range: event.nativeEvent.shiftKey })}
          label={`Select ${row.original.name}`}
        />
      ),
      meta: { className: 'w-8' },
    },
    {
      id: 'name',
      header: 'Name',
      accessorFn: (item) => item.name,
      sortFn: bySortValue((item) => item.name.toLowerCase()),
      cell: ({ row }) => <NameCell item={row.original} onOpen={onOpen} />,
    },
    {
      id: 'size',
      header: 'Size',
      accessorFn: (item) => item.sizeBytes ?? 0,
      sortFn: bySortValue((item) => item.sizeBytes ?? 0),
      cell: ({ row }) =>
        row.original.type === 'file' ? <span className="tabular-nums">{formatBytes(row.original.sizeBytes)}</span> : EMPTY,
      meta: { className: 'hidden sm:table-cell' },
    },
    {
      id: 'kind',
      header: 'Kind',
      accessorFn: (item) => (item.type === 'folder' ? 'Folder' : fileKindLabel(item.kind)),
      sortFn: bySortValue((item) => fileKindLabel(item.kind)),
      cell: ({ getValue }) => getValue(),
      meta: { className: 'hidden md:table-cell' },
    },
    {
      id: 'modified',
      header: 'Modified',
      accessorFn: modifiedAt,
      sortFn: bySortValue(modifiedAt),
      cell: ({ row }) => {
        const date = row.original.updatedAt ?? row.original.createdAt;
        return date ? <span className="whitespace-nowrap">{formatDateTime(date)}</span> : EMPTY;
      },
      meta: { className: 'hidden sm:table-cell' },
    },
    {
      id: 'uploadedBy',
      header: 'Uploaded by',
      enableSorting: false,
      cell: ({ row }) => (row.original.type === 'file' ? uploaderName(row.original) : EMPTY),
      meta: { className: 'hidden lg:table-cell' },
    },
  ];

  if (accountNames) {
    columns.push({
      id: 'account',
      header: 'Account',
      enableSorting: false,
      cell: ({ row }) => {
        const name = accountNames.get(row.original.accountId);
        return name ? (
          <span className="block max-w-48 truncate" title={name}>
            {name}
          </span>
        ) : (
          EMPTY
        );
      },
      meta: { className: 'hidden xl:table-cell' },
    });
  }

  columns.push({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    enableSorting: false,
    cell: ({ row }) => <FileActionsMenu item={row.original} access={access} onAction={onAction} />,
    meta: { className: 'w-10 text-right' },
  });
  return columns;
}

// List view of folders and files. accountNames (Map id → email) adds the Account column (admins).
export function FileTable({ items, selectedKeys, onToggle, onToggleAll, onOpen, access, onAction, accountNames }) {
  return (
    <DataTable
      columns={buildColumns({ items, selectedKeys, onToggle, onToggleAll, onOpen, access, onAction, accountNames })}
      data={items}
      getRowId={(item) => item.key}
      initialSorting={[{ id: 'name', desc: false }]}
      emptyMessage="Nothing here"
    />
  );
}
