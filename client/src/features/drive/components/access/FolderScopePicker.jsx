import { FolderIcon } from 'lucide-react';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useFolderTree } from '@/features/drive/hooks/useFolders';

// Groups the flat folder list by parent id, sorted by name. Top-level folders (and folders whose
// parent is not in the list) go under 'root'.
function groupByParent(folders) {
  const ids = new Set(folders.map((folder) => folder.id));
  const byParent = new Map();
  for (const folder of folders) {
    const key = folder.parentId && ids.has(folder.parentId) ? folder.parentId : 'root';
    if (!byParent.has(key)) {
      byParent.set(key, []);
    }
    byParent.get(key).push(folder);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return byParent;
}

// Keeps only the selected folders that still exist and whose ancestors are not selected
// (a selected folder already includes its whole subtree).
export function normalizeFolderIds(folders, selectedIds) {
  const parentOf = new Map(folders.map((folder) => [folder.id, folder.parentId ?? null]));
  const selected = new Set(selectedIds);
  return selectedIds.filter((id) => {
    if (!parentOf.has(id)) {
      return false;
    }
    for (let parent = parentOf.get(id); parent; parent = parentOf.get(parent)) {
      if (selected.has(parent)) {
        return false;
      }
    }
    return true;
  });
}

function FolderNode({ folder, byParent, selected, inherited, disabled, onToggle, depth }) {
  const children = byParent.get(folder.id) ?? [];
  const checked = inherited || selected.has(folder.id);
  const inputId = `drive-scope-${folder.id}`;

  return (
    <li>
      <div className="flex min-h-9 items-center gap-2" style={{ paddingLeft: `${depth * 1.25}rem` }}>
        <input
          id={inputId}
          type="checkbox"
          className="size-4 shrink-0 accent-primary"
          checked={checked}
          disabled={disabled || inherited}
          onChange={(event) => onToggle(folder.id, event.target.checked)}
        />
        <label htmlFor={inputId} className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{folder.name}</span>
          {inherited && <span className="sr-only">(included by its parent folder)</span>}
        </label>
      </div>
      {children.length > 0 && (
        <ul>
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              byParent={byParent}
              selected={selected}
              inherited={checked}
              disabled={disabled}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// Checklist of every Drive folder. Checking a folder gives access to it and everything inside it.
export function FolderScopePicker({ value, onChange, disabled = false }) {
  const { data: folders, isPending, isError, error, refetch, isRefetching } = useFolderTree();

  if (isPending) {
    return <Skeleton className="h-32 w-full" />;
  }
  if (isError) {
    return <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  }
  if (!folders.length) {
    return (
      <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
        There are no folders yet. Create folders on the Drive page first, or give access to all folders.
      </p>
    );
  }

  const byParent = groupByParent(folders);
  const selected = new Set(value);
  const toggle = (id, checked) => {
    const next = checked ? [...value, id] : value.filter((item) => item !== id);
    onChange(normalizeFolderIds(folders, next));
  };

  return (
    <ul
      aria-label="Folders this user can access"
      className="max-h-64 overflow-y-auto rounded-md border px-2 py-1"
    >
      {(byParent.get('root') ?? []).map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          byParent={byParent}
          selected={selected}
          inherited={false}
          disabled={disabled}
          onToggle={toggle}
          depth={0}
        />
      ))}
    </ul>
  );
}
