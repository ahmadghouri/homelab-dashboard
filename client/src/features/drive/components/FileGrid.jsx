import { FolderIcon } from 'lucide-react';
import { useState } from 'react';
import { formatBytes, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { contentUrl, fileKindIcon, fileKindLabel } from '../utils';
import { FileActionsMenu, SelectCheckbox } from './FileActionsMenu';

function Thumbnail({ item }) {
  const [failed, setFailed] = useState(false);

  if (item.type === 'folder') {
    return <FolderIcon className="size-12 fill-primary/15 text-primary" aria-hidden="true" />;
  }
  if (item.kind === 'image' && !failed) {
    return (
      <img
        src={contentUrl(item.id)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    );
  }
  const Icon = fileKindIcon(item.kind);
  return <Icon className="size-10 text-muted-foreground" aria-hidden="true" />;
}

function itemMeta(item) {
  if (item.type === 'folder') {
    return 'Folder';
  }
  return `${formatBytes(item.sizeBytes)} · ${formatRelativeTime(item.updatedAt ?? item.createdAt)}`;
}

// Cards for folders and files. Click opens; Ctrl / Cmd click toggles the selection and
// Shift click selects a range. The checkbox works with the keyboard (Space).
export function FileGrid({ items, selectedKeys, onToggle, onOpen, access, onAction }) {
  const selecting = selectedKeys.size > 0;

  const handleClick = (item, event) => {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      onToggle(item, { range: event.shiftKey });
      return;
    }
    onOpen(item);
  };

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {items.map((item) => {
        const selected = selectedKeys.has(item.key);
        const label = item.type === 'folder' ? `Open folder ${item.name}` : `Open ${item.name}`;
        return (
          <li
            key={item.key}
            className={cn(
              'group relative min-w-0 overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/20',
              selected && 'border-primary ring-2 ring-primary/40',
            )}
          >
            <button
              type="button"
              onClick={(event) => handleClick(item, event)}
              aria-label={label}
              className="flex w-full flex-col text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
            >
              <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted/50">
                <Thumbnail item={item} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 p-2.5">
                <span className="truncate text-sm font-medium" title={item.name}>
                  {item.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {item.type === 'file' && <span className="sr-only">{fileKindLabel(item.kind)}, </span>}
                  {itemMeta(item)}
                </span>
              </span>
            </button>
            <SelectCheckbox
              checked={selected}
              onChange={(event) => onToggle(item, { range: event.nativeEvent.shiftKey })}
              label={`Select ${item.name}`}
              className={cn(
                'absolute top-2 left-2 shadow-sm transition-opacity',
                !selecting && !selected && 'sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
              )}
            />
            <div className="absolute top-1 right-1 rounded-md bg-background/80 backdrop-blur-sm">
              <FileActionsMenu item={item} access={access} onAction={onAction} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
