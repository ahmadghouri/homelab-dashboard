import { TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { FormDialog } from '@/components/common/FormDialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { buildSettings, showSaveResult, useSaveMultiLinkSettings } from '../hooks/useMultiLinkMutations';

const MIN_CAP_GB = 0.1;
const MAX_CAP_GB = 10000;
const BYTES_PER_GB = 1e9;

const ROLES = {
  active: { label: 'Active', description: 'Carries traffic all the time.' },
  backup: { label: 'Backup', description: 'Used only when no active line is up.' },
  off: { label: 'Off', description: 'Never used by the proxy.' },
};

// The saved role and cap of a line, or what the PC reports when nothing was saved yet.
function initialValues(line, savedLine) {
  const capGb = savedLine?.capGb ?? (line.capBytes ? Number((line.capBytes / BYTES_PER_GB).toFixed(1)) : null);
  return { role: savedLine?.role ?? line.role ?? 'active', capGb };
}

function validateCap(text) {
  const value = Number(text);
  if (text.trim() === '' || !Number.isFinite(value)) {
    return 'Enter the data limit in GB.';
  }
  if (value < MIN_CAP_GB || value > MAX_CAP_GB) {
    return `Use a value from ${MIN_CAP_GB} to ${MAX_CAP_GB} GB.`;
  }
  return null;
}

// Role and data cap of one line. Mounted only while open, so the form starts from the saved values.
export function LineSettingsDialog({ deviceId, line, data, onOpenChange }) {
  const initial = initialValues(line, data.settings?.lines?.[line.id]);
  const [role, setRole] = useState(initial.role);
  const [hasCap, setHasCap] = useState(initial.capGb !== null);
  const [capText, setCapText] = useState(initial.capGb === null ? '' : String(initial.capGb));
  const [capError, setCapError] = useState(null);
  const save = useSaveMultiLinkSettings();
  const isTethering = line.kind === 'tethering';

  const handleSubmit = () => {
    const error = hasCap ? validateCap(capText) : null;
    setCapError(error);
    if (error) {
      return;
    }
    const lineSettings = { role, capGb: hasCap ? Number(capText) : null };
    save.mutate(
      { deviceId, settings: buildSettings(data, { lineId: line.id, line: lineSettings }) },
      {
        onSuccess: ({ pushed }) => {
          onOpenChange(false);
          showSaveResult(pushed, `${line.name} saved`);
        },
      },
    );
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => !save.isPending && onOpenChange(open)}
      title={`${line.name} settings`}
      description="Choose when the proxy may use this line and how much data it may use."
      isPending={save.isPending}
      error={save.isError ? save.error.message : null}
      onSubmit={handleSubmit}
    >
      <Field>
        <FieldLabel htmlFor="line-role">Role</FieldLabel>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="line-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLES).map(([value, { label }]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{ROLES[role].description}</FieldDescription>
        {isTethering && role === 'active' && (
          <p role="note" className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              This line is a phone on mobile data. As an active line it carries traffic all the time, which can use
              up your data plan. Set a data limit below.
            </span>
          </p>
        )}
      </Field>

      <Field data-invalid={Boolean(capError)}>
        <div className="flex items-center gap-3">
          <Switch
            id="line-has-cap"
            checked={hasCap}
            onCheckedChange={(checked) => {
              setHasCap(checked);
              setCapError(null);
            }}
          />
          <FieldLabel htmlFor="line-has-cap">Limit data</FieldLabel>
        </div>
        {hasCap && (
          <>
            <FieldLabel htmlFor="line-cap" className="sr-only">
              Data limit in GB
            </FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="line-cap"
                type="number"
                inputMode="decimal"
                min={MIN_CAP_GB}
                max={MAX_CAP_GB}
                step="0.1"
                value={capText}
                onChange={(event) => setCapText(event.target.value)}
                placeholder="5"
                className="w-32"
                aria-invalid={Boolean(capError)}
              />
              <span className="text-sm text-muted-foreground">GB</span>
            </div>
            <FieldError errors={capError ? [{ message: capError }] : undefined} />
          </>
        )}
        <FieldDescription>
          {hasCap
            ? 'The proxy stops using the line when it reaches the limit, until you reset its usage.'
            : 'No limit: the line can use as much data as it gets.'}
        </FieldDescription>
      </Field>
    </FormDialog>
  );
}
