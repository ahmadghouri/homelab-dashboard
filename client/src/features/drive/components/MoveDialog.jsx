import { FolderIcon, HardDriveIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FormDialog } from '@/components/common/FormDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDriveMutations } from '../hooks/useDriveMutations';
import { useFolderTree } from '../hooks/useFolders';

const ROOT = '__root__';

// Depth-first list of the folder tree: [{ id, name, depth }]. Folders whose parent is
// not visible (scoped access) are shown at the top level.
function flattenTree(folders) {
  const ids = new Set(folders.map((folder) => folder.id));
  const children = new Map();
  for (const folder of folders) {
    const parent = folder.parentId && ids.has(folder.parentId) ? folder.parentId : null;
    if (!children.has(parent)) {
      children.set(parent, []);
    }
    children.get(parent).push(folder);
  }
  const result = [];
  const visit = (parentId, depth) => {
    const list = (children.get(parentId) ?? []).toSorted((a, b) => a.name.localeCompare(b.name));
    for (const folder of list) {
      result.push({ id: folder.id, name: folder.name, depth, parentId: folder.parentId });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

// Ids of the moved folders and everything below them: a folder cannot move into itself.
function blockedIds(folders, movedFolderIds) {
  const blocked = new Set(movedFolderIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (!blocked.has(folder.id) && folder.parentId && blocked.has(folder.parentId)) {
        blocked.add(folder.id);
        grew = true;
      }
    }
  }
  return blocked;
}

function itemParent(item) {
  return (item.type === 'folder' ? item.parentId : item.folderId) ?? null;
}

function Option({ value, checked, disabled, onChange, depth = 0, icon: Icon, children }) {
  return (
    <label
      style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 text-sm hover:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring',
        checked && 'bg-primary/10 font-medium',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
      )}
    >
      <input
        type="radio"
        name="drive-move-target"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </label>
  );
}

// Moves files and folders into another folder. onDone runs after a successful move.
export function MoveDialog({ items, onClose, onDone }) {
  const { data: folders, isPending, isError, error } = useFolderTree();
  const { move } = useDriveMutations();
  const parents = new Set(items.map(itemParent));
  const currentParent = parents.size === 1 ? [...parents][0] : undefined;
  const [target, setTarget] = useState(undefined);
  const [hint, setHint] = useState(null);
  const choose = (value) => {
    setTarget(value);
    setHint(null);
  };

  const movedFolderIds = items.filter((item) => item.type === 'folder').map((item) => item.id);
  const blocked = blockedIds(folders ?? [], movedFolderIds);
  const options = flattenTree(folders ?? []);
  const targetId = target === ROOT ? null : target;
  const unchanged = target === undefined || targetId === currentParent;
  const title = items.length === 1 ? `Move ${items[0].name}` : `Move ${items.length} items`;

  const handleSubmit = () => {
    if (unchanged) {
      setHint(target === undefined ? 'Choose a destination folder' : 'The items are already in this folder');
      return;
    }
    setHint(null);
    move.mutate(
      {
        fileIds: items.filter((item) => item.type === 'file').map((item) => item.id),
        folderIds: movedFolderIds,
        folderId: targetId,
      },
      {
        onSuccess: () => {
          const destination = targetId ? options.find((option) => option.id === targetId)?.name : 'Drive';
          onClose();
          onDone?.();
          toast.success(`Moved to ${destination ?? 'the folder'}`);
        },
      },
    );
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description="Choose the destination folder."
      submitLabel="Move here"
      isPending={move.isPending}
      error={hint || (move.isError && move.error.message) || (isError && error.message) || null}
      onSubmit={handleSubmit}
    >
      <fieldset className="max-h-72 overflow-y-auto rounded-lg border p-1">
        <legend className="sr-only">Destination folder</legend>
        {isPending ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-3/5" />
          </div>
        ) : (
          <>
            <Option
              value={ROOT}
              icon={HardDriveIcon}
              checked={target === ROOT}
              onChange={() => choose(ROOT)}
            >
              Drive (top level){currentParent === null && ' · current'}
            </Option>
            {options.map((option) => (
              <Option
                key={option.id}
                value={option.id}
                icon={FolderIcon}
                depth={option.depth + 1}
                checked={target === option.id}
                disabled={blocked.has(option.id)}
                onChange={() => choose(option.id)}
              >
                {option.name}
                {currentParent === option.id && ' · current'}
              </Option>
            ))}
          </>
        )}
      </fieldset>
    </FormDialog>
  );
}
