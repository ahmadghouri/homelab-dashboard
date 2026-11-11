import { useState } from 'react';
import { toast } from 'sonner';
import { FormDialog } from '@/components/common/FormDialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddService, useUpdateService } from '../hooks/useServiceMutations';
import { SERVICE_DEFAULTS, SERVICE_TYPES, serviceTypeInfo } from '../utils';

const FORM_FIELDS = ['name', 'type', 'target', 'intervalSec', 'timeoutMs'];

function toFieldErrors(messages) {
  return messages?.map((message) => ({ message }));
}

// Empty number fields are left out so the server applies its default.
function toNumber(value) {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : Number(trimmed);
}

// Add a service (no `service`) or edit one. Closes itself on success.
export function ServiceFormDialog({ service, onClose }) {
  const isEdit = Boolean(service);
  const [name, setName] = useState(service?.name ?? '');
  const [type, setType] = useState(service?.type ?? 'http');
  const [target, setTarget] = useState(service?.target ?? '');
  const [intervalSec, setIntervalSec] = useState(String(service?.intervalSec ?? SERVICE_DEFAULTS.intervalSec));
  const [timeoutMs, setTimeoutMs] = useState(String(service?.timeoutMs ?? SERVICE_DEFAULTS.timeoutMs));
  const add = useAddService();
  const update = useUpdateService();
  const mutation = isEdit ? update : add;
  const details = mutation.error?.details ?? {};
  // Errors for a field this form does not show go in the general message instead.
  const hasFieldError = FORM_FIELDS.some((field) => details[field]);
  const typeInfo = serviceTypeInfo(type);

  const handleSubmit = () => {
    const values = {
      name: name.trim(),
      type,
      target: target.trim(),
      intervalSec: toNumber(intervalSec),
      timeoutMs: toNumber(timeoutMs),
    };
    const options = {
      onSuccess: (saved) => {
        onClose();
        toast.success(isEdit ? `${saved.name} saved` : `${saved.name} added, first check is running`);
      },
    };
    if (isEdit) {
      update.mutate({ id: service.id, ...values }, options);
    } else {
      add.mutate(values, options);
    }
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={isEdit ? `Edit ${service.name}` : 'Add service'}
      description="A website or a TCP port to check on a schedule."
      submitLabel={isEdit ? 'Save' : 'Add service'}
      isPending={mutation.isPending}
      error={mutation.isError && !hasFieldError ? mutation.error.message : null}
      onSubmit={handleSubmit}
    >
      <Field data-invalid={Boolean(details.name)}>
        <FieldLabel htmlFor="service-name">Name</FieldLabel>
        <Input
          id="service-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Router admin page"
          maxLength={60}
          aria-invalid={Boolean(details.name)}
          autoFocus
        />
        <FieldError errors={toFieldErrors(details.name)} />
      </Field>
      <Field data-invalid={Boolean(details.type)}>
        <FieldLabel htmlFor="service-type">Type</FieldLabel>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="service-type" className="w-full" aria-invalid={Boolean(details.type)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_TYPES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError errors={toFieldErrors(details.type)} />
      </Field>
      <Field data-invalid={Boolean(details.target)}>
        <FieldLabel htmlFor="service-target">{type === 'http' ? 'URL' : 'Host and port'}</FieldLabel>
        <Input
          id="service-target"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder={typeInfo.placeholder}
          inputMode={type === 'http' ? 'url' : 'text'}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={Boolean(details.target)}
        />
        <FieldDescription>{typeInfo.hint}</FieldDescription>
        <FieldError errors={toFieldErrors(details.target)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(details.intervalSec)}>
          <FieldLabel htmlFor="service-interval">Check every (seconds)</FieldLabel>
          <Input
            id="service-interval"
            type="number"
            inputMode="numeric"
            min={30}
            max={3600}
            value={intervalSec}
            onChange={(event) => setIntervalSec(event.target.value)}
            aria-invalid={Boolean(details.intervalSec)}
          />
          <FieldDescription>30 to 3600</FieldDescription>
          <FieldError errors={toFieldErrors(details.intervalSec)} />
        </Field>
        <Field data-invalid={Boolean(details.timeoutMs)}>
          <FieldLabel htmlFor="service-timeout">Timeout (ms)</FieldLabel>
          <Input
            id="service-timeout"
            type="number"
            inputMode="numeric"
            min={1000}
            max={30000}
            step={500}
            value={timeoutMs}
            onChange={(event) => setTimeoutMs(event.target.value)}
            aria-invalid={Boolean(details.timeoutMs)}
          />
          <FieldDescription>1000 to 30000</FieldDescription>
          <FieldError errors={toFieldErrors(details.timeoutMs)} />
        </Field>
      </div>
    </FormDialog>
  );
}
