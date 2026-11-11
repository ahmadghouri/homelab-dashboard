import { LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useUpdateSettings } from '../hooks/useSettings';

export function InternetSettingsCard({ settings }) {
  const [speedTestInterval, setSpeedTestInterval] = useState(
    String(settings.internet.speedTestIntervalMin),
  );
  const update = useUpdateSettings();
  const error = update.error?.details?.internet ?? (update.isError ? [update.error.message] : null);
  const isDirty = Number(speedTestInterval) !== settings.internet.speedTestIntervalMin;

  const handleSave = (event) => {
    event.preventDefault();
    update.mutate(
      { internet: { speedTestIntervalMin: Number(speedTestInterval) } },
      { onSuccess: () => toast.success('Speed test schedule saved') },
    );
  };

  return (
    <Card>
      <form onSubmit={handleSave} noValidate>
        <CardHeader>
          <CardTitle>Internet speed test</CardTitle>
          <CardDescription>
            How often the server tests your internet speed. Each test uses about 35 MB of data.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="speed-test-interval">Test every (minutes)</FieldLabel>
            <Input
              id="speed-test-interval"
              type="number"
              inputMode="numeric"
              min={0}
              max={1440}
              value={speedTestInterval}
              onChange={(event) => setSpeedTestInterval(event.target.value)}
              className="max-w-32"
            />
            <FieldDescription>
              0 turns scheduled tests off (you can still run one from the Internet page). Up to 1440 (once a day).
            </FieldDescription>
            <FieldError errors={error?.map((message) => ({ message }))} />
          </Field>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
