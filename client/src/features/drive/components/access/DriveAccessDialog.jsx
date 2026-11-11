import { LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useDriveAccessList, useSaveDriveAccess } from '@/features/drive/hooks/useDriveAccess';
import { FolderScopePicker } from './FolderScopePicker';

const PERMISSIONS = [
  { key: 'canView', label: 'View', description: 'See folders and files, and preview them.' },
  { key: 'canDownload', label: 'Download', description: 'Download files to their device.' },
  { key: 'canUpload', label: 'Upload and organise', description: 'Upload files, create, rename and move folders and files.' },
  { key: 'canDelete', label: 'Delete', description: 'Move files and folders to the trash and restore them.' },
  { key: 'canShare', label: 'Share links', description: 'Create and revoke share links for files.' },
];

const NO_ACCESS = {
  canView: false,
  canDownload: false,
  canUpload: false,
  canDelete: false,
  canShare: false,
  scope: 'all',
  folderIds: [],
};

function toForm(access) {
  return { ...NO_ACCESS, ...access, folderIds: access?.folderIds ?? [] };
}

// Every permission needs View, so turning View off turns everything off and any other switch turns View on.
function applyPermission(form, key, checked) {
  if (key === 'canView' && !checked) {
    return { ...form, canView: false, canDownload: false, canUpload: false, canDelete: false, canShare: false };
  }
  return { ...form, [key]: checked, ...(checked ? { canView: true } : {}) };
}

function errorText(details, field) {
  const value = details?.[field];
  return Array.isArray(value) ? value.join(' ') : value;
}

function AccessForm({ entry, onClose }) {
  const [form, setFormState] = useState(() => toForm(entry.access));
  const [localError, setLocalError] = useState(null);
  const save = useSaveDriveAccess();
  const details = save.error?.details;

  // Any change clears the previous validation message.
  const setForm = (update) => {
    setLocalError(null);
    setFormState(update);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (save.isPending) {
      return;
    }
    if (form.canView && form.scope === 'folders' && form.folderIds.length === 0) {
      setLocalError('Pick at least one folder, or choose All folders.');
      return;
    }
    setLocalError(null);
    const payload = {
      userId: entry.userId,
      canView: form.canView,
      canDownload: form.canDownload,
      canUpload: form.canUpload,
      canDelete: form.canDelete,
      canShare: form.canShare,
      scope: form.scope,
      folderIds: form.scope === 'folders' ? form.folderIds : [],
    };
    save.mutate(payload, {
      onSuccess: () => {
        toast.success(`Drive access saved for ${entry.name}`);
        onClose();
      },
    });
  };

  const serverError = save.isError ? errorText(details, 'folderIds') || save.error.message : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-5">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">Permissions</legend>
        <ul className="flex flex-col divide-y">
          {PERMISSIONS.map((permission) => {
            const id = `drive-perm-${permission.key}`;
            return (
              <li key={permission.key} className="flex items-center gap-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <label htmlFor={id} className="text-sm font-medium">
                    {permission.label}
                  </label>
                  <span id={`${id}-help`} className="text-xs text-muted-foreground">
                    {permission.description}
                  </span>
                </div>
                <Switch
                  id={id}
                  checked={form[permission.key]}
                  disabled={save.isPending}
                  aria-describedby={`${id}-help`}
                  onCheckedChange={(checked) => setForm((current) => applyPermission(current, permission.key, checked))}
                />
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-2" disabled={!form.canView || save.isPending}>
        <legend className="mb-1 text-sm font-medium">Folders</legend>
        {[
          { value: 'all', label: 'All folders', description: 'Everything in the Drive, including new folders.' },
          { value: 'folders', label: 'Selected folders', description: 'Only the folders checked below and what is inside them.' },
        ].map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-sm has-disabled:opacity-50">
            <input
              type="radio"
              name="drive-scope"
              value={option.value}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={form.scope === option.value}
              onChange={() => setForm((current) => ({ ...current, scope: option.value }))}
            />
            <span className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </span>
          </label>
        ))}
        {form.canView && form.scope === 'folders' && (
          <FolderScopePicker
            value={form.folderIds}
            disabled={save.isPending}
            onChange={(folderIds) => setForm((current) => ({ ...current, folderIds }))}
          />
        )}
      </fieldset>

      {!form.canView && (
        <p className="text-sm text-muted-foreground">With View off, {entry.name} cannot open the Drive at all.</p>
      )}

      {(localError || serverError) && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {localError || serverError}
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
          Save access
        </Button>
      </DialogFooter>
    </form>
  );
}

// Admin dialog that sets what one viewer may do in the Drive (Settings > Users > Drive access).
export function DriveAccessDialog({ userId, userName, open, onOpenChange }) {
  const { data: users, isPending, isError, error, refetch, isRefetching } = useDriveAccessList();
  const entry = users?.find((user) => user.userId === userId);

  let content;
  if (isPending) {
    content = <Skeleton className="h-72 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else if (!entry) {
    // The list is cached for a minute, so a user added just now may be missing: offer a reload.
    content = (
      <ErrorState
        title="User not found"
        message="The Drive access list does not include this user yet."
        onRetry={() => refetch()}
        isRetrying={isRefetching}
      />
    );
  } else if (entry.role === 'admin') {
    content = <p className="text-sm text-muted-foreground">Admins always have full Drive access.</p>;
  } else {
    content = <AccessForm key={entry.userId} entry={entry} onClose={() => onOpenChange(false)} />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Drive access: {userName}</DialogTitle>
          <DialogDescription>
            Choose what {userName} can do in the Drive. Without View they do not see the Drive at all.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
