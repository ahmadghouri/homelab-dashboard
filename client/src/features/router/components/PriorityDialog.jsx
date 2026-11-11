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
import { useSetRouterDevicePriority } from '../hooks/useRouterMutations';
import { MAX_MBPS_LIMIT, PRIORITIES, routerDeviceName } from '../utils';

function toFieldErrors(messages) {
  return messages?.map((message) => ({ message }));
}

// Returns [maxMbps or null, error message or null] for the text in the input.
function parseMaxMbps(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return [null, null];
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1 || value > MAX_MBPS_LIMIT) {
    return [null, `Enter a whole number from 1 to ${MAX_MBPS_LIMIT}, or leave empty for no limit.`];
  }
  return [value, null];
}

// Priority and speed limit for one router device.
export function PriorityDialog({ device, onClose }) {
  const [priority, setPriority] = useState(device.priority ?? 'normal');
  const [maxMbps, setMaxMbps] = useState(device.maxMbps ? String(device.maxMbps) : '');
  const [localError, setLocalError] = useState(null);
  const update = useSetRouterDevicePriority();
  const details = update.error?.details ?? {};
  const name = routerDeviceName(device);
  const maxError = localError ? [localError] : details.maxMbps;

  const handleSubmit = () => {
    const [value, error] = parseMaxMbps(maxMbps);
    setLocalError(error);
    if (error) {
      return;
    }
    update.mutate(
      { id: device.networkDeviceId, priority, maxMbps: value },
      {
        onSuccess: () => {
          onClose();
          toast.success(`Priority saved for ${name}`);
        },
      },
    );
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Priority for ${name}`}
      description="Applied as a queue on the router. Setting a priority also starts tracking usage."
      isPending={update.isPending}
      error={update.isError && !Object.keys(details).length ? update.error.message : null}
      onSubmit={handleSubmit}
    >
      <Field data-invalid={Boolean(details.priority)}>
        <FieldLabel htmlFor="router-priority">Priority</FieldLabel>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger id="router-priority" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>High gets bandwidth first when the line is busy.</FieldDescription>
        <FieldError errors={toFieldErrors(details.priority)} />
      </Field>
      <Field data-invalid={Boolean(maxError)}>
        <FieldLabel htmlFor="router-max-mbps">Speed limit (Mbps)</FieldLabel>
        <Input
          id="router-max-mbps"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_MBPS_LIMIT}
          step={1}
          value={maxMbps}
          onChange={(event) => setMaxMbps(event.target.value)}
          placeholder="No limit"
        />
        <FieldDescription>Optional. Caps both download and upload. Leave empty for no limit.</FieldDescription>
        <FieldError errors={toFieldErrors(maxError)} />
      </Field>
    </FormDialog>
  );
}
