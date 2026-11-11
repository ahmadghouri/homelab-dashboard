import { LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { buildSettings, showSaveResult, useSaveMultiLinkSettings } from '../hooks/useMultiLinkMutations';

const MODES = {
  balanced: {
    label: 'Balanced',
    description: 'New connections take turns over every active line that is up. Good when the lines are about as fast.',
  },
  weighted: {
    label: 'Weighted by speed',
    description:
      'Faster lines get more new connections, based on each line\'s last speed test. Run a speed test on every line first.',
  },
  failover: {
    label: 'Failover',
    description:
      'Everything uses the first active line. The next one takes over only when it goes down. Best for a stable IP address.',
  },
};

// How the proxy spreads new connections over the lines. Admins change it, everyone else sees it.
export function ModeCard({ deviceId, data, isAdmin }) {
  const save = useSaveMultiLinkSettings();
  const { mode, sticky } = buildSettings(data);
  const runningMode = data.multilink?.mode;

  const update = (change, title) =>
    save.mutate(
      { deviceId, settings: buildSettings(data, change) },
      {
        onSuccess: ({ pushed }) => showSaveResult(pushed, title),
        onError: (error) => toast.error('Could not save the setting', { description: error.message }),
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mode</CardTitle>
        <CardDescription>How the proxy spreads new connections over your lines.</CardDescription>
        {save.isPending && (
          <CardAction>
            <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="multilink-mode">Mode</Label>
          <Select
            value={mode}
            onValueChange={(value) => update({ mode: value }, `Mode set to ${MODES[value].label}`)}
            disabled={!isAdmin || save.isPending}
          >
            <SelectTrigger id="multilink-mode" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MODES).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{MODES[mode]?.description}</p>
          {runningMode && runningMode !== mode && !save.isPending && (
            <p className="text-xs text-warning">
              The PC still uses {MODES[runningMode]?.label ?? runningMode}. It switches when the agent gets the
              settings.
            </p>
          )}
        </div>

        <div className="flex items-start gap-3">
          <Switch
            id="multilink-sticky"
            checked={sticky}
            onCheckedChange={(value) => update({ sticky: value }, value ? 'Sticky turned on' : 'Sticky turned off')}
            disabled={!isAdmin || save.isPending}
            className="mt-0.5"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="multilink-sticky">Sticky sites</Label>
            <p className="text-sm text-muted-foreground">
              Keeps every site on the same line for 10 minutes. Banks, logins and video sites can log you out when
              your IP address changes; this avoids it at the cost of a little less spreading.
            </p>
          </div>
        </div>

        {!isAdmin && <p className="text-xs text-muted-foreground">Only an admin can change the mode.</p>}
      </CardContent>
    </Card>
  );
}
