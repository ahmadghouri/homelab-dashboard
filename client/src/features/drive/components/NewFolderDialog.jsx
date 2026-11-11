import { useState } from 'react';
import { toast } from 'sonner';
import { FormDialog } from '@/components/common/FormDialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useDriveMutations } from '../hooks/useDriveMutations';

const MAX_LENGTH = 120;

function validate(name) {
  if (!name) {
    return 'Enter a folder name';
  }
  if (/[/\\]/.test(name)) {
    return 'A name cannot contain / or \\';
  }
  return null;
}

// Creates a folder inside parentId (null = Drive root). Closes itself on success.
export function NewFolderDialog({ parentId, onClose }) {
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const { createFolder } = useDriveMutations();
  const trimmed = name.trim();
  const fieldError = touched ? validate(trimmed) : null;
  const serverFieldError = createFolder.error?.details?.name;
  const errors = [fieldError, ...(serverFieldError ? [].concat(serverFieldError) : [])]
    .filter(Boolean)
    .map((message) => ({ message }));

  const handleSubmit = () => {
    setTouched(true);
    if (validate(trimmed)) {
      return;
    }
    createFolder.mutate(
      { name: trimmed, parentId: parentId ?? null },
      {
        onSuccess: () => {
          onClose();
          toast.success(`Folder ${trimmed} created`);
        },
      },
    );
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="New folder"
      submitLabel="Create"
      isPending={createFolder.isPending}
      error={createFolder.isError && !serverFieldError ? createFolder.error.message : null}
      onSubmit={handleSubmit}
    >
      <Field data-invalid={errors.length > 0}>
        <FieldLabel htmlFor="drive-new-folder">Name</FieldLabel>
        <Input
          id="drive-new-folder"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_LENGTH}
          placeholder="Untitled folder"
          aria-invalid={errors.length > 0}
          autoFocus
          autoComplete="off"
        />
        <FieldError errors={errors} />
      </Field>
    </FormDialog>
  );
}
