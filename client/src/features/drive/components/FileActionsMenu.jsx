import {
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FolderInputIcon,
  FolderOpenIcon,
  PencilIcon,
  Share2Icon,
  Trash2Icon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { contentUrl } from '../utils';

// Which actions the user's Drive access allows for one item (file or folder).
export function allowedActions(item, access) {
  const isFile = item.type === 'file';
  return {
    open: !isFile,
    preview: isFile && access.canView,
    download: isFile && access.canDownload,
    rename: access.canUpload,
    move: access.canUpload,
    share: isFile && access.canShare,
    trash: access.canDelete,
  };
}

// Per-item menu. Only actions the access allows are shown; with none, nothing renders.
// onAction(action, item) with action 'open' | 'preview' | 'rename' | 'move' | 'share' | 'trash'.
export function FileActionsMenu({ item, access, onAction, className }) {
  const allowed = allowedActions(item, access);
  const hasEdit = allowed.rename || allowed.move || allowed.share;
  if (!Object.values(allowed).some(Boolean)) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.name}`} className={className}>
          <EllipsisVerticalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {allowed.open && (
          <DropdownMenuItem onSelect={() => onAction('open', item)}>
            <FolderOpenIcon aria-hidden="true" />
            Open
          </DropdownMenuItem>
        )}
        {allowed.preview && (
          <DropdownMenuItem onSelect={() => onAction('preview', item)}>
            <EyeIcon aria-hidden="true" />
            Preview
          </DropdownMenuItem>
        )}
        {allowed.download && (
          <DropdownMenuItem asChild>
            <a href={contentUrl(item.id, { download: true })} download={item.name}>
              <DownloadIcon aria-hidden="true" />
              Download
            </a>
          </DropdownMenuItem>
        )}
        {hasEdit && (allowed.open || allowed.preview || allowed.download) && <DropdownMenuSeparator />}
        {allowed.rename && (
          <DropdownMenuItem onSelect={() => onAction('rename', item)}>
            <PencilIcon aria-hidden="true" />
            Rename
          </DropdownMenuItem>
        )}
        {allowed.move && (
          <DropdownMenuItem onSelect={() => onAction('move', item)}>
            <FolderInputIcon aria-hidden="true" />
            Move
          </DropdownMenuItem>
        )}
        {allowed.share && (
          <DropdownMenuItem onSelect={() => onAction('share', item)}>
            <Share2Icon aria-hidden="true" />
            Share
          </DropdownMenuItem>
        )}
        {allowed.trash && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onAction('trash', item)}>
              <Trash2Icon aria-hidden="true" />
              Move to trash
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Shared look of the selection checkbox in the grid, the list and the trash.
export function SelectCheckbox({ checked, indeterminate = false, onChange, label, className }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(node) => {
        if (node) {
          node.indeterminate = indeterminate;
        }
      }}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
      className={cn('size-4 cursor-pointer rounded accent-primary', className)}
    />
  );
}
