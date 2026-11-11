import { PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/ErrorState';
import { FormDialog } from '@/components/common/FormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAlertRules, useUpdateAlertRule } from '../hooks/useAlertMutations';
import { SeverityBadge } from './AlertsTable';

function describeDuration(seconds) {
  if (!seconds) {
    return 'right away';
  }
  return seconds >= 60 ? `for ${seconds / 60} min` : `for ${seconds} s`;
}

function describeRule(rule) {
  if (rule.type === 'new_network_device') {
    return 'When a scan finds a device that is not trusted';
  }
  if (rule.type === 'device_offline') {
    return `When a PC is offline ${describeDuration(rule.durationSec)}`;
  }
  return `At ${rule.threshold}${rule.unit} or more, ${describeDuration(rule.durationSec)}`;
}

function toFieldErrors(messages) {
  return messages?.map((message) => ({ message }));
}

function EditRuleDialog({ rule, onClose }) {
  const [threshold, setThreshold] = useState(String(rule.threshold ?? ''));
  const [minutes, setMinutes] = useState(String(rule.durationSec / 60));
  const [severity, setSeverity] = useState(rule.severity);
  const update = useUpdateAlertRule();
  const details = update.error?.details ?? {};
  const [minThreshold, maxThreshold] = rule.limits.threshold ?? [];

  const handleSubmit = () => {
    const changes = { id: rule.id, severity };
    if (rule.limits.threshold) {
      changes.threshold = Number(threshold);
    }
    if (rule.limits.durationSec) {
      changes.durationSec = Math.round(Number(minutes) * 60);
    }
    update.mutate(changes, {
      onSuccess: () => {
        onClose();
        toast.success(`${rule.name} updated`);
      },
    });
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Edit: ${rule.name}`}
      isPending={update.isPending}
      error={update.isError && !Object.keys(details).length ? update.error.message : null}
      onSubmit={handleSubmit}
    >
      {rule.limits.threshold && (
        <Field data-invalid={Boolean(details.threshold)}>
          <FieldLabel htmlFor="rule-threshold">Limit ({rule.unit})</FieldLabel>
          <Input
            id="rule-threshold"
            type="number"
            inputMode="numeric"
            min={minThreshold}
            max={maxThreshold}
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
          <FieldDescription>
            Between {minThreshold} and {maxThreshold}. The alert closes when the value drops 5 below.
          </FieldDescription>
          <FieldError errors={toFieldErrors(details.threshold)} />
        </Field>
      )}
      {rule.limits.durationSec && (
        <Field data-invalid={Boolean(details.durationSec)}>
          <FieldLabel htmlFor="rule-duration">Wait (minutes)</FieldLabel>
          <Input
            id="rule-duration"
            type="number"
            inputMode="decimal"
            min={0}
            max={60}
            step={0.5}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
          <FieldDescription>How long the problem must last before alerting. 0 alerts right away.</FieldDescription>
          <FieldError errors={toFieldErrors(details.durationSec)} />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="rule-severity">Severity</FieldLabel>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger id="rule-severity" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  );
}

function RuleRow({ rule, isAdmin, onEdit }) {
  const update = useUpdateAlertRule();

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Switch
        checked={rule.enabled}
        disabled={!isAdmin || update.isPending}
        onCheckedChange={(enabled) =>
          update.mutate(
            { id: rule.id, enabled },
            { onError: (error) => toast.error(error.message) },
          )
        }
        aria-label={`${rule.name} ${rule.enabled ? 'on' : 'off'}`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{rule.name}</span>
        <span className="text-sm text-muted-foreground">{describeRule(rule)}</span>
      </div>
      <SeverityBadge severity={rule.severity} />
      {isAdmin && (
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${rule.name}`}>
          <PencilIcon aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

export function AlertRulesCard({ isAdmin }) {
  const { data: rules, isPending, isError, error, refetch, isRefetching } = useAlertRules();
  const [editing, setEditing] = useState(null);

  let content;
  if (isPending) {
    content = <Skeleton className="h-64 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else {
    content = (
      <ul className="flex flex-col divide-y">
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} isAdmin={isAdmin} onEdit={() => setEditing(rule)} />
        ))}
      </ul>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rules</CardTitle>
        <CardDescription>When an alert opens. Rules apply to every PC.</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
      {editing && <EditRuleDialog rule={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}
