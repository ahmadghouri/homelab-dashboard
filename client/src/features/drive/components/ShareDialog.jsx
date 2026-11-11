import { CheckIcon, CopyIcon, Link2Icon, Link2OffIcon, LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { formatDateTime } from '@/lib/format';
import { useShareMutations, useShares } from '../hooks/useShares';

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never', days: null },
  { value: '1', label: '1 day', days: 1 },
  { value: '7', label: '7 days', days: 7 },
  { value: '30', label: '30 days', days: 30 },
];

function isExpired(share) {
  return Boolean(share.expiresAt) && new Date(share.expiresAt).getTime() <= Date.now();
}

function CopyLinkField({ url, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        aria-label={label}
        onFocus={(event) => event.target.select()}
        className="h-8 min-w-0 flex-1 rounded-md border bg-muted px-2.5 font-mono text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label={`Copy ${label}`}>
        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      </Button>
    </div>
  );
}

function shareMeta(share) {
  const parts = [];
  if (isExpired(share)) {
    parts.push('Expired');
  } else {
    parts.push(share.expiresAt ? `Expires ${formatDateTime(share.expiresAt)}` : 'Never expires');
  }
  parts.push(share.allowDownload ? 'download allowed' : 'view only');
  if (typeof share.views === 'number') {
    parts.push(`${share.views} ${share.views === 1 ? 'view' : 'views'}`);
  }
  return parts.join(' · ');
}

// Create, copy and revoke public links for one file.
export function ShareDialog({ file, open, onOpenChange }) {
  const [expiry, setExpiry] = useState('7');
  const [allowDownload, setAllowDownload] = useState(true);
  const [revoking, setRevoking] = useState(null);
  const { data: shares, isPending, isError, refetch } = useShares({ enabled: open });
  const { create, revoke } = useShareMutations();

  const fileShares = (shares ?? []).filter((share) => share.fileId === file?.id && !share.revokedAt);

  const handleCreate = async () => {
    const days = EXPIRY_OPTIONS.find((option) => option.value === expiry)?.days ?? null;
    try {
      const share = await create.mutateAsync({ fileId: file.id, expiresInDays: days, allowDownload });
      try {
        await navigator.clipboard.writeText(share.url);
        toast.success('Link created and copied');
      } catch {
        toast.success('Link created');
      }
    } catch (error) {
      toast.error('Could not create the link', { description: error.message });
    }
  };

  const handleRevoke = () => {
    revoke.mutate(revoking.id, {
      onSuccess: () => {
        toast.success('Link revoked');
        setRevoking(null);
      },
      onError: (error) => toast.error('Could not revoke the link', { description: error.message }),
    });
  };

  if (!file) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="min-w-0 pr-8">
            <DialogTitle className="truncate leading-normal">Share {file.name}</DialogTitle>
            <DialogDescription>Anyone with the link can open this file without logging in.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 rounded-lg border p-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="share-expiry">Link expires</FieldLabel>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger id="share-expiry" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal" className="sm:self-end sm:pb-1.5">
                <Switch id="share-download" checked={allowDownload} onCheckedChange={setAllowDownload} />
                <FieldLabel htmlFor="share-download">Allow download</FieldLabel>
              </Field>
            </div>
            <Button onClick={handleCreate} disabled={create.isPending} className="self-start">
              {create.isPending ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <Link2Icon aria-hidden="true" />
              )}
              Create link
            </Button>
          </div>

          <section aria-labelledby="share-links-title" className="flex flex-col gap-2">
            <h3 id="share-links-title" className="text-sm font-medium">
              Links for this file
            </h3>
            {isPending && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            )}
            {isError && (
              <p className="text-sm text-danger">
                Could not load the links.{' '}
                <button type="button" className="underline underline-offset-3" onClick={() => refetch()}>
                  Try again
                </button>
              </p>
            )}
            {!isPending && !isError && fileShares.length === 0 && (
              <p className="text-sm text-muted-foreground">No links yet.</p>
            )}
            {fileShares.length > 0 && (
              <ul className="flex max-h-64 flex-col gap-3 overflow-y-auto">
                {fileShares.map((share) => (
                  <li key={share.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <CopyLinkField url={share.url} label="share link" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRevoking(share)}
                        aria-label="Revoke link"
                        className="text-danger hover:text-danger"
                      >
                        <Link2OffIcon aria-hidden="true" />
                      </Button>
                    </div>
                    <p className={isExpired(share) ? 'text-xs text-warning' : 'text-xs text-muted-foreground'}>
                      {shareMeta(share)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(revoking)}
        onOpenChange={(next) => !next && setRevoking(null)}
        title="Revoke this link?"
        description="People who have the link can no longer open the file. This cannot be undone."
        confirmLabel="Revoke"
        destructive
        isPending={revoke.isPending}
        onConfirm={handleRevoke}
      />
    </>
  );
}
