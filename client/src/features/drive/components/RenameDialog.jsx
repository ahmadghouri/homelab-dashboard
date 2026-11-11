import { useState } from 'react';
import { toast } from 'sonner';
import { FormDialog } from '@/components/common/FormDialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useDriveMutations } from '../hooks/useDriveMutations';

const MAX_LENGTH = { file: 255, folder: 120 };

function validate(name, type) {
  if (!name) {
    return 'Enter a name';
  }
  if (name.length > MAX_LENGTH[type]) {
    return `Use at most ${MAX_LENGTH[type]} characters`;
  }
  if (/[/\\]/.test(name)) {
    return 'A name cannot contain / or \\';
  }
  return null;
}

// Selects the name without its extension, so typing keeps ".pdf" and the like.
function selectBaseName(event, type) {
  const input = event.currentTarget;
  const dot = type === 'file' ? input.value.lastIndexOf('.') : -1;
  input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
}

// Rename a file or a folder. Closes itself on success.
export function RenameDialog({ item, onClose }) {
  const [name, setName] = useState(item.name);
  const [touched, setTouched] = useState(false);
  const { rename } = useDriveMutations();
  const trimmed = name.trim();
  const fieldError = touched ? validate(trimmed, item.type) : null;
  const serverFieldError = rename.error?.details?.name;

  const handleSubmit = () => {
    setTouched(true);
    if (validate(trimmed, item.type)) {
      return;
    }
    if (trimmed === item.name) {
      onClose();
      return;
    }
    rename.mutate(
      { type: item.type, id: item.id, name: trimmed },
      {
        onSuccess: () => {
          onClose();
          toast.success(`Renamed to ${trimmed}`);
        },
      },
    );
  };

  const errors = [fieldError, ...(serverFieldError ? [].concat(serverFieldError) : [])]
    .filter(Boolean)
    .map((message) => ({ message }));

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={item.type === 'folder' ? 'Rename folder' : 'Rename file'}
      submitLabel="Rename"
      isPending={rename.isPending}
      error={rename.isError && !serverFieldError ? rename.error.message : null}
      onSubmit={handleSubmit}
    >
      <Field data-invalid={errors.length > 0}>
        <FieldLabel htmlFor="drive-rename">Name</FieldLabel>
        <Input
          id="drive-rename"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => selectBaseName(event, item.type)}
          maxLength={MAX_LENGTH[item.type]}
          aria-invalid={errors.length > 0}
          autoFocus
          autoComplete="off"
        />
        <FieldError errors={errors} />
      </Field>
    </FormDialog>
  );
}
